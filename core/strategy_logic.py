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

def calculate_atr(candles: List[List[Any]], period: int = 14) -> float:
    if len(candles) < 2:
        return 1.0
    tr_list = []
    for i in range(1, len(candles)):
        h = float(candles[i][2])
        l = float(candles[i][3])
        prev_c = float(candles[i-1][4])
        tr = max(h - l, abs(h - prev_c), abs(l - prev_c))
        tr_list.append(tr)
    if not tr_list:
        return 1.0
    return sum(tr_list[-period:]) / min(len(tr_list), period)

def extract_market_features(candles: List[List[Any]]) -> Dict[str, Any]:
    """
    Standardizes raw OHLCV candles into actionable market features for the 2-Stage Framework.
    Candle format: [timestamp, open, high, low, close, volume]
    """
    if not candles or len(candles) < 10:
        return {}
        
    closes = [float(c[4]) for c in candles]
    highs = [float(c[2]) for c in candles]
    lows = [float(c[3]) for c in candles]
    
    current_price = closes[-1]
    ema9 = calculate_ema(closes, 9)
    ema21 = calculate_ema(closes, 21)
    
    # Previous candle EMAs to detect fresh cross
    ema9_prev = calculate_ema(closes[:-1], 9) if len(closes) > 1 else ema9
    ema21_prev = calculate_ema(closes[:-1], 21) if len(closes) > 1 else ema21
    
    cross_above = (ema9_prev <= ema21_prev) and (ema9 > ema21)
    cross_below = (ema9_prev >= ema21_prev) and (ema9 < ema21)
    
    rsi = calculate_rsi(closes, 14)
    
    # Swing Support & Resistance over preceding 14 candles (excluding current active candle)
    lookback = min(14, len(candles) - 1)
    if lookback > 0:
        resistance = max(highs[-lookback-1:-1])
        support = min(lows[-lookback-1:-1])
    else:
        resistance = highs[-1]
        support = lows[-1]
        
    close_above_resistance = current_price > resistance
    close_below_support = current_price < support
    
    # Candle Gegar Filter (Violent candle range > 2.5x ATR)
    atr = calculate_atr(candles, 14)
    current_candle_range = highs[-1] - lows[-1]
    candle_gegar = current_candle_range > (2.5 * atr) if atr > 0 else False
    
    trend = "NEUTRAL"
    if current_price > ema9 > ema21:
        trend = "BULLISH_UPTREND"
    elif current_price < ema9 < ema21:
        trend = "BEARISH_DOWNTREND"
        
    return {
        "price": current_price,
        "ema9": ema9,
        "ema21": ema21,
        "ema9_prev": ema9_prev,
        "ema21_prev": ema21_prev,
        "cross_above": cross_above,
        "cross_below": cross_below,
        "rsi": rsi,
        "resistance": round(resistance, 2),
        "support": round(support, 2),
        "close_above_resistance": close_above_resistance,
        "close_below_support": close_below_support,
        "candle_gegar": candle_gegar,
        "high24h": max(highs[-24:]) if len(highs) >= 24 else max(highs),
        "low24h": min(lows[-24:]) if len(lows) >= 24 else min(lows),
        "trend": trend
    }
