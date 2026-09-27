from typing import List, Dict, Any

def calculate_ema(prices: List[float], period: int) -> float:
    if len(prices) < period:
        return prices[-1] if prices else 0.0
    multiplier = 2 / (period + 1)
    ema = sum(prices[:period]) / period
    for price in prices[period:]:
        ema = (price - ema) * multiplier + ema
    return round(ema, 2)

def calculate_rsi(prices: List[float], period: int = 14) -> float:
    if len(prices) < period + 1:
        return 50.0
    gains = []
    losses = []
    for i in range(1, len(prices)):
        change = prices[i] - prices[i - 1]
        if change > 0:
            gains.append(change)
            losses.append(0.0)
        else:
            gains.append(0.0)
            losses.append(abs(change))
            
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    
    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100.0 - (100.0 / (1.0 + rs)), 2)

def extract_market_features(candles: List[List[Any]]) -> Dict[str, Any]:
    """
    Standardizes raw OHLCV candles into actionable market features.
    Candle format: [timestamp, open, high, low, close, volume]
    """
    if not candles:
        return {}
        
    closes = [float(c[4]) for c in candles]
    highs = [float(c[2]) for c in candles]
    lows = [float(c[3]) for c in candles]
    
    current_price = closes[-1]
    ema9 = calculate_ema(closes, 9)
    ema21 = calculate_ema(closes, 21)
    rsi = calculate_rsi(closes, 14)
    
    trend = "NEUTRAL"
    if current_price > ema9 > ema21:
        trend = "BULLISH_UPTREND"
    elif current_price < ema9 < ema21:
        trend = "BEARISH_DOWNTREND"
        
    return {
        "price": current_price,
        "ema9": ema9,
        "ema21": ema21,
        "rsi": rsi,
        "high24h": max(highs[-24:]) if len(highs) >= 24 else max(highs),
        "low24h": min(lows[-24:]) if len(lows) >= 24 else min(lows),
        "trend": trend
    }
