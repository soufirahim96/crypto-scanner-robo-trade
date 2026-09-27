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
You are HaG (Hermes Autonomous Gemini), an institutional commodity and futures trading brain.
Analyze the following live market state and provide a precision trading decision.

MARKET STATE:
- Symbol: {market_snapshot.get('symbol')}
- Current Price: ${market_snapshot.get('price')}
- 9 EMA (Short-stage candle momentum): {market_snapshot.get('ema9')}
- 21 EMA (Long-stage candle verification baseline): {market_snapshot.get('ema21')}
- 14 RSI: {market_snapshot.get('rsi')}
- 24h High: {market_snapshot.get('high24h')}
- 24h Low: {market_snapshot.get('low24h')}
- Current Position: {market_snapshot.get('current_position')}

RULES:
1. BUY/LONG: When short stage candle momentum is Bullish (Price > 9 EMA) verified by long stage trend (9 EMA > 21 EMA), and RSI is not overbought (< 65).
2. SELL/SHORT: When short stage candle momentum is Bearish (Price < 9 EMA) verified by long stage trend (9 EMA < 21 EMA), and RSI is not oversold (> 35).
3. CLOSE: If holding a position and short stage momentum breaks (Price crosses back over 9 EMA, or 9 EMA crosses 21 EMA).
4. HOLD: If market is consolidating, choppy, or inside an unconfirmed transition range.

OUTPUT FORMAT (STRICT JSON ONLY, NO MARKDOWN, NO OTHER TEXT):
{{
  "action": "BUY" | "SELL" | "HOLD" | "CLOSE",
  "confidence": 0.85,
  "reasoning": "Clear concise 1-2 sentence explanation of your market reasoning.",
  "target_price": 2650.0,
  "stop_loss": 2635.0
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
