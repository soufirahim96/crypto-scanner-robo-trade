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
        - model_tier="fast": Uses Gemini 3.7 Flash with fallback to Flash-Lite (Fast sentry, 3m cycle).
        Rotates automatically across all 7 Google accounts.
        """
        timeframe = market_snapshot.get('timeframe', '3m')
        prompt = f"""
You are HaG (Hermes Autonomous Gemini), an elite institutional scalper AI agent operating on {timeframe} live charts.
Your analysis is strictly based on live chart price action, indicators, and structure (NO news guessing).

MARKET STATE ({timeframe}):
- Symbol: {market_snapshot.get('symbol')}
- Current Price: ${market_snapshot.get('price')}
- 9 EMA (Short-stage candle momentum): {market_snapshot.get('ema9')} (Previous: {market_snapshot.get('ema9_prev')})
- 21 EMA (Long-stage candle baseline): {market_snapshot.get('ema21')} (Previous: {market_snapshot.get('ema21_prev')})
- EMA9/21 Fresh Cross: Cross Above = {market_snapshot.get('cross_above')}, Cross Below = {market_snapshot.get('cross_below')}
- 14 RSI: {market_snapshot.get('rsi')}
- Previous Candle Open: ${market_snapshot.get('prev_open')}
- Close Above Prev Open: {market_snapshot.get('close_above_prev_open')}
- Close Below Prev Open: {market_snapshot.get('close_below_prev_open')}
- Orderbook Spread: {market_snapshot.get('spread_pct', 0.0):.4%}
- Candle Volatility: {'VOLATILE / GEGAR' if market_snapshot.get('candle_gegar') else 'NORMAL'}
- Active Position: {market_snapshot.get('current_position')} (Holding Duration: {market_snapshot.get('holding_hours', 0.0):.1f}h, Floating PnL: ${market_snapshot.get('floating_pnl', 0.0)})

FRAMEWORK RULES:
STAGE 1 (FRESH CROSS ENTRY):
- BUY / LONG: When EMA9 crosses ABOVE EMA21 + RSI > 55 + Current Candle Close > Previous Candle Opening.
- SELL / SHORT: When EMA9 crosses BELOW EMA21 + RSI < 45 + Current Candle Close < Previous Candle Opening.
- Auto execute with Stop Loss 100 ticks, Take Profit 600 ticks.
- FILTER: Disqualify entry if spread is high (> 0.2%) or candle is gegar (erratic volatility spike). Max 1 trade at a time.

STAGE 2 (CONFIRMATION & POSITION MANAGEMENT):
1. If holding active position:
   - REVERSAL EXIT: Whenever a new EMA9 cross with EMA21 occurs (opposite direction), EXIT ALL active positions first before Stage 1.
   - 4-HOUR TIME EXIT: If holding duration >= 4.0 hours, CLOSE current active holding to secure gains/free margin.
   - EMERGENCY CUT: If floating loss reaches -2% of balance, CLOSE ALL immediately.
2. If NO active position holding AND no fresh cross occurred:
   - LONG CONTINUATION: If EMA9 > EMA21 + RSI > 55 + Current Candle Close > Previous Candle Opening -> "BUY".
   - SHORT CONTINUATION: If EMA9 < EMA21 + RSI < 45 + Current Candle Close < Previous Candle Opening -> "SELL".
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
