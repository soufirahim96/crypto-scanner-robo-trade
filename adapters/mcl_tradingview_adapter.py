import time
import requests
import logging
from typing import List, Dict, Any
from adapters.base import BaseBrokerAdapter

logger = logging.getLogger("HaG.MCL_TradingView")

class MCLTradingViewAdapter(BaseBrokerAdapter):
    """
    Free Market Data & Paper Trading Adapter for WTI Micro Crude Oil (MCL).
    Targeting the 3-month contract: January 2027 (MCLF2027 / MCLF27.NYM).
    - 100% Free: Uses TradingView & Yahoo Finance public data feeds with zero API fees.
    - Zero DB foot-print: Keeps candles and temporary paper positions strictly in container memory.
    """
    def __init__(self, contract: str = "MCLF27"):
        self.contract = contract
        self.tv_symbol = f"NYMEX:{contract}2027" if len(contract) <= 6 else contract
        self.yf_symbol = f"{contract}.NYM" if not contract.endswith(".NYM") else contract
        
        # In-memory ephemeral paper trading ledger (never saved to DB)
        self.virtual_balance = 5000.0  # $5,000 USD virtual demo capital
        self.active_position = None     # {"symbol": ..., "side": ..., "size": ..., "entryPrice": ..., "unrealizedProfit": ...}
        self.last_cached_price = 84.19
        self.in_memory_candles = []     # Ephemeral cache in container memory

    def fetch_ticker(self, symbol: str = None) -> Dict[str, Any]:
        """Fetches live / delayed price for January 2027 Micro Crude Oil."""
        # Method 1: Try TradingView scanner endpoint
        try:
            url = "https://scanner.tradingview.com/futures/scan"
            payload = {
                "symbols": {"tickers": [f"NYMEX:MCLF2027", "NYMEX:MCL1!"]},
                "columns": ["close", "change", "high", "low", "volume"]
            }
            r = requests.post(url, json=payload, headers={"User-Agent": "Mozilla/5.0"}, timeout=4)
            if r.status_code == 200:
                data = r.json().get("data", [])
                if data:
                    price = float(data[0].get("d", [])[0] or self.last_cached_price)
                    self.last_cached_price = price
                    return {
                        "symbol": "MCLF2027",
                        "price": price,
                        "change": float(data[0].get("d", [])[1] or 0.0),
                        "high": float(data[0].get("d", [])[2] or price),
                        "low": float(data[0].get("d", [])[3] or price),
                        "volume": float(data[0].get("d", [])[4] or 0.0)
                    }
        except Exception as e:
            logger.debug(f"TradingView ticker fallback: {e}")

        # Method 2: Fallback to Yahoo Finance chart API for MCLF27.NYM
        try:
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{self.yf_symbol}?interval=5m&range=1d"
            r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=4)
            if r.status_code == 200:
                res = r.json()["chart"]["result"][0]["meta"]
                price = float(res.get("regularMarketPrice", self.last_cached_price))
                self.last_cached_price = price
                return {"symbol": "MCLF2027", "price": price}
        except Exception as e:
            logger.debug(f"Yahoo ticker fallback: {e}")

        return {"symbol": "MCLF2027", "price": self.last_cached_price}

    def fetch_orderbook_spread(self, symbol: str = None) -> Dict[str, float]:
        """Estimated bid/ask spread for Micro WTI Crude Oil (typically 1-2 ticks = $0.01-$0.02)."""
        ticker = self.fetch_ticker(symbol)
        price = ticker["price"]
        spread = 0.02  # $0.02 / barrel = 2 ticks
        bid = price - 0.01
        ask = price + 0.01
        spread_pct = spread / price if price > 0 else 0.0002
        return {
            "bid": round(bid, 2),
            "ask": round(ask, 2),
            "spread": spread,
            "spread_pct": spread_pct
        }

    def fetch_candles(self, symbol: str = None, timeframe: str = "5m", limit: int = 50) -> List[List[Any]]:
        """
        Fetches 5m or 10m OHLCV candles without saving anything to the database.
        Returns: List of [timestamp_ms, open, high, low, close, volume]
        """
        # Determine Yahoo interval (5m base)
        yf_sym = self.yf_symbol
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{yf_sym}?interval=5m&range=5d"
        try:
            r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=5)
            if r.status_code == 200:
                result = r.json()["chart"]["result"][0]
                timestamps = result.get("timestamp", [])
                quote = result["indicators"]["quote"][0]
                opens = quote.get("open", [])
                highs = quote.get("high", [])
                lows = quote.get("low", [])
                closes = quote.get("close", [])
                volumes = quote.get("volume", [])

                raw_candles = []
                for i in range(len(timestamps)):
                    if closes[i] is not None:
                        t = timestamps[i] * 1000
                        o = float(opens[i] or closes[i])
                        h = float(highs[i] or closes[i])
                        l = float(lows[i] or closes[i])
                        c = float(closes[i])
                        v = float(volumes[i] or 1.0)
                        raw_candles.append([t, o, h, l, c, v])

                if timeframe == "10m":
                    # Resample pairs of 5m candles into true 10m candles
                    candles_10m = []
                    for i in range(0, len(raw_candles) - 1, 2):
                        c1 = raw_candles[i]
                        c2 = raw_candles[i + 1]
                        candles_10m.append([
                            c1[0],
                            c1[1],
                            max(c1[2], c2[2]),
                            min(c1[3], c2[3]),
                            c2[4],
                            c1[5] + c2[5]
                        ])
                    return candles_10m[-limit:]
                
                return raw_candles[-limit:]
        except Exception as e:
            logger.warning(f"Error fetching free MCL candles: {e}")

        # If network error, return synthetic baseline from last price
        p = self.last_cached_price
        now = int(time.time() * 1000)
        return [[now - (i * 300000), p, p + 0.1, p - 0.1, p, 10.0] for i in range(limit, 0, -1)]

    def get_account_summary(self) -> Dict[str, Any]:
        """Provides in-memory simulated paper trading summary."""
        ticker = self.fetch_ticker()
        cur_price = ticker["price"]

        if self.active_position:
            side = self.active_position["side"]
            entry = self.active_position["entryPrice"]
            size = self.active_position["size"]
            # 1 contract of MCL = 100 barrels. $0.01 move = $1.00 PnL
            diff = (cur_price - entry) if side == "LONG" else (entry - cur_price)
            unrealized = round(diff * 100.0 * size, 2)
            self.active_position["unrealizedProfit"] = unrealized
            self.active_position["currentPrice"] = cur_price

        return {
            "walletBalance": self.virtual_balance,
            "availableBalance": self.virtual_balance - (50.0 * (self.active_position["size"] if self.active_position else 0)),
            "activePosition": self.active_position
        }

    def place_order(self, symbol: str, side: str, qty: float, order_type: str = "MARKET", price: float = None) -> Dict[str, Any]:
        """Simulates placing an order in container memory."""
        ticker = self.fetch_ticker(symbol)
        exec_price = price or ticker["price"]
        order_id = f"SIM-{int(time.time())}"

        self.active_position = {
            "symbol": "MCLF2027",
            "side": side.upper(),
            "size": qty,
            "entryPrice": exec_price,
            "unrealizedProfit": 0.0,
            "leverage": 1  # 1 MCL contract = 100 barrels
        }
        logger.info(f"[SIMULATED PAPER TRADE] {side} {qty} MCLF2027 @ ${exec_price:.2f} (Order #{order_id})")
        return {"status": "FILLED", "orderId": order_id, "price": exec_price, "size": qty}

    def close_position(self, symbol: str = None) -> Dict[str, Any]:
        """Closes active position in memory and updates virtual balance."""
        if not self.active_position:
            return {"status": "NO_POSITION"}

        ticker = self.fetch_ticker()
        cur_price = ticker["price"]
        pnl = self.active_position.get("unrealizedProfit", 0.0)
        self.virtual_balance = round(self.virtual_balance + pnl, 2)
        old_pos = self.active_position
        self.active_position = None

        logger.info(f"[SIMULATED PAPER CLOSE] Closed position with Realized PnL: ${pnl:.2f}. New Balance: ${self.virtual_balance:.2f}")
        return {"status": "CLOSED", "orderId": f"CLOSE-{int(time.time())}", "realized_pnl": pnl}

mcl_adapter = MCLTradingViewAdapter("MCLF27")
