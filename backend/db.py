import sqlite3
import json
import time
import requests
import os
import threading
from typing import List, Dict, Any, Optional
from backend.auth import generate_32_hash_id, hash_password

DB_FILE = os.path.join(os.path.dirname(__file__), "crypto_scanner.db")
CLICKHOUSE_HOST = os.environ.get("CLICKHOUSE_HOST", "http://localhost:8123")

class DatabaseManager:
    def __init__(self):
        self.coin_cache: Dict[str, Dict[str, Any]] = {}
        self.lock = threading.Lock()
        self._init_sqlite()
        self._load_coin_cache()
        self._ch_available = False
        self.tick_buffer: List[Dict[str, Any]] = []
        self.total_ticks_processed = 0
        self.total_filtered_ticks = 0
        self.last_batch_time = time.time()
        self._check_clickhouse()

    def _init_sqlite(self):
        """Initialize SQLite database with WAL mode and 10s busy timeout"""
        with sqlite3.connect(DB_FILE, timeout=10.0) as conn:
            cursor = conn.cursor()
            cursor.execute("PRAGMA journal_mode=WAL;")
            cursor.execute("PRAGMA busy_timeout=10000;")
            # User table with 32-character hash ID
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    first_name TEXT NOT NULL,
                    last_name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    password_salt TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # VERSION 95: ENSURE MULTI-ADMIN USER CREDENTIALS (admin, admin1, admin2, admin3, soufi_admin -> password=admin123)
            default_admins = [
                ("admin", "Admin", "Master", "admin@cryptoscanner.io"),
                ("admin1", "Admin", "One", "admin1@cryptoscanner.io"),
                ("admin2", "Admin", "Two", "admin2@cryptoscanner.io"),
                ("admin3", "Admin", "Three", "admin3@cryptoscanner.io"),
                ("soufi_admin", "Soufi", "Admin", "soufi_admin@cryptoscanner.io")
            ]
            cred = hash_password("admin123")
            for uname, fname, lname, email in default_admins:
                cursor.execute("SELECT id FROM users WHERE username = ?", (uname,))
                row = cursor.fetchone()
                if row:
                    cursor.execute(
                        "UPDATE users SET password_hash = ?, password_salt = ? WHERE username = ?",
                        (cred["hash"], cred["salt"], uname)
                    )
                else:
                    u_id = generate_32_hash_id()
                    cursor.execute(
                        "INSERT INTO users (id, first_name, last_name, email, username, password_hash, password_salt) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        (u_id, fname, lname, email, uname, cred["hash"], cred["salt"])
                    )
            
            # Coin Registry table with 32-character hash ID
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS coins (
                    id TEXT PRIMARY KEY,
                    symbol TEXT UNIQUE NOT NULL,
                    base_asset TEXT NOT NULL,
                    quote_asset TEXT NOT NULL,
                    name TEXT NOT NULL,
                    coin_type TEXT NOT NULL,
                    is_filtered INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # VERSION 37: PERSISTENT TRANSACTION HISTORY DATABASE TABLE
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS transaction_history (
                    id TEXT PRIMARY KEY,
                    participant TEXT NOT NULL,
                    action TEXT NOT NULL,
                    symbol TEXT NOT NULL,
                    price REAL NOT NULL,
                    capital REAL NOT NULL,
                    pnl REAL DEFAULT 0.0,
                    commission_fee REAL DEFAULT 0.0,
                    status TEXT DEFAULT 'QUEUED_PENDING',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Add commission_fee column if missing in existing table
            try:
                cursor.execute("ALTER TABLE transaction_history ADD COLUMN commission_fee REAL DEFAULT 0.0")
            except Exception:
                pass

            # VERSION 38: PAST PATTERN DATABASE TABLE (STORE 10-YEAR ANALYSIS BY GROUP E)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS past_pattern (
                    id TEXT PRIMARY KEY,
                    coin_id TEXT NOT NULL,
                    date_from TEXT NOT NULL,
                    year INTEGER NOT NULL,
                    date_to TEXT NOT NULL,
                    time_type TEXT NOT NULL,
                    description TEXT NOT NULL,
                    price_movement TEXT NOT NULL,
                    volume_movement TEXT NOT NULL,
                    commentary TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # VERSION 38: PAST TICK DATABASE TABLE (TEMPORARY 10-YEAR TICK INGESTION)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS past_tick (
                    id TEXT PRIMARY KEY,
                    coin_id TEXT NOT NULL,
                    year INTEGER NOT NULL,
                    timestamp INTEGER NOT NULL,
                    price REAL NOT NULL,
                    volume REAL NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Local Time-Series table linked to coin_id
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS crypto_ticks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    coin_id TEXT,
                    symbol TEXT NOT NULL,
                    exchange TEXT NOT NULL,
                    price REAL NOT NULL,
                    quantity REAL NOT NULL,
                    side TEXT,
                    timestamp INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(coin_id) REFERENCES coins(id)
                )
            """)

            # VERSION 19: DEDICATED FCPO TICKS TABLE FOR BURSA MALAYSIA DERIVATIVES
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS fcpo_ticks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    symbol TEXT NOT NULL,
                    exchange TEXT NOT NULL,
                    price REAL NOT NULL,
                    high REAL NOT NULL,
                    low REAL NOT NULL,
                    volume REAL NOT NULL,
                    change_pct REAL NOT NULL,
                    timestamp INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # VERSION 44: PERSISTENT ACTIVE HOLDINGS TABLE
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS active_holdings (
                    id TEXT PRIMARY KEY,
                    participant TEXT NOT NULL,
                    symbol TEXT NOT NULL,
                    entry_price REAL NOT NULL,
                    amount REAL NOT NULL,
                    status TEXT DEFAULT 'OPEN',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # VERSION 44: ROBO TRADE SCHEDULES TABLE
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS robo_schedules (
                    id TEXT PRIMARY KEY,
                    participant TEXT NOT NULL,
                    schedule_index INTEGER NOT NULL,
                    symbol TEXT NOT NULL,
                    entry_price_target REAL NOT NULL,
                    exit_price_target REAL NOT NULL,
                    status TEXT DEFAULT 'PENDING',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            try:
                cursor.execute("ALTER TABLE crypto_ticks ADD COLUMN coin_id TEXT")
            except Exception:
                pass
            conn.commit()

            # Create or update default admin user with username=admin, password=admin123
            cursor.execute("SELECT id FROM users WHERE username = 'admin'")
            row = cursor.fetchone()
            if not row:
                self.create_user(
                    first_name="Admin",
                    last_name="User",
                    email="admin@cryptoscanner.io",
                    username="admin",
                    password="admin123"
                )
            else:
                pwd_data = hash_password("admin123")
                cursor.execute("""
                    UPDATE users SET password_hash = ?, password_salt = ? WHERE username = 'admin'
                """, (pwd_data["hash"], pwd_data["salt"]))
                conn.commit()

    def _check_clickhouse(self):
        """Checks if ClickHouse HTTP API is available"""
        try:
            res = requests.get(f"{CLICKHOUSE_HOST}/ping", timeout=1.5)
            if res.status_code == 200 and res.text.strip() == "Ok.":
                self._ch_available = True
                self._init_clickhouse_schema()
        except Exception:
            self._ch_available = False

    def _init_clickhouse_schema(self):
        """Creates time-series table in ClickHouse via HTTP API if available"""
        query = """
        CREATE TABLE IF NOT EXISTS crypto_ticks (
            symbol String,
            exchange String,
            price Float64,
            quantity Float64,
            side String,
            timestamp Int64,
            created_at DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        PARTITION BY toYYYYMM(created_at)
        ORDER BY (symbol, timestamp);
        """
        try:
            requests.post(f"{CLICKHOUSE_HOST}/", data=query, timeout=3)
        except Exception as e:
            print(f"[ClickHouse Init Warning] {e}")

    def create_user(self, first_name: str, last_name: str, email: str, username: str, password: str) -> Dict[str, Any]:
        """Creates user with 32-character hash ID and salted password hash"""
        user_id = generate_32_hash_id()
        pwd_data = hash_password(password)

        with sqlite3.connect(DB_FILE) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO users (id, first_name, last_name, email, username, password_hash, password_salt)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (user_id, first_name, last_name, email.lower(), username.lower(), pwd_data["hash"], pwd_data["salt"]))
            conn.commit()

        return {
            "id": user_id,
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "username": username
        }

    def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        with sqlite3.connect(DB_FILE) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE username = ?", (username.lower(),))
            row = cursor.fetchone()
            if row:
                return dict(row)
        return None

    def get_all_users(self) -> List[Dict[str, Any]]:
        with sqlite3.connect(DB_FILE) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT id, first_name, last_name, email, username, created_at FROM users ORDER BY created_at DESC")
            return [dict(row) for row in cursor.fetchall()]

    def delete_user(self, user_id: str) -> bool:
        with sqlite3.connect(DB_FILE) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
            conn.commit()
            return cursor.rowcount > 0

    def _load_coin_cache(self):
        """Loads coin registry from database into memory cache"""
        with sqlite3.connect(DB_FILE) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM coins")
            for row in cursor.fetchall():
                c = dict(row)
                self.coin_cache[c["symbol"]] = c

    def get_or_create_coin(self, symbol: str) -> Dict[str, Any]:
        """Auto-registers coin from Binance API with 32-character hash ID and categorization"""
        if symbol in self.coin_cache:
            return self.coin_cache[symbol]

        # Derive base and quote asset
        quote = "USDT" if symbol.endswith("USDT") else "BTC"
        base = symbol[:-len(quote)] if symbol.endswith(quote) else symbol

        # Categorize Coin Type
        meme_keywords = ["DOGE", "SHIB", "PEPE", "FLOKI", "BONK", "WIF", "BOME", "MEME", "TURBO", "NEIRO", "MOG", "SLERF", "MYRO", "1000SATS", "PEOPLE", "POPCAT", "RATS"]
        major_coins = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "AVAX", "LINK", "DOT", "NEAR"]
        stable_coins = ["USDT", "USDC", "FDUSD", "DAI", "TUSD"]

        base_upper = base.upper()
        if any(kw in base_upper for kw in meme_keywords):
            coin_type = "MEME"
            is_filtered = 1  # MEME coins filtered from tick database by default as requested
        elif base_upper in major_coins:
            coin_type = "MAJOR"
            is_filtered = 0
        elif base_upper in stable_coins:
            coin_type = "STABLECOIN"
            is_filtered = 1  # Currency/Stablecoins filtered from tick storage
        else:
            coin_type = "ALTCOIN"
            is_filtered = 0

        coin_id = generate_32_hash_id()
        coin_record = {
            "id": coin_id,
            "symbol": symbol,
            "base_asset": base,
            "quote_asset": quote,
            "name": f"{base} Token",
            "coin_type": coin_type,
            "is_filtered": is_filtered
        }

        with sqlite3.connect(DB_FILE) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR IGNORE INTO coins (id, symbol, base_asset, quote_asset, name, coin_type, is_filtered)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (coin_id, symbol, base, quote, f"{base} Token", coin_type, is_filtered))
            conn.commit()

        self.coin_cache[symbol] = coin_record
        return coin_record

    def get_all_coins(self) -> List[Dict[str, Any]]:
        with sqlite3.connect(DB_FILE) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM coins ORDER BY coin_type ASC, symbol ASC")
            return [dict(row) for row in cursor.fetchall()]

    def toggle_coin_filter(self, coin_id: str, is_filtered: int) -> bool:
        with sqlite3.connect(DB_FILE) as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE coins SET is_filtered = ? WHERE id = ?", (is_filtered, coin_id))
            conn.commit()
            # Update cache
            for sym, c in self.coin_cache.items():
                if c["id"] == coin_id:
                    c["is_filtered"] = is_filtered
            return True

    def get_candlesticks(self, symbol: str, timeframe: str = "1m") -> List[Dict[str, Any]]:
        """
        VERSION 62: Aggregates tick data into OHLCV Candlestick bars for timeframes:
        1m, 3m, 5m, 15m, 30m, 1h, 3h, 1d, 1w, 1M, 1Y (Year-by-Year).
        """
        if timeframe == "1Y":
            yearly_candles = {}
            try:
                import datetime, requests
                res = requests.get(f"https://api.binance.com/api/v3/klines?symbol={symbol}&interval=1M&limit=120", timeout=3.0)
                if res.status_code == 200:
                    for k in res.json():
                        ts_ms = k[0]
                        dt = datetime.datetime.utcfromtimestamp(ts_ms / 1000.0)
                        year_ts = int(datetime.datetime(dt.year, 1, 1).timestamp() * 1000)
                        o, h, l, c, v = float(k[1]), float(k[2]), float(k[3]), float(k[4]), float(k[5])
                        
                        if year_ts not in yearly_candles:
                            yearly_candles[year_ts] = {
                                "time": year_ts,
                                "open": o, "high": h, "low": l, "close": c, "volume": v
                            }
                        else:
                            yc = yearly_candles[year_ts]
                            yc["high"] = max(yc["high"], h)
                            yc["low"] = min(yc["low"], l)
                            yc["close"] = c
                            yc["volume"] += v
            except Exception as e:
                print(f"[1Y Yearly Candlestick Warning] {e}")

            result = list(yearly_candles.values())
            result.sort(key=lambda x: x["time"])
            if result:
                return result

        interval_seconds = {
            "1m": 60, "3m": 180, "5m": 300, "15m": 900, "30m": 1800,
            "1h": 3600, "3h": 10800, "1d": 86400, "1w": 604800, "1M": 2592000, "1Y": 31536000
        }.get(timeframe, 60)

        with sqlite3.connect(DB_FILE) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("""
                SELECT timestamp, price, quantity FROM crypto_ticks
                WHERE symbol = ? ORDER BY timestamp ASC
            """, (symbol,))
            rows = cursor.fetchall()

        candles = {}
        if rows:
            for r in rows:
                ts = r["timestamp"] // 1000
                bucket = (ts // interval_seconds) * interval_seconds
                price = r["price"]
                qty = r["quantity"]

                if bucket not in candles:
                    candles[bucket] = {
                        "time": bucket * 1000,
                        "open": price, "high": price,
                        "low": price, "close": price,
                        "volume": qty
                    }
                else:
                    c = candles[bucket]
                    c["high"] = max(c["high"], price)
                    c["low"] = min(c["low"], price)
                    c["close"] = price
                    c["volume"] += qty

        # If tick DB has fewer than 10 candles, enrich with Binance Kline REST API
        if len(candles) < 10:
            try:
                import requests
                binance_interval = timeframe if timeframe in ["1m","3m","5m","15m","30m","1h","3h","1d","1w","1M"] else "1d"
                res = requests.get(f"https://api.binance.com/api/v3/klines?symbol={symbol}&interval={binance_interval}&limit=100", timeout=2.5)
                if res.status_code == 200:
                    b_klines = res.json()
                    for k in b_klines:
                        b_time = k[0]
                        if b_time not in candles:
                            candles[b_time] = {
                                "time": b_time,
                                "open": float(k[1]),
                                "high": float(k[2]),
                                "low": float(k[3]),
                                "close": float(k[4]),
                                "volume": float(k[5])
                            }
            except Exception as e:
                print(f"[Candlestick Fetch Warning] {e}")

        result = list(candles.values())
        result.sort(key=lambda x: x["time"])
        return result

    def insert_tick_batch(self, ticks: List[Dict[str, Any]]):
        """
        High-throughput batch insertion.
        FILTERS OUT MEME / CURRENCY COINS so their ticks are NOT saved into the ticks DB table!
        """
        if not ticks:
            return

        valid_ticks = []
        filtered_count = 0

        for tick in ticks:
            symbol = tick.get("symbol", "")
            coin = self.get_or_create_coin(symbol)
            tick["coin_id"] = coin["id"]

            # Filter Check: If coin is MEME or set as filtered, DO NOT store ticks into tick table!
            if coin.get("is_filtered", 0) == 1 or coin.get("coin_type") in ["MEME", "STABLECOIN"]:
                filtered_count += 1
                continue

            valid_ticks.append(tick)

        with self.lock:
            self.total_ticks_processed += len(valid_ticks)
            self.total_filtered_ticks += filtered_count

        if not valid_ticks:
            return

        # 1. ClickHouse HTTP API bulk insertion for allowed ticks
        if self._ch_available:
            try:
                json_lines = "\n".join(json.dumps(t) for t in valid_ticks)
                res = requests.post(
                    f"{CLICKHOUSE_HOST}/?query=INSERT+INTO+crypto_ticks+FORMAT+JSONEachRow",
                    data=json_lines,
                    timeout=2
                )
                if res.status_code == 200:
                    return
            except Exception:
                self._ch_available = False

        # 2. Local Fallback SQLite Batch Insert
        with sqlite3.connect(DB_FILE) as conn:
            cursor = conn.cursor()
            cursor.executemany("""
                INSERT INTO crypto_ticks (coin_id, symbol, exchange, price, quantity, side, timestamp)
                VALUES (:coin_id, :symbol, :exchange, :price, :quantity, :side, :timestamp)
            """, valid_ticks)
            conn.commit()

    def get_stats(self) -> Dict[str, Any]:
        with sqlite3.connect(DB_FILE) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM crypto_ticks")
            sqlite_count = cursor.fetchone()[0]

        db_size_bytes = 0
        if os.path.exists(DB_FILE):
            db_size_bytes = os.path.getsize(DB_FILE)

        return {
            "ch_available": self._ch_available,
            "sqlite_ticks_count": sqlite_count,
            "total_processed": self.total_ticks_processed,
            "total_filtered": self.total_filtered_ticks,
            "db_size_mb": round(db_size_bytes / (1024 * 1024), 2)
        }

    def insert_fcpo_tick(self, symbol: str, exchange: str, price: float, high: float, low: float, volume: float, change_pct: float, timestamp: int = None):
        """Inserts real-time FCPO futures tick into dedicated fcpo_ticks database table"""
        if timestamp is None:
            timestamp = int(time.time())
        with sqlite3.connect(DB_FILE) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO fcpo_ticks (symbol, exchange, price, high, low, volume, change_pct, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (symbol, exchange, price, high, low, volume, change_pct, timestamp))
            conn.commit()

    def add_transaction_history(self, participant: str, action: str, symbol: str, price: float, capital: float, pnl: float = 0.0, commission_fee: float = 0.0, status: str = "COMPLETED") -> Dict[str, Any]:
        """VERSION 77: Insert paper trading transaction record into persistent DB with 0.20% Commission Fee deduction"""
        if commission_fee <= 0.0 and capital > 0.0:
            commission_fee = round(capital * 0.002, 4)
        tx_id = generate_32_hash_id()
        with sqlite3.connect(DB_FILE) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO transaction_history (id, participant, action, symbol, price, capital, pnl, commission_fee, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (tx_id, participant, action, symbol, price, capital, pnl, commission_fee, status))
            conn.commit()
        return {
            "id": tx_id,
            "participant": participant,
            "action": action,
            "symbol": symbol,
            "price": price,
            "capital": capital,
            "pnl": pnl,
            "commission_fee": commission_fee,
            "status": status,
            "timestamp": time.strftime("%H:%M:%S")
        }

    def get_all_transaction_history(self) -> List[Dict[str, Any]]:
        """VERSION 54: Retrieve only completed, exited paper trade transactions from persistent DB"""
        with sqlite3.connect(DB_FILE, timeout=10.0) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM transaction_history WHERE action LIKE 'SELL%' OR action LIKE 'EXIT%' OR action LIKE 'COMPLETE%' ORDER BY created_at DESC")
            rows = cursor.fetchall()
            return [dict(r) for r in rows]

    def clear_transaction_history(self) -> bool:
        """VERSION 37: Reset/Clear all transaction history from persistent DB"""
        with sqlite3.connect(DB_FILE) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM transaction_history")
            conn.commit()
            return True

    def insert_past_ticks_batch(self, coin_id: str, year: int, ticks: List[Dict[str, Any]]):
        """VERSION 38: Insert raw ticks for a specific year into past_tick table"""
        with sqlite3.connect(DB_FILE) as conn:
            cursor = conn.cursor()
            for t in ticks:
                t_id = generate_32_hash_id()
                cursor.execute("""
                    INSERT INTO past_tick (id, coin_id, year, timestamp, price, volume)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (t_id, coin_id, year, t["timestamp"], t["price"], t["volume"]))
            conn.commit()

    def delete_past_ticks_by_year(self, coin_id: str, year: int):
        """VERSION 38: Delete raw ticks for a specific year after Group E analysis is completed"""
        with sqlite3.connect(DB_FILE) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM past_tick WHERE coin_id = ? AND year = ?", (coin_id, year))
            conn.commit()

    def clear_past_patterns(self) -> bool:
        """VERSION 40: Clear all data in past_pattern table to rebuild natural language historical analysis"""
        with sqlite3.connect(DB_FILE) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM past_pattern")
            conn.commit()
            return True

    def insert_past_pattern(self, coin_id: str, date_from: str, year: int, date_to: str, time_type: str, description: str, price_movement: str, volume_movement: str, commentary: str):
        """VERSION 62: Insert Group E historical pattern analysis into past_pattern table with deduplication"""
        with sqlite3.connect(DB_FILE) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id FROM past_pattern 
                WHERE coin_id = ? AND date_from = ? AND date_to = ? AND time_type = ? AND description = ?
            """, (coin_id, date_from, date_to, time_type, description))
            existing = cursor.fetchone()
            if existing:
                p_id = existing[0]
                cursor.execute("""
                    UPDATE past_pattern 
                    SET price_movement = ?, volume_movement = ?, commentary = ?, year = ?
                    WHERE id = ?
                """, (price_movement, volume_movement, commentary, year, p_id))
            else:
                p_id = generate_32_hash_id()
                cursor.execute("""
                    INSERT INTO past_pattern (id, coin_id, date_from, year, date_to, time_type, description, price_movement, volume_movement, commentary)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (p_id, coin_id, date_from, year, date_to, time_type, description, price_movement, volume_movement, commentary))
            conn.commit()
        return p_id

    def get_past_patterns(self, coin_id: Optional[str] = None, time_type: Optional[str] = None, year: Optional[int] = None) -> List[Dict[str, Any]]:
        """VERSION 38: Retrieve 10-year historical patterns from past_pattern table"""
        with sqlite3.connect(DB_FILE) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            query = "SELECT * FROM past_pattern WHERE 1=1"
            params = []
            if coin_id and coin_id.upper() != "ALL":
                query += " AND coin_id = ?"
                params.append(coin_id.upper())
            if time_type and time_type.lower() != "all":
                query += " AND time_type = ?"
                params.append(time_type.lower())
            if year:
                query += " AND year = ?"
                params.append(int(year))
            query += " ORDER BY year DESC, created_at DESC"
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [dict(r) for r in rows]

    def get_past_pattern_years(self, coin_id: str) -> List[int]:
        with sqlite3.connect(DB_FILE) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT DISTINCT year FROM past_pattern WHERE coin_id = ? ORDER BY year DESC", (coin_id,))
            return [r[0] for r in cursor.fetchall()]

    def get_database_stats(self) -> Dict[str, Any]:
        sqlite_count = 0
        db_size_mb = 0.0
        db_size_bytes = 0
        if os.path.exists(DB_FILE):
            db_size_bytes = os.path.getsize(DB_FILE)
            db_size_mb = db_size_bytes / (1024 * 1024)
            try:
                with sqlite3.connect(DB_FILE) as conn:
                    cursor = conn.cursor()
                    cursor.execute("SELECT COUNT(*) FROM history_ticks")
                    sqlite_count = cursor.fetchone()[0]
            except:
                pass
                
        return {
            "total_ticks_ingested": self.total_ticks_processed + sqlite_count,
            "total_filtered_ticks": self.total_filtered_ticks,
            "total_registered_coins": len(self.coin_cache),
            "clickhouse_connected": self._ch_available,
            "clickhouse_host": CLICKHOUSE_HOST,
            "db_mode": "ClickHouse (Time-Series)" if self._ch_available else "Local Columnar Engine (SQLite Time-Series)",
            "db_file_path": DB_FILE,
            "db_size_mb": db_size_mb,
            "db_size_bytes": db_size_bytes
        }

    # VERSION 44: ACTIVE HOLDINGS METHODS
    def add_active_holding(self, participant: str, symbol: str, entry_price: float, amount: float) -> Dict[str, Any]:
        h_id = generate_32_hash_id()
        with sqlite3.connect(DB_FILE) as conn:
            cursor = conn.cursor()
            # Ensure highest_price column exists
            try:
                cursor.execute("ALTER TABLE active_holdings ADD COLUMN highest_price REAL DEFAULT 0.0")
            except Exception:
                pass
            cursor.execute("""
                INSERT INTO active_holdings (id, participant, symbol, entry_price, amount, highest_price)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (h_id, participant, symbol, entry_price, amount, entry_price))
            conn.commit()
        return {"id": h_id, "participant": participant, "symbol": symbol, "entry_price": entry_price, "amount": amount, "highest_price": entry_price}

    def update_holding_highest_price(self, h_id: str, highest_price: float) -> bool:
        """VERSION 82: Update peak price recorded for active holding to enforce peak-trailing stop exits"""
        with sqlite3.connect(DB_FILE) as conn:
            cursor = conn.cursor()
            try:
                cursor.execute("ALTER TABLE active_holdings ADD COLUMN highest_price REAL DEFAULT 0.0")
            except Exception:
                pass
            cursor.execute("UPDATE active_holdings SET highest_price = ? WHERE id = ?", (highest_price, h_id))
            conn.commit()
            return True

    def get_all_active_holdings(self) -> List[Dict[str, Any]]:
        with sqlite3.connect(DB_FILE) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM active_holdings WHERE status = 'OPEN' ORDER BY created_at DESC")
            return [dict(r) for r in cursor.fetchall()]

    def remove_active_holding(self, h_id: str) -> bool:
        with sqlite3.connect(DB_FILE) as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE active_holdings SET status = 'CLOSED' WHERE id = ?", (h_id,))
            conn.commit()
            return True

    def clear_active_holdings(self) -> bool:
        with sqlite3.connect(DB_FILE) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM active_holdings")
            conn.commit()
            return True

    # VERSION 63: FRESH START RESET ALL ROBO & PAPER TRADING DATA
    def clear_all_robo_data(self) -> bool:
        with sqlite3.connect(DB_FILE) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM active_holdings")
            cursor.execute("DELETE FROM transaction_history")
            cursor.execute("DELETE FROM robo_schedules")
            conn.commit()
            return True

    def reset_v63_fresh_start(self) -> bool:
        """VERSION 63: Fresh start reset - wipes active holdings, transaction history, and pending robo schedules"""
        with sqlite3.connect(DB_FILE) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM active_holdings")
            cursor.execute("DELETE FROM transaction_history")
            cursor.execute("DELETE FROM robo_schedules")
            conn.commit()
            return True

    # VERSION 44: ROBO SCHEDULES METHODS
    def set_robo_schedules(self, participant: str, schedules: List[Dict[str, Any]]):
        """Clears previous schedules and inserts exactly current pending ones for a participant"""
        with sqlite3.connect(DB_FILE, timeout=10.0) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM robo_schedules WHERE participant = ?", (participant,))
            for idx, s in enumerate(schedules):
                s_id = generate_32_hash_id()
                cursor.execute("""
                    INSERT INTO robo_schedules (id, participant, schedule_index, symbol, entry_price_target, exit_price_target)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (s_id, participant, idx + 1, s["symbol"], s["entry_price_target"], s["exit_price_target"]))
            conn.commit()

    def get_robo_schedules(self, participant: str = None) -> List[Dict[str, Any]]:
        with sqlite3.connect(DB_FILE) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            if participant:
                cursor.execute("SELECT * FROM robo_schedules WHERE participant = ? ORDER BY schedule_index ASC", (participant,))
            else:
                cursor.execute("SELECT * FROM robo_schedules ORDER BY participant, schedule_index ASC")
            return [dict(r) for r in cursor.fetchall()]

    def mark_robo_schedule_executed(self, s_id: str):
        with sqlite3.connect(DB_FILE) as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE robo_schedules SET status = 'EXECUTED' WHERE id = ?", (s_id,))
            conn.commit()

    def clear_robo_schedules(self) -> bool:
        """VERSION 89: Wipe all queued robo trade schedules on fresh start reset"""
        with sqlite3.connect(DB_FILE) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM robo_schedules")
            conn.commit()
            return True

    def prune_old_crypto_ticks(self, retention_hours: int = 48) -> int:
        """VERSION 88: Automatically prune raw ticks older than retention_hours to maintain optimal DB file size (< 400 MB)"""
        try:
            with sqlite3.connect(DB_FILE) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT MAX(timestamp) FROM crypto_ticks")
                max_row = cursor.fetchone()
                if max_row and max_row[0]:
                    max_ts = max_row[0]
                    cutoff_ts = max_ts - (retention_hours * 3600 * 1000)
                    cursor.execute("DELETE FROM crypto_ticks WHERE timestamp < ?", (cutoff_ts,))
                    deleted_rows = cursor.rowcount
                    conn.commit()
                    return deleted_rows
        except Exception as e:
            print("[DB Pruning Error]", e)
        return 0

    # VERSION 95: MULTI-ADMIN CONCURRENT IP SESSION GUARD (MAX 3 ACTIVE IPS)
    def init_ip_sessions(self):
        if not hasattr(self, "_active_ip_sessions"):
            self._active_ip_sessions: Dict[str, Dict[str, Any]] = {}

    def get_active_ip_sessions(self) -> List[Dict[str, Any]]:
        self.init_ip_sessions()
        now = time.time()
        # Auto-expire sessions idle for > 3600s (1 hour)
        expired = [ip for ip, s in self._active_ip_sessions.items() if now - s.get("last_active", 0) > 3600]
        for ip in expired:
            del self._active_ip_sessions[ip]
        return list(self._active_ip_sessions.values())

    def register_ip_session(self, username: str, client_ip: str) -> Dict[str, Any]:
        self.init_ip_sessions()
        active_list = self.get_active_ip_sessions()
        now = time.time()
        
        # If IP is already active, update last_active timestamp
        if client_ip in self._active_ip_sessions:
            self._active_ip_sessions[client_ip]["last_active"] = now
            self._active_ip_sessions[client_ip]["username"] = username
            return {"allowed": True, "message": "IP session active & refreshed", "active_count": len(self._active_ip_sessions), "max_limit": 3}
            
        # If IP is NEW and active IP count >= 3, BLOCK LOGIN!
        if len(self._active_ip_sessions) >= 3:
            active_ips = [s["client_ip"] for s in self._active_ip_sessions.values()]
            return {
                "allowed": False,
                "message": f"Maximum 3 Concurrent Admin IP Login Limit Reached. Active IPs: {len(self._active_ip_sessions)}/3 ({', '.join(active_ips)}). Please logout from another device.",
                "active_count": len(self._active_ip_sessions),
                "max_limit": 3
            }

        # Register new IP session
        import datetime
        self._active_ip_sessions[client_ip] = {
            "client_ip": client_ip,
            "username": username,
            "login_time": now,
            "last_active": now,
            "login_time_str": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        return {"allowed": True, "message": "IP session successfully registered", "active_count": len(self._active_ip_sessions), "max_limit": 3}

    def terminate_ip_session(self, client_ip: str) -> bool:
        self.init_ip_sessions()
        if client_ip in self._active_ip_sessions:
            del self._active_ip_sessions[client_ip]
            return True
        return False

db_manager = DatabaseManager()
