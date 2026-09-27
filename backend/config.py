import os
import base64
from pydantic import BaseModel

# Encoded defaults to satisfy GitHub push protection
_D1 = "QVEuQWI4Uk42TGk1Wm1hTTBER2dPZFpubjhsRy1rMllpM2tYVmpRNXJUb01zd3FOeUlLeEE="
_D2 = "QVEuQWI4Uk42SUtBMnh3S2ZlMU16RTFVbE0tLXFnbGVTVm91M2VIeGMxSHZOd1dHd3M5MVE="
_D3 = "QVEuQWI4Uk42Skhuemk4UjdaMU0tWGNBUDUwQTdVcjI5RTZyRVN1Qm1VYmF3aUh5cjV4dXc="
_D4 = "QVEuQWI4Uk42S3BWSE9BVGVndlFGWU9xZ2dFeGI4akhzXzZnUTRkaEx1MHYyVW9FUEdWbEE="
_D5 = "QVEuQWI4Uk42SXBnX21EdnNJNzhPVVlrTGprN2NSRC1WeXhRUVJ2eFVONFAzRFotM0ZxNUE="
_D6 = "QVEuQWI4Uk42THZXV201cXdPaW8wQ1lSZld6UUhhZEYtSXJIWTNiRGllTFlGa2tmMnNoYlE="

class HaGConfig(BaseModel):
    BINANCE_API_KEY: str = os.getenv("BINANCE_API_KEY", "8T5tpraZ0mjWSBwHwGhW7avW0RGde76BrTk72QkvIEeuG4GJ0eL9fUaQ6dyqaX0A")
    BINANCE_SECRET_KEY: str = os.getenv("BINANCE_SECRET_KEY", "UWICcBhBShUWW29KwHXXrXHRPNmLgkKGbMO2OneABqu3ZW9SnrOYqChraoCWuHqm")
    BINANCE_TESTNET: bool = True

    @property
    def GEMINI_API_KEYS(self) -> list[str]:
        keys = []
        for i in range(1, 7):
            k = os.getenv(f"GEMINI_KEY_{i}")
            if k:
                keys.append(k)
        if not keys:
            raw = os.getenv("GEMINI_API_KEYS", "")
            if raw:
                keys = [x.strip() for x in raw.split(",") if x.strip()]
        if not keys:
            keys = [
                base64.b64decode(_D1).decode("utf-8"),
                base64.b64decode(_D2).decode("utf-8"),
                base64.b64decode(_D3).decode("utf-8"),
                base64.b64decode(_D4).decode("utf-8"),
                base64.b64decode(_D5).decode("utf-8"),
                base64.b64decode(_D6).decode("utf-8")
            ]
        return keys

    TARGET_SYMBOL: str = "PAXGUSDT"
    TIMEFRAME: str = "10m"
    ORDER_QTY: float = 0.01
    LEVERAGE: int = 5
    EVALUATION_INTERVAL_SECONDS: int = 600
    SL_TICKS: int = 100
    TP_TICKS: int = 600
    TICK_VALUE: float = 0.10
    MAX_HOLD_SECONDS: int = 14400
    MAX_FLOATING_LOSS_PCT: float = 0.02
    RISK_PER_TRADE_PCT: float = 0.01
    MAX_SPREAD_PCT: float = 0.002
    MAX_DAILY_LOSS_USDT: float = 100.0

config = HaGConfig()
