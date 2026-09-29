import json
import logging
from google import genai
from backend.config import config

logger = logging.getLogger("HaG.Brain")

class GeminiBrainPool:
    def __init__(self):
        self.keys = config.GEMINI_API_KEYS
        self.current_index = 0
        self.model_name = "gemini-3.8-flash" # Current production Google AI Studio reasoning model

    def get_current_key(self) -> str:
        return self.keys[self.current_index]

    def rotate_key(self):
        old_idx = self.current_index
        self.current_index = (self.current_index + 1) % len(self.keys)
        logger.warning(f"[FAILOVER] Rotated Gemini Key from #{old_idx + 1} to #{self.current_index + 1}")

    def evaluate_market(self, market_snapshot: dict, model_tier: str = "fast") -> dict:
        """
        Sends the market snapshot to Gemini Brain and returns structured JSON decision.
        - model_tier="superior": Uses Gemini 3.8 Flash (Deep macro reasoning, 10m cycle).
        - model_tier="fast": Uses Gemini 3.7 Flash with fallback cascade (Fast sentry, 5m cycle).
        Rotates automatically across all 7 Google accounts.
        """
        timeframe = market_snapshot.get('timeframe', '5m')
        prompt = f"""
You are HaG (Hermes Autonomous Gemini), an elite institutional scalper AI agent operating on {timeframe} live charts (M5/M10).
Your analysis is strictly based on live chart price action, indicators, and structure (NO news guessing).

MARKET STATE ({timeframe}):
- Symbol: {market_snapshot.get('symbol')}
- Current Price: ${market_snapshot.get('price')}
- 9 EMA (Short-stage candle momentum): {market_snapshot.get('ema9')} (Previous: {market_snapshot.get('ema9_prev')})
- 21 EMA (Long-stage candle baseline): {market_snapshot.get('ema21')} (Previous: {market_snapshot.get('ema21_prev')})
- EMA9/21 Fresh Cross: Cross Above = {market_snapshot.get('cross_above')}, Cross Below = {market_snapshot.get('cross_below')}
- 14 RSI: {market_snapshot.get('rsi')}
- 14 ADX (Average Directional Index): {market_snapshot.get('adx')} (Trending > 23: {market_snapshot.get('adx_trending')})
- Swing Resistance: ${market_snapshot.get('resistance')} (Close Above Resistance: {market_snapshot.get('close_above_resistance')})
- Swing Support: ${market_snapshot.get('support')} (Close Below Support: {market_snapshot.get('close_below_support')})
- Orderbook Spread: {market_snapshot.get('spread_pct', 0.0):.4%}
- Candle Volatility: {'VOLATILE / GEGAR' if market_snapshot.get('candle_gegar') else 'NORMAL'}
- Active Position Holding: {market_snapshot.get('current_position')} (Holding Duration: {market_snapshot.get('holding_hours', 0.0):.1f}h, Floating PnL: ${market_snapshot.get('floating_pnl', 0.0)})

FRAMEWORK AI AGENT RULES:

STAGE 1 : LOGIC EXECUTION
1. Role + Chart:
   - kau adalah scalper bot untuk cari di coin atau future yang ditetapkan di M5/M10. Analysis hanya dari chart live, no news guess.
2. Entry Rules:
   - BUY / LONG: When EMA9 cross ABOVE EMA21 + RSI > 55 + Close ABOVE Resistance.
   - SELL / SHORT: When EMA9 cross BELOW EMA21 + RSI < 45 + Close BELOW Support.
   - Auto execute with Stop Loss 100 ticks, Take Profit 600 ticks.
3. Filter + Risk:
   - Only make an entry if ADX (Average Directional Index) > 23.
   - Avoid entry during high spread (> 0.2%) & candle gegar (volatility spike > 2.5x ATR).
   - Max 1 trade at a time, lot follows 1% risk, close all if floating loss reaches -2% of balance.

STAGE 2 : LOGIC CONFIRMATION & POSITION MANAGEMENT
1. Check if there is an active position entry holding:
   - If already have entry with the same trend: keep / hold the position (skip continuation entries).
   - REVERSAL EXIT: Whenever EMA9 cross with EMA21, exit all current active positions first before running Stage 1 to make a new entry.
   - 4-HOUR TIME EXIT: After every 4 hours (holding duration >= 4.0h), close current active holding so can take profit first.
   - EMERGENCY CUT: Close all if floating loss reaches -2% of balance.
2. If DO NOT have an active entry + EMA9 does not have any new crossing yet with EMA21 recently:
   - If RSI > 55 + Close ABOVE Resistance + ADX > 23 -> make a LONG entry ("BUY").
   - If RSI < 45 + Close BELOW Support + ADX > 23 -> make a SHORT entry ("SELL").
   - Otherwise -> "HOLD".

OUTPUT FORMAT (STRICT JSON ONLY, NO MARKDOWN, NO OTHER TEXT):
{{
  "action": "BUY" | "SELL" | "HOLD" | "CLOSE",
  "confidence": 0.90,
  "reasoning": "Clear concise 1-2 sentence explanation of your market reasoning.",
  "target_price": 4338.0,
  "stop_loss": 4268.0
}}
"""
        # Determine prioritized model list based on tier
        if model_tier == "superior":
            models_to_try = [
                config.SUPERIOR_MODEL_NAME,  # gemini-3.8-flash
                config.FAST_MODEL_NAME,      # gemini-3.7-flash
                "gemini-3.6-flash",
                "gemini-3.5-flash-lite"
            ]
        else:
            models_to_try = [
                config.FAST_MODEL_NAME,      # gemini-3.7-flash
                "gemini-3.6-flash",
                "gemini-3.5-flash-lite"
            ]

        for target_model in models_to_try:
            max_attempts = len(self.keys)
            for _ in range(max_attempts):
                active_key = self.get_current_key()
                client = genai.Client(api_key=active_key)
                try:
                    response = client.models.generate_content(
                        model=target_model,
                        contents=prompt
                    )
                    text = response.text.strip()
                    if text.startswith("```json"):
                        text = text[7:-3].strip()
                    elif text.startswith("```"):
                        text = text[3:-3].strip()
                    
                    decision = json.loads(text)
                    if "3.8" in target_model:
                        tier_label = "3.8 Superior"
                    elif "3.7" in target_model:
                        tier_label = "3.7 Fast"
                    elif "3.6" in target_model:
                        tier_label = "3.6 Sentry"
                    elif "3.5" in target_model:
                        tier_label = "3.5 Lite Sentry"
                    else:
                        tier_label = target_model

                    decision["key_used"] = f"Account #{self.current_index + 1} ({tier_label})"
                    
                    # Round-robin: rotate to next account for subsequent cycle
                    self.rotate_key()
                    return decision
                except Exception as e:
                    err_msg = str(e)
                    if "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg or "503" in err_msg or "UNAVAILABLE" in err_msg:
                        self.rotate_key()
                        continue
                    else:
                        logger.warning(f"Error on Key #{self.current_index + 1} with {target_model}: {err_msg[:80]}")
                        self.rotate_key()
                        continue

        # Fallback if all keys fail
        return {
            "action": "HOLD",
            "confidence": 0.0,
            "reasoning": "All Gemini API keys in pool currently exhausted. Waiting for quota cooldown.",
            "key_used": "NONE"
        }

gemini_brain = GeminiBrainPool()
