import asyncio
import json
import time
import ssl
import logging
from typing import Dict, List, Any, Set
from backend.db import db_manager

# ─────────────────────────────────────────────────────────────────
# BINANCE ENDPOINT PRIORITY CHAINS  (V95.4 — Binance Primary)
# ─────────────────────────────────────────────────────────────────
BINANCE_WS_ENDPOINTS = [
    "wss://data-stream.binance.vision/ws/!miniTicker@arr",  # Global vision mirror (1st try)
    "wss://stream.binance.com:443/ws/!miniTicker@arr",       # Port 443 — firewall-friendly
    "wss://stream.binance.com:9443/ws/!miniTicker@arr",      # Original port 9443
]
BINANCE_REST_ENDPOINTS = [
    "https://data-api.binance.vision/api/v3/ticker/24hr",
    "https://api.binance.com/api/v3/ticker/24hr",
    "https://api1.binance.com/api/v3/ticker/24hr",
    "https://api2.binance.com/api/v3/ticker/24hr",
    "https://api3.binance.com/api/v3/ticker/24hr",
]

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("CryptoScanner")

class CryptoScannerEngine:
    def __init__(self):
        self.running = False
        self.ws = None
        self.ticks_per_second = 0
        self.tick_counter = 0
        self.last_rate_check = time.time()
        self.active_tickers: Dict[str, Dict[str, Any]] = {}
        self.listeners: Set[asyncio.Queue] = set()
        self.batch_queue = asyncio.Queue()
        self.current_source = "Binance (Connecting...)"
        self.ws_connected = False
        self._ws_connect_time = 0.0

    async def start(self):
        """Starts the scanner streaming background task and batch DB writer"""
        if self.running:
            return
        self.running = True
        logger.info("Starting Binance-Primary Scanner V95.4...")
        self._seed_baseline_tickers()
        asyncio.create_task(self._rate_calculator_loop())
        asyncio.create_task(self._db_batch_writer_loop())
        asyncio.create_task(self._binance_ws_primary())     # Primary: WS failover chain
        asyncio.create_task(self._binance_rest_bridge())    # Bridge: REST when WS is down

    def _seed_baseline_tickers(self):
        """Fail-Safe Initializer: Seeds active_tickers from database coins so God Hall & Robo Trade are NEVER empty!"""
        try:
            db_coins = db_manager.get_all_coins()
            now_ms = int(time.time() * 1000)
            baseline_prices = {
                "BTCUSDT": 65420.50, "ETHUSDT": 3480.20, "SOLUSDT": 182.40, "BNBUSDT": 592.10,
                "ADAUSDT": 0.4250, "XRPUSDT": 0.5820, "AVAXUSDT": 28.50, "DOTUSDT": 6.85,
                "LINKUSDT": 14.20, "NEARUSDT": 5.40, "SUIUSDT": 1.25, "APTUSDT": 7.15,
                "FETUSDT": 1.45, "RENDERUSDT": 6.20, "PEPEUSDT": 0.0000095, "SHIBUSDT": 0.0000182,
                "DOGEUSDT": 0.1240, "MATICUSDT": 0.5210, "LTCUSDT": 72.40, "UNIUSDT": 7.85
            }
            for c in db_coins:
                sym = c.get("symbol", "")
                if not sym.endswith("USDT"): continue
                base_p = baseline_prices.get(sym, 12.50 + (hash(sym) % 50))
                chg = round(((hash(sym) % 80 - 35) / 10.0), 2)
                vol = float(12000000 + (hash(sym) % 45000000))
                self.active_tickers[sym] = {
                    "symbol": sym,
                    "exchange": "Baseline (Pending Live Stream)",
                    "is_live": False,  # CRITICAL V95.6: Prevents trading engine from executing on seeded synthetic prices
                    "price": base_p,
                    "open": round(base_p / (1 + chg/100), 4),
                    "high": round(base_p * 1.02, 4),
                    "low": round(base_p * 0.98, 4),
                    "change_pct": chg,
                    "volume": round(vol / base_p, 2),
                    "quote_volume": vol,
                    "timestamp": now_ms
                }
            logger.info(f"Fail-Safe Baseline Ticker Seeder initialized {len(self.active_tickers)} active tickers!")
        except Exception as e:
            logger.error(f"Error in _seed_baseline_tickers: {e}")

    # ─────────────────────────────────────────────────────────────
    # PRIMARY: BINANCE WEBSOCKET — 3-ENDPOINT FAILOVER CHAIN
    # ─────────────────────────────────────────────────────────────
    async def _binance_ws_primary(self):
        """Tries 3 Binance WS endpoints in order with exponential backoff. Reconnects every 23h."""
        try:
            import websockets
        except ImportError:
            logger.error("websockets not installed"); return

        ssl_ctx = ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE

        endpoint_idx = 0
        backoff = 5

        while self.running:
            uri = BINANCE_WS_ENDPOINTS[endpoint_idx % len(BINANCE_WS_ENDPOINTS)]
            logger.info(f"[BinanceWS] Connecting: {uri}  (backoff={backoff}s)")
            try:
                async with websockets.connect(
                    uri, ssl=ssl_ctx,
                    ping_interval=180, ping_timeout=30, open_timeout=15,
                    max_size=10 * 1024 * 1024,
                    extra_headers={"User-Agent": "Mozilla/5.0 CryptoScanner/95.4"}
                ) as ws:
                    self.ws = ws
                    self.ws_connected = True
                    self._ws_connect_time = time.time()
                    backoff = 5
                    logger.info(f"[BinanceWS] Connected: {uri}")
                    self.current_source = "Binance WebSocket (Real-Time)"
                    async for message in ws:
                        if not self.running: break
                        if time.time() - self._ws_connect_time > 23 * 3600:
                            logger.info("[BinanceWS] 23h reconnect"); break
                        await self._process_ws_message(message)
            except Exception as e:
                self.ws_connected = False
                self.ws = None
                err = str(e)
                if any(kw in err for kw in ["418", "429", "Too Many", "banned"]):
                    wait = 300
                    logger.warning(f"[BinanceWS] IP banned/rate-limited, wait {wait}s")
                elif any(kw in err for kw in ["403", "451", "Forbidden", "Unavailable"]):
                    endpoint_idx += 1
                    wait = backoff
                    logger.warning(f"[BinanceWS] Endpoint rejected, trying next in {wait}s")
                else:
                    wait = backoff
                    logger.info(f"[BinanceWS] Disconnected ({err}), retry {wait}s")
                backoff = min(backoff * 2, 120)
                await asyncio.sleep(wait)

    async def _process_ws_message(self, message: str):
        try:
            data = json.loads(message)
            now_ms = int(time.time() * 1000)
            if not isinstance(data, list): return
            for item in data:
                symbol = item.get("s", "")
                if not symbol.endswith("USDT"): continue
                close_price = float(item.get("c", 0.0))
                open_price = float(item.get("o", 0.0))
                if close_price <= 0: continue
                change_pct = round(((close_price - open_price) / open_price) * 100, 2) if open_price > 0 else 0.0
                self.active_tickers[symbol] = {
                    "symbol": symbol, "exchange": "Binance",
                    "is_live": True,  # Real live stream data from Binance WS
                    "price": close_price, "open": open_price,
                    "high": float(item.get("h", close_price)),
                    "low": float(item.get("l", close_price)),
                    "change_pct": change_pct,
                    "volume": float(item.get("v", 0.0)),
                    "quote_volume": float(item.get("q", 0.0)),
                    "timestamp": now_ms
                }
                self.tick_counter += 1
                if self.batch_queue.qsize() < 5000:
                    self.batch_queue.put_nowait({
                        "symbol": symbol, "exchange": "Binance", "price": close_price,
                        "quantity": float(item.get("v", 0.0)),
                        "side": "BUY" if change_pct >= 0 else "SELL",
                        "timestamp": now_ms
                    })
            await self._broadcast_update()
        except Exception as e:
            logger.debug(f"[BinanceWS] Parse error: {e}")

    # ─────────────────────────────────────────────────────────────
    # BRIDGE: BINANCE REST — polls every 3s when WS is down
    # Tries 5 Binance REST mirrors, then HTX as absolute last resort
    # ─────────────────────────────────────────────────────────────
    async def _binance_rest_bridge(self):
        """REST bridge — Binance-first with 5 mirrors, HTX only as last resort"""
        import urllib.request
        while self.running:
            if self.ws_connected:
                await asyncio.sleep(3.0)
                continue
            fetched = False
            for rest_url in BINANCE_REST_ENDPOINTS:
                try:
                    req = urllib.request.Request(rest_url,
                        headers={"User-Agent": "Mozilla/5.0 CryptoScanner/95.4"})
                    res = await asyncio.to_thread(urllib.request.urlopen, req, timeout=5)
                    raw = json.loads(res.read().decode("utf-8"))
                    now_ms = int(time.time() * 1000)
                    count = 0
                    if isinstance(raw, list):
                        for item in raw:
                            sym = item.get("symbol", "")
                            if not sym.endswith("USDT"): continue
                            p = float(item.get("lastPrice", 0.0))
                            if p <= 0: continue
                            op = float(item.get("openPrice", 0.0))
                            chg = float(item.get("priceChangePercent", 0.0))
                            self.active_tickers[sym] = {
                                "symbol": sym, "exchange": "Binance REST",
                                "is_live": True,  # Real live stream data from Binance REST
                                "price": p, "open": op,
                                "high": float(item.get("highPrice", p)),
                                "low": float(item.get("lowPrice", p)),
                                "change_pct": round(chg, 2),
                                "volume": float(item.get("volume", 0.0)),
                                "quote_volume": float(item.get("quoteVolume", 0.0)),
                                "timestamp": now_ms
                            }
                            self.tick_counter += 1
                            count += 1
                    if count > 0:
                        host = rest_url.split("/")[2]
                        self.current_source = f"Binance REST ({host}) [{count} coins]"
                        await self._broadcast_update()
                        fetched = True
                        break
                except Exception as e:
                    logger.debug(f"[REST] {rest_url.split('/')[2]}: {e}")
            if not fetched:
                try:
                    req = urllib.request.Request("https://api.huobi.pro/market/tickers",
                        headers={"User-Agent": "Mozilla/5.0 CryptoScanner/95.4"})
                    res = await asyncio.to_thread(urllib.request.urlopen, req, timeout=5)
                    data = json.loads(res.read().decode("utf-8")).get("data", [])
                    now_ms = int(time.time() * 1000)
                    count = 0
                    for item in data:
                        raw_sym = item.get("symbol", "").upper()
                        if not raw_sym.endswith("USDT"): continue
                        p = float(item.get("close", 0.0))
                        op = float(item.get("open", 0.0))
                        if p <= 0: continue
                        chg = round(((p - op) / op) * 100, 2) if op > 0 else 0.0
                        self.active_tickers[raw_sym] = {
                            "symbol": raw_sym, "exchange": "HTX Fallback",
                            "is_live": True,  # Real live stream data from HTX Fallback
                            "price": p, "open": op,
                            "high": float(item.get("high", p)),
                            "low": float(item.get("low", p)),
                            "change_pct": chg,
                            "volume": float(item.get("amount", 0.0)),
                            "quote_volume": float(item.get("vol", 0.0)),
                            "timestamp": now_ms
                        }
                        self.tick_counter += 1
                        count += 1
                    if count > 0:
                        self.current_source = f"HTX Fallback (Binance WS reconnecting) [{count} coins]"
                        await self._broadcast_update()
                        fetched = True
                except Exception as e:
                    logger.debug(f"[REST] HTX: {e}")
            if not fetched:
                await self._broadcast_update()
            await asyncio.sleep(3.0)

    # STUB: keep references from old code working
    async def _multi_provider_stream_loop(self):
        """
        GEO-RESILIENT MULTI-PROVIDER LIVE DATA ENGINE (V95.3)
        Priority chain:
          1. HTX (Huobi) — Primary: Globally accessible, no geo-block
          2. CoinGecko REST — Secondary: Free tier, no API key needed
          3. CoinPaprika REST — Tertiary: Free, no API key
          4. Binance Vision Mirror — Attempt last (blocked in Malaysia)
        Updates every 2 seconds.
        """
        import urllib.request
        PROVIDERS = [
            ("HTX",         self._fetch_htx),
            ("CoinGecko",   self._fetch_coingecko),
            ("CoinPaprika", self._fetch_coinpaprika),
            ("Binance Vision", self._fetch_binance_vision),
        ]

        while self.running:
            success = False
            for name, fetch_fn in PROVIDERS:
                try:
                    count = await fetch_fn()
                    if count and count > 0:
                        self.current_source = f"{name} Live Stream ({count} Active Coins)"
                        await self._broadcast_update()
                        success = True
                        break
                except Exception as e:
                    logger.debug(f"Provider {name} failed: {e}")

            if not success:
                logger.warning("All providers failed this cycle — using cached baseline data")
                await self._broadcast_update()

            await asyncio.sleep(2.0)

    async def _fetch_htx(self) -> int:
        """Fetch from HTX (Huobi) — Globally accessible, no geo-restriction"""
        import urllib.request
        req = urllib.request.Request(
            "https://api.huobi.pro/market/tickers",
            headers={"User-Agent": "Mozilla/5.0 CryptoScanner/95.3"}
        )
        res = await asyncio.to_thread(urllib.request.urlopen, req, timeout=4)
        data = json.loads(res.read().decode("utf-8")).get("data", [])
        now_ms = int(time.time() * 1000)
        count = 0
        for item in data:
            raw_sym = item.get("symbol", "").upper()
            if not raw_sym.endswith("USDT"):
                continue
            close_price = float(item.get("close", 0.0))
            open_price = float(item.get("open", 0.0))
            if close_price <= 0:
                continue
            change_pct = round(((close_price - open_price) / open_price) * 100, 2) if open_price > 0 else 0.0
            self.active_tickers[raw_sym] = {
                "symbol": raw_sym,
                "exchange": "HTX (Huobi) Live",
                "price": close_price,
                "open": open_price,
                "high": float(item.get("high", close_price)),
                "low": float(item.get("low", close_price)),
                "change_pct": change_pct,
                "volume": float(item.get("amount", 0.0)),
                "quote_volume": float(item.get("vol", 0.0)),
                "timestamp": now_ms
            }
            self.tick_counter += 1
            count += 1
        return count

    async def _fetch_coingecko(self) -> int:
        """Fetch from CoinGecko free public API — No API key, no geo-block"""
        import urllib.request
        url = (
            "https://api.coingecko.com/api/v3/coins/markets"
            "?vs_currency=usd&order=volume_desc&per_page=250&page=1"
            "&sparkline=false&price_change_percentage=24h"
        )
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 CryptoScanner/95.3",
            "Accept": "application/json"
        })
        res = await asyncio.to_thread(urllib.request.urlopen, req, timeout=6)
        data = json.loads(res.read().decode("utf-8"))
        now_ms = int(time.time() * 1000)
        count = 0
        for item in data:
            symbol_raw = item.get("symbol", "").upper()
            sym = symbol_raw + "USDT"
            price = float(item.get("current_price") or 0.0)
            if price <= 0:
                continue
            change_pct = float(item.get("price_change_percentage_24h") or 0.0)
            high = float(item.get("high_24h") or price)
            low = float(item.get("low_24h") or price)
            vol = float(item.get("total_volume") or 0.0)
            self.active_tickers[sym] = {
                "symbol": sym,
                "exchange": "CoinGecko Aggregated",
                "price": price,
                "open": round(price / (1 + change_pct / 100), 6) if change_pct != -100 else price,
                "high": high,
                "low": low,
                "change_pct": round(change_pct, 2),
                "volume": vol / price if price > 0 else 0,
                "quote_volume": vol,
                "timestamp": now_ms
            }
            self.tick_counter += 1
            count += 1
        return count

    async def _fetch_coinpaprika(self) -> int:
        """Fetch from CoinPaprika free public API — No API key, no geo-block"""
        import urllib.request
        req = urllib.request.Request(
            "https://api.coinpaprika.com/v1/tickers?quotes=USD&limit=250",
            headers={"User-Agent": "Mozilla/5.0 CryptoScanner/95.3"}
        )
        res = await asyncio.to_thread(urllib.request.urlopen, req, timeout=5)
        data = json.loads(res.read().decode("utf-8"))
        now_ms = int(time.time() * 1000)
        count = 0
        for item in data:
            symbol_raw = item.get("symbol", "").upper()
            sym = symbol_raw + "USDT"
            quotes = item.get("quotes", {}).get("USD", {})
            price = float(quotes.get("price") or 0.0)
            if price <= 0:
                continue
            change_pct = float(quotes.get("percent_change_24h") or 0.0)
            vol = float(quotes.get("volume_24h") or 0.0)
            self.active_tickers[sym] = {
                "symbol": sym,
                "exchange": "CoinPaprika Aggregated",
                "price": price,
                "open": round(price / (1 + change_pct / 100), 6) if change_pct != -100 else price,
                "high": price * 1.02,
                "low": price * 0.98,
                "change_pct": round(change_pct, 2),
                "volume": vol / price if price > 0 else 0,
                "quote_volume": vol,
                "timestamp": now_ms
            }
            self.tick_counter += 1
            count += 1
        return count

    async def _fetch_binance_vision(self) -> int:
        """Attempt Binance data-api.binance.vision mirror — may fail due to geo-block"""
        import urllib.request
        req = urllib.request.Request(
            "https://data-api.binance.vision/api/v3/ticker/24hr",
            headers={"User-Agent": "Mozilla/5.0 CryptoScanner/95.3"}
        )
        res = await asyncio.to_thread(urllib.request.urlopen, req, timeout=3)
        data = json.loads(res.read().decode("utf-8"))
        now_ms = int(time.time() * 1000)
        count = 0
        if isinstance(data, list):
            for item in data:
                symbol = item.get("symbol", "")
                if not symbol.endswith("USDT"):
                    continue
                close_price = float(item.get("lastPrice", 0.0))
                if close_price <= 0:
                    continue
                open_price = float(item.get("openPrice", 0.0))
                change_pct = float(item.get("priceChangePercent", 0.0))
                self.active_tickers[symbol] = {
                    "symbol": symbol,
                    "exchange": "Binance Live Stream",
                    "price": close_price,
                    "open": open_price,
                    "high": float(item.get("highPrice", close_price)),
                    "low": float(item.get("lowPrice", close_price)),
                    "change_pct": round(change_pct, 2),
                    "volume": float(item.get("volume", 0.0)),
                    "quote_volume": float(item.get("quoteVolume", 0.0)),
                    "timestamp": now_ms
                }
                self.tick_counter += 1
                count += 1
        return count

    async def _binance_ws_optional(self):
        """
        Attempts to connect to Binance WebSocket stream.
        Silently exits if geo-blocked — app will rely on REST fallback chain instead.
        This is non-critical; DO NOT crash or retry aggressively if rejected.
        """
        try:
            import websockets
        except ImportError:
            return

        uri = "wss://stream.binance.com:9443/ws/!miniTicker@arr"
        RETRY_DELAY = 30  # seconds — long delay to avoid hammering a blocked endpoint

        while self.running:
            try:
                logger.info("Attempting optional Binance WebSocket connection...")
                async with websockets.connect(
                    uri,
                    ping_interval=20,
                    ping_timeout=10,
                    open_timeout=8
                ) as ws:
                    self.ws = ws
                    logger.info("Binance WebSocket connected! Real-time tick stream active.")
                    self.current_source = "Binance WebSocket (Real-Time)"
                    async for message in ws:
                        if not self.running:
                            break
                        data = json.loads(message)
                        now_ms = int(time.time() * 1000)
                        if isinstance(data, list):
                            for item in data:
                                symbol = item.get("s", "")
                                if not symbol.endswith("USDT"):
                                    continue
                                close_price = float(item.get("c", 0.0))
                                open_price = float(item.get("o", 0.0))
                                if close_price <= 0:
                                    continue
                                change_pct = round(((close_price - open_price) / open_price) * 100, 2) if open_price > 0 else 0.0
                                self.active_tickers[symbol] = {
                                    "symbol": symbol,
                                    "exchange": "Binance WebSocket",
                                    "price": close_price,
                                    "open": open_price,
                                    "high": float(item.get("h", close_price)),
                                    "low": float(item.get("l", close_price)),
                                    "change_pct": change_pct,
                                    "volume": float(item.get("v", 0.0)),
                                    "quote_volume": float(item.get("q", 0.0)),
                                    "timestamp": now_ms
                                }
                                self.tick_counter += 1
                                tick_record = {
                                    "symbol": symbol,
                                    "exchange": "Binance",
                                    "price": close_price,
                                    "quantity": float(item.get("v", 0.0)),
                                    "side": "BUY" if change_pct >= 0 else "SELL",
                                    "timestamp": now_ms
                                }
                                if self.batch_queue.qsize() < 5000:
                                    self.batch_queue.put_nowait(tick_record)
                        await self._broadcast_update()

            except Exception as e:
                err_msg = str(e).lower()
                if any(kw in err_msg for kw in ["451", "403", "rejected", "forbidden", "geo", "blocked"]):
                    logger.warning(f"Binance WebSocket geo-blocked ({e}). REST fallback chain is active. Not retrying for 5 minutes.")
                    await asyncio.sleep(300)  # Don't hammer a blocked endpoint
                else:
                    logger.debug(f"Binance WebSocket disconnected ({e}). Will retry in {RETRY_DELAY}s...")
                    await asyncio.sleep(RETRY_DELAY)

    async def stop(self):
        self.running = False
        if self.ws:
            await self.ws.close()

    async def register_listener(self) -> asyncio.Queue:
        queue = asyncio.Queue(maxsize=100)
        self.listeners.add(queue)
        return queue

    def unregister_listener(self, queue: asyncio.Queue):
        self.listeners.discard(queue)

    async def _rate_calculator_loop(self):
        while self.running:
            await asyncio.sleep(1.0)
            now = time.time()
            elapsed = now - self.last_rate_check
            if elapsed > 0:
                self.ticks_per_second = int(self.tick_counter / elapsed)
                self.tick_counter = 0
                self.last_rate_check = now

    async def _db_batch_writer_loop(self):
        """High-speed async batch writer to ClickHouse / local time-series DB"""
        batch = []
        while self.running:
            try:
                while len(batch) < 200:
                    try:
                        tick = await asyncio.wait_for(self.batch_queue.get(), timeout=0.05)
                        batch.append(tick)
                    except asyncio.TimeoutError:
                        break
                if batch:
                    await asyncio.to_thread(db_manager.insert_tick_batch, batch)
                    batch.clear()
            except Exception as e:
                logger.error(f"Error in DB Batch Writer: {e}")
                await asyncio.sleep(0.1)

    async def _broadcast_update(self):
        """Broadcasts current top ticker updates to UI WebSocket listeners"""
        if not self.listeners:
            return
        all_tickers = list(self.active_tickers.values())
        all_tickers.sort(key=lambda x: x["quote_volume"], reverse=True)
        top_tickers = all_tickers[:50]
        payload = json.dumps({
            "type": "ticker_update",
            "source": self.current_source,
            "ticks_per_sec": self.ticks_per_second,
            "total_tickers": len(self.active_tickers),
            "data": top_tickers
        })
        dead_listeners = set()
        for queue in list(self.listeners):
            try:
                if queue.full():
                    try:
                        queue.get_nowait()
                    except asyncio.QueueEmpty:
                        pass
                queue.put_nowait(payload)
            except Exception:
                dead_listeners.add(queue)
        for dl in dead_listeners:
            self.listeners.discard(dl)

    def get_all_tickers(self) -> List[Dict[str, Any]]:
        return list(self.active_tickers.values())

    def get_stats(self) -> Dict[str, Any]:
        return {
            "source": self.current_source,
            "connection_type": "Binance WebSocket + REST Bridge Failover (V95.4)",
            "ws_connected": self.ws_connected,
            "ticks_per_second": self.ticks_per_second,
            "total_tracked_symbols": len(self.active_tickers),
            "batch_queue_size": self.batch_queue.qsize()
        }

scanner_engine = CryptoScannerEngine()
