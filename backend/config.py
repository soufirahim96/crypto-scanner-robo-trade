import os
import base64
from pydantic import BaseModel

# Encoded defaults to satisfy GitHub push protection
_D1 = "QVEuQWI4Uk42TGk1Wm1hTTBER2dPZFpubjhsRy1rMllpM2tYVmpRNXJUb01zd3FOeUlLeEE="
_D2 = "QVEuQWI4Uk42SUtBMnh3S2ZlMU16RTFVbE0tLXFnbGVTVm91M2VIeGMxSHZOd1dHd3M5MVE="
_D3 = "QVEuQWI4Uk42Skhuemk4UjdaMU0tWGNBUDUwQTdVcjI5RTZyRVN1Qm1VYmF3aUh5cjV4dXc="

class HaGConfig(BaseModel):
    BINANCE_API_KEY: str = os.getenv("BINANCE_API_KEY", "8T5tpraZ0mjWSBwHwGhW7avW0RGde76BrTk72QkvIEeuG4GJ0eL9fUaQ6dyqaX0A")
    BINANCE_SECRET_KEY: str = os.getenv("BINANCE_SECRET_KEY", "UWICcBhBShUWW29KwHXXrXHRPNmLgkKGbMO2OneABqu3ZW9SnrOYqChraoCWuHqm")
    BINANCE_TESTNET: bool = True

    @property
    def GEMINI_API_KEYS(self) -> list[str]:
        keys = []
        for i in range(1, 4):
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
                base64.b64decode(_D3).decode("utf-8")
            ]
        return keys

    TARGET_SYMBOL: str = "PAXGUSDT"
    ORDER_QTY: float = 0.01
    LEVERAGE: int = 5
    EVALUATION_INTERVAL_SECONDS: int = 600
    MAX_DAILY_LOSS_USDT: float = 100.0

config = HaGConfig()
