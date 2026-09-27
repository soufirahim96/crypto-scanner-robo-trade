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

    def evaluate_market(self, market_snapshot: dict) -> dict:
        """
        Sends the market snapshot to Gemini Pro/Flash Brain and returns structured JSON decision.
        Automatically handles failover between the 3 accounts on rate limits.
        """
        prompt = f"""
You are HaG (Hermes Autonomous Gemini), an elite institutional scalper AI agent operating on M10 live charts.
Your analysis is strictly based on live chart price action, indicators, and structure (NO news guessing).

MARKET STATE:
- Symbol: {market_snapshot.get('symbol')} on M10 (10-Minute timeframe)
- Current Price: ${market_snapshot.get('price')}
- 9 EMA (Short-stage candle momentum): {market_snapshot.get('ema9')} (Previous: {market_snapshot.get('ema9_prev')})
- 21 EMA (Long-stage candle baseline): {market_snapshot.get('ema21')} (Previous: {market_snapshot.get('ema21_prev')})
- EMA9/21 Fresh Cross: Cross Above = {market_snapshot.get('cross_above')}, Cross Below = {market_snapshot.get('cross_below')}
- 14 RSI: {market_snapshot.get('rsi')}
- Swing Resistance: ${market_snapshot.get('resistance')} (Close Above: {market_snapshot.get('close_above_resistance')})
- Swing Support: ${market_snapshot.get('support')} (Close Below: {market_snapshot.get('close_below_support')})
- Orderbook Spread: {market_snapshot.get('spread_pct', 0.0):.4%}
- Candle Volatility: {'VOLATILE / GEGAR' if market_snapshot.get('candle_gegar') else 'NORMAL'}
- Active Position Holding: {market_snapshot.get('current_position')} (Holding Duration: {market_snapshot.get('holding_hours', 0.0):.1f}h, Floating PnL: ${market_snapshot.get('floating_pnl', 0.0)})

FRAMEWORK RULES:
STAGE 1 (FRESH CROSS ENTRY):
- BUY / LONG: When EMA9 crosses ABOVE EMA21 + RSI > 55 + Close > Resistance.
- SELL / SHORT: When EMA9 crosses BELOW EMA21 + RSI < 45 + Close < Support.
- FILTER: Disqualify entry if spread is high (> 0.2%) or candle is gegar (erratic volatility spike). Max 1 trade at a time.

STAGE 2 (CONFIRMATION & POSITION MANAGEMENT):
1. If holding active position:
   - REVERSAL EXIT: Whenever EMA9 crosses opposite EMA21, CLOSE active position first before making new entry.
   - 4-HOUR TIME EXIT: If holding duration >= 4.0 hours, CLOSE current active holding to lock in profit/reset exposure.
   - EMERGENCY CUT: If floating loss reaches -2% of balance, CLOSE ALL immediately.
2. If NO active position holding AND no fresh cross occurred:
   - LONG CONTINUATION: If EMA9 > EMA21 + RSI > 55 + Close > Resistance -> "BUY".
   - SHORT CONTINUATION: If EMA9 < EMA21 + RSI < 45 + Close < Support -> "SELL".
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
        max_attempts = len(self.keys)
        for attempt in range(max_attempts):
            active_key = self.get_current_key()
            try:
                client = genai.Client(api_key=active_key)
                response = client.models.generate_content(
                    model=self.model_name,
                    contents=prompt
                )
                text = response.text.strip()
                # Clean markdown backticks if present
                if text.startswith("```json"):
                    text = text[7:-3].strip()
                elif text.startswith("```"):
                    text = text[3:-3].strip()
                
                decision = json.loads(text)
                decision["key_used"] = f"Account #{self.current_index + 1}"
                return decision
            except Exception as e:
                logger.error(f"Error querying Gemini with Key #{self.current_index + 1}: {e}")
                self.rotate_key()

        # Fallback if all 3 keys fail
        return {
            "action": "HOLD",
            "confidence": 0.0,
            "reasoning": "All Gemini API keys in pool currently exhausted. Waiting for quota cooldown.",
            "key_used": "NONE"
        }

gemini_brain = GeminiBrainPool()
