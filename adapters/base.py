from abc import ABC, abstractmethod
from typing import List, Dict, Any

class BaseBrokerAdapter(ABC):
    @abstractmethod
    def fetch_ticker(self, symbol: str) -> Dict[str, Any]:
        pass

    @abstractmethod
    def fetch_candles(self, symbol: str, timeframe: str = "5m", limit: int = 50) -> List[List[Any]]:
        pass

    @abstractmethod
    def get_account_summary(self) -> Dict[str, Any]:
        pass

    @abstractmethod
    def place_order(self, symbol: str, side: str, qty: float, order_type: str = "MARKET", price: float = None) -> Dict[str, Any]:
        pass

    @abstractmethod
    def close_position(self, symbol: str) -> Dict[str, Any]:
        pass
