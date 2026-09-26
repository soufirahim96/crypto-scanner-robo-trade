import time
import logging
import asyncio
from backend.config import config
from core.strategy_logic import extract_market_features
from core.gemini_brain import gemini_brain
from core.journal import log_thought, log_trade
from adapters.binance_adapter import binance_adapter

logger = logging.getLogger("HaG.Agent")

class HermesTradingAgent:
    def __init__(self):
        self.is_running = False
        self.last_cycle_time = 0.0

    async def execute_cycle(self) -> dict:
        """
        Executes one full autonomous cycle:
        1. Perception: Ingest live price & candles
        2. Feature Extraction: Compute EMA, RSI, High/Low
        3. Brain Synthesis: Ask Gemini Key Pool for structured decision
        4. Execution: Place or close simulated position
        5. Journaling: Store thoughts, decisions, and P&L permanently
        """
        symbol = config.TARGET_SYMBOL
        
        # 1. Perception & Features
        ticker = binance_adapter.fetch_ticker(symbol)
        candles = binance_adapter.fetch_candles(symbol, timeframe="5m", limit=30)
        features = extract_market_features(candles)
        
        account = binance_adapter.get_account_summary()
        current_pos = account.get("activePosition")
        
        market_snapshot = {
            "symbol": symbol,
            "price": ticker["price"],
            "ema20": features.get("ema20"),
            "ema50": features.get("ema50"),
            "rsi": features.get("rsi"),
            "high24h": features.get("high24h"),
            "low24h": features.get("low24h"),
            "current_position": current_pos["side"] if current_pos else "NONE"
        }
        
        # 2. Brain Synthesis (Gemini Pro/Flash Reasoning)
        decision = gemini_brain.evaluate_market(market_snapshot)
        action = decision.get("action", "HOLD")
        confidence = decision.get("confidence", 0.0)
        reasoning = decision.get("reasoning", "")
        key_used = decision.get("key_used", "N/A")
        
        # 3. Log Thought Journey
        log_thought(
            symbol=symbol,
            price=ticker["price"],
            rsi=features.get("rsi", 0.0),
            trend=features.get("trend", "UNKNOWN"),
            action=action,
            confidence=confidence,
            reasoning=reasoning,
            key_used=key_used
        )
        
        # 4. Action Execution
        trade_result = None
        if action == "BUY" and not current_pos:
            trade_result = binance_adapter.place_order(symbol, "BUY", config.ORDER_QTY, "MARKET")
            log_trade(symbol, "BUY", config.ORDER_QTY, ticker["price"], trade_result.get("orderId"), "FILLED")
        elif action == "SELL" and not current_pos:
            trade_result = binance_adapter.place_order(symbol, "SELL", config.ORDER_QTY, "MARKET")
            log_trade(symbol, "SELL", config.ORDER_QTY, ticker["price"], trade_result.get("orderId"), "FILLED")
        elif action == "CLOSE" and current_pos:
            trade_result = binance_adapter.close_position(symbol)
            log_trade(symbol, "CLOSE", current_pos["size"], ticker["price"], trade_result.get("orderId"), "CLOSED", current_pos.get("unrealizedProfit", 0.0))

        return {
            "timestamp": time.time(),
            "market": market_snapshot,
            "decision": decision,
            "trade": trade_result,
            "account": account
        }

    async def run_loop(self):
        self.is_running = True
        logger.info(f"HaG Autonomous Agent started. Monitoring {config.TARGET_SYMBOL} every {config.EVALUATION_INTERVAL_SECONDS}s.")
        while self.is_running:
            try:
                cycle_data = await self.execute_cycle()
                logger.info(f"Cycle completed: {cycle_data['decision']['action']} | {cycle_data['decision']['reasoning']}")
            except Exception as e:
                logger.error(f"Error in HaG cycle: {e}")
            await asyncio.sleep(config.EVALUATION_INTERVAL_SECONDS)

hermes_agent = HermesTradingAgent()
