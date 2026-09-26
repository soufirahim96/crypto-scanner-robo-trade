import ccxt
import logging
from typing import List, Dict, Any
from adapters.base import BaseBrokerAdapter
from backend.config import config

logger = logging.getLogger("HaG.Binance")

class BinanceTestnetAdapter(BaseBrokerAdapter):
    def __init__(self):
        self.exchange = ccxt.binance({
            "apiKey": config.BINANCE_API_KEY,
            "secret": config.BINANCE_SECRET_KEY,
            "options": {"defaultType": "future"},
            "urls": {
                "api": {
                    "fapiPublic": "https://testnet.binancefuture.com/fapi/v1",
                    "fapiPrivate": "https://testnet.binancefuture.com/fapi/v1",
                    "fapiPrivateV2": "https://testnet.binancefuture.com/fapi/v2"
                }
            }
        })
        self._init_settings()

    def _init_settings(self):
        try:
            self.exchange.fapiPrivatePostLeverage({
                "symbol": config.TARGET_SYMBOL,
                "leverage": config.LEVERAGE
            })
            logger.info(f"Leverage set to {config.LEVERAGE}x for {config.TARGET_SYMBOL}")
        except Exception as e:
            logger.warning(f"Could not adjust leverage: {e}")

    def fetch_ticker(self, symbol: str) -> Dict[str, Any]:
        # Format symbol for testnet
        sym = symbol.replace("/", "")
        data = self.exchange.fapiPublicGetTickerPrice({"symbol": sym})
        return {
            "symbol": symbol,
            "price": float(data.get("price", 0.0))
        }

    def fetch_candles(self, symbol: str, timeframe: str = "5m", limit: int = 50) -> List[List[Any]]:
        sym = symbol.replace("/", "")
        klines = self.exchange.fapiPublicGetKlines({
            "symbol": sym,
            "interval": timeframe,
            "limit": limit
        })
        return klines

    def get_account_summary(self) -> Dict[str, Any]:
        account = self.exchange.fapiPrivateV2GetAccount()
        positions = account.get("positions", [])
        active_pos = None
        for p in positions:
            if p.get("symbol") == config.TARGET_SYMBOL:
                amt = float(p.get("positionAmt", 0.0))
                if amt != 0:
                    active_pos = {
                        "symbol": p.get("symbol"),
                        "side": "LONG" if amt > 0 else "SHORT",
                        "size": abs(amt),
                        "entryPrice": float(p.get("entryPrice", 0.0)),
                        "unrealizedProfit": float(p.get("unrealizedProfit", 0.0)),
                        "leverage": int(p.get("leverage", 1))
                    }
                break

        return {
            "walletBalance": float(account.get("totalWalletBalance", 0.0)),
            "availableBalance": float(account.get("availableBalance", 0.0)),
            "activePosition": active_pos
        }

    def place_order(self, symbol: str, side: str, qty: float, order_type: str = "MARKET", price: float = None) -> Dict[str, Any]:
        sym = symbol.replace("/", "")
        params = {
            "symbol": sym,
            "side": side.upper(),
            "type": order_type.upper(),
            "quantity": qty
        }
        if order_type.upper() == "LIMIT" and price:
            params["price"] = price
            params["timeInForce"] = "GTC"
            
        res = self.exchange.fapiPrivatePostOrder(params)
        return {
            "orderId": res.get("orderId"),
            "symbol": symbol,
            "side": side,
            "status": res.get("status"),
            "price": float(res.get("price", price or 0.0)),
            "qty": qty
        }

    def close_position(self, symbol: str) -> Dict[str, Any]:
        summary = self.get_account_summary()
        pos = summary.get("activePosition")
        if not pos:
            return {"status": "NO_POSITION_TO_CLOSE"}
            
        close_side = "SELL" if pos["side"] == "LONG" else "BUY"
        return self.place_order(symbol, close_side, pos["size"], "MARKET")

binance_adapter = BinanceTestnetAdapter()
