import os
from pydantic import BaseModel

class HaGConfig(BaseModel):
    BINANCE_API_KEY: str = os.getenv("BINANCE_API_KEY", "")
    BINANCE_SECRET_KEY: str = os.getenv("BINANCE_SECRET_KEY", "")
    BINANCE_TESTNET: bool = True

    # Reads keys dynamically from environment variables
    @property
    def GEMINI_API_KEYS(self) -> list[str]:
        keys = []
        for i in range(1, 4):
            k = os.getenv(f"GEMINI_KEY_{i}")
            if k:
                keys.append(k)
        if not keys:
            # Fallback if provided in single env var comma-separated
            raw = os.getenv("GEMINI_API_KEYS", "")
            keys = [x.strip() for x in raw.split(",") if x.strip()]
        return keys

    TARGET_SYMBOL: str = "PAXGUSDT"
    ORDER_QTY: float = 0.01
    LEVERAGE: int = 5
    EVALUATION_INTERVAL_SECONDS: int = 60
    MAX_DAILY_LOSS_USDT: float = 100.0

config = HaGConfig()
