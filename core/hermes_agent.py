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
        self.position_entry_time = None
        self.position_entry_price = None
        self.position_side = None
        self.position_sl = None
        self.position_tp = None

    async def execute_cycle(self) -> dict:
        """
        Executes one full autonomous cycle following the 2-Stage Framework:
        Stage 1: Logic Execution (Fresh EMA9/21 cross + RSI + Breakout, 1% risk, 100 SL / 600 TP)
        Stage 2: Logic Confirmation (Position management: 4h exit, -2% stop, reversal exit; or continuation entry)
        """
        symbol = config.TARGET_SYMBOL
        
        # 1. Perception & Features on M10
        ticker = binance_adapter.fetch_ticker(symbol)
        candles = binance_adapter.fetch_candles(symbol, timeframe=config.TIMEFRAME, limit=50)
        features = extract_market_features(candles)
        spread_info = binance_adapter.fetch_orderbook_spread(symbol)
        account = binance_adapter.get_account_summary()
        current_pos = account.get("activePosition")
        
        wallet_balance = account.get("walletBalance", 5000.0)
        sl_distance = config.SL_TICKS * config.TICK_VALUE  # e.g., 100 * 0.10 = $10.00
        tp_distance = config.TP_TICKS * config.TICK_VALUE  # e.g., 600 * 0.10 = $60.00
        
        # Calculate lot size based on 1% balance risk
        risk_capital = wallet_balance * config.RISK_PER_TRADE_PCT
        calc_qty = risk_capital / sl_distance if sl_distance > 0 else 0.01
        max_notional_qty = (wallet_balance * config.LEVERAGE * 0.8) / ticker["price"] if ticker["price"] > 0 else 0.01
        trade_qty = round(max(0.001, min(calc_qty, max_notional_qty)), 3)
        
        # ----------------------------------------------------
        # STAGE 2: ACTIVE POSITION MANAGEMENT (IF IN POSITION)
        # ----------------------------------------------------
        if current_pos:
            if not self.position_entry_time:
                self.position_entry_time = time.time()
            holding_hours = (time.time() - self.position_entry_time) / 3600.0
            floating_pnl = current_pos.get("unrealizedProfit", 0.0)
            floating_loss_pct = (abs(floating_pnl) / wallet_balance) if (floating_pnl < 0 and wallet_balance > 0) else 0.0
            
            force_close = False
            close_reason = ""
            
            # Rule: Close all if floating hits -2%
            if floating_pnl < 0 and floating_loss_pct >= config.MAX_FLOATING_LOSS_PCT:
                force_close = True
                close_reason = f"Emergency cut: Floating loss -{floating_loss_pct*100:.2f}% reached -2% account limit."
                
            # Rule: 4-hour max holding limit exit
            elif holding_hours >= 4.0:
                force_close = True
                close_reason = f"4-Hour holding limit reached ({holding_hours:.1f}h). Closing active position to secure gains."
                
            # Rule: EMA9 cross with EMA21 in opposite direction -> exit active position first
            elif current_pos["side"] == "LONG" and features.get("cross_below"):
                force_close = True
                close_reason = "EMA9 crossed below EMA21. Exiting active LONG position first."
            elif current_pos["side"] == "SHORT" and features.get("cross_above"):
                force_close = True
                close_reason = "EMA9 crossed above EMA21. Exiting active SHORT position first."
                
            # Rule: SL 100 ticks or TP 600 ticks check
            elif self.position_sl and self.position_tp:
                if current_pos["side"] == "LONG":
                    if ticker["price"] <= self.position_sl:
                        force_close = True
                        close_reason = f"Stop Loss (100 ticks) hit at ${ticker['price']} (SL: ${self.position_sl})."
                    elif ticker["price"] >= self.position_tp:
                        force_close = True
                        close_reason = f"Take Profit (600 ticks) hit at ${ticker['price']} (TP: ${self.position_tp})."
                elif current_pos["side"] == "SHORT":
                    if ticker["price"] >= self.position_sl:
                        force_close = True
                        close_reason = f"Stop Loss (100 ticks) hit at ${ticker['price']} (SL: ${self.position_sl})."
                    elif ticker["price"] <= self.position_tp:
                        force_close = True
                        close_reason = f"Take Profit (600 ticks) hit at ${ticker['price']} (TP: ${self.position_tp})."
                        
            if force_close:
                close_res = binance_adapter.close_position(symbol)
                log_thought(
                    symbol=symbol,
                    price=ticker["price"],
                    rsi=features.get("rsi", 0.0),
                    trend=features.get("trend", "NEUTRAL"),
                    action="CLOSE",
                    confidence=1.0,
                    reasoning=close_reason,
                    key_used="HERMES_STAGE_2"
                )
                log_trade(symbol, "CLOSE", current_pos["size"], ticker["price"], close_res.get("orderId"), "CLOSED", floating_pnl)
                
                # Reset position tracking
                self.position_entry_time = None
                self.position_entry_price = None
                self.position_side = None
                self.position_sl = None
                self.position_tp = None
                
                return {
                    "timestamp": time.time(),
                    "action": "CLOSE",
                    "reason": close_reason,
                    "account": account
                }

        # ----------------------------------------------------
        # FILTER CHECKS: SPREAD & CANDLE GEGAR
        # ----------------------------------------------------
        spread_pct = spread_info.get("spread_pct", 0.0)
        if spread_pct > config.MAX_SPREAD_PCT:
            reason = f"Filter active: Orderbook spread is high ({spread_pct:.4%} > {config.MAX_SPREAD_PCT:.4%}). Entry withheld."
            log_thought(symbol, ticker["price"], features.get("rsi", 0.0), features.get("trend", "NEUTRAL"), "HOLD", 0.0, reason, "SPREAD_FILTER")
            return {"timestamp": time.time(), "action": "HOLD", "reason": reason}

        if features.get("candle_gegar"):
            reason = "Filter active: Candle gegar detected (erratic violent volatility spike > 2.5x ATR). Entry withheld."
            log_thought(symbol, ticker["price"], features.get("rsi", 0.0), features.get("trend", "NEUTRAL"), "HOLD", 0.0, reason, "GEGAR_FILTER")
            return {"timestamp": time.time(), "action": "HOLD", "reason": reason}

        # ----------------------------------------------------
        # BRAIN SYNTHESIS (GEMINI EVALUATION)
        # ----------------------------------------------------
        holding_h = (time.time() - self.position_entry_time) / 3600.0 if (current_pos and self.position_entry_time) else 0.0
        float_pnl = current_pos.get("unrealizedProfit", 0.0) if current_pos else 0.0
        
        market_snapshot = {
            "symbol": symbol,
            "price": ticker["price"],
            "ema9": features.get("ema9"),
            "ema21": features.get("ema21"),
            "ema9_prev": features.get("ema9_prev"),
            "ema21_prev": features.get("ema21_prev"),
            "cross_above": features.get("cross_above"),
            "cross_below": features.get("cross_below"),
            "rsi": features.get("rsi"),
            "resistance": features.get("resistance"),
            "support": features.get("support"),
            "close_above_resistance": features.get("close_above_resistance"),
            "close_below_support": features.get("close_below_support"),
            "spread_pct": spread_pct,
            "candle_gegar": features.get("candle_gegar"),
            "current_position": current_pos["side"] if current_pos else "NONE",
            "holding_hours": holding_h,
            "floating_pnl": float_pnl
        }
        
        decision = gemini_brain.evaluate_market(market_snapshot)
        action = decision.get("action", "HOLD")
        confidence = decision.get("confidence", 0.0)
        reasoning = decision.get("reasoning", "")
        key_used = decision.get("key_used", "N/A")
        
        # Log thought
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
        
        # ----------------------------------------------------
        # ACTION EXECUTION (MAX 1 TRADE AT A TIME)
        # ----------------------------------------------------
        trade_result = None
        if action == "BUY" and not current_pos:
            trade_result = binance_adapter.place_order(symbol, "BUY", trade_qty, "MARKET")
            self.position_entry_time = time.time()
            self.position_entry_price = ticker["price"]
            self.position_side = "LONG"
            self.position_sl = round(ticker["price"] - sl_distance, 2)
            self.position_tp = round(ticker["price"] + tp_distance, 2)
            log_trade(symbol, "BUY", trade_qty, ticker["price"], trade_result.get("orderId"), "FILLED")
            
        elif action == "SELL" and not current_pos:
            trade_result = binance_adapter.place_order(symbol, "SELL", trade_qty, "MARKET")
            self.position_entry_time = time.time()
            self.position_entry_price = ticker["price"]
            self.position_side = "SHORT"
            self.position_sl = round(ticker["price"] + sl_distance, 2)
            self.position_tp = round(ticker["price"] - tp_distance, 2)
            log_trade(symbol, "SELL", trade_qty, ticker["price"], trade_result.get("orderId"), "FILLED")
            
        elif action == "CLOSE" and current_pos:
            trade_result = binance_adapter.close_position(symbol)
            log_trade(symbol, "CLOSE", current_pos["size"], ticker["price"], trade_result.get("orderId"), "CLOSED", current_pos.get("unrealizedProfit", 0.0))
            self.position_entry_time = None
            self.position_entry_price = None
            self.position_side = None
            self.position_sl = None
            self.position_tp = None

        return {
            "timestamp": time.time(),
            "market": market_snapshot,
            "decision": decision,
            "trade": trade_result,
            "account": account
        }

    async def run_loop(self):
        self.is_running = True
        logger.info(f"HaG Autonomous Agent started. Monitoring {config.TARGET_SYMBOL} on {config.TIMEFRAME} every {config.EVALUATION_INTERVAL_SECONDS}s.")
        while self.is_running:
            try:
                cycle_data = await self.execute_cycle()
                logger.info(f"Cycle completed: {cycle_data.get('action') or cycle_data.get('decision', {}).get('action')} | {cycle_data.get('reason') or cycle_data.get('decision', {}).get('reasoning')}")
            except Exception as e:
                logger.error(f"Error in HaG cycle: {e}")
            await asyncio.sleep(config.EVALUATION_INTERVAL_SECONDS)

hermes_agent = HermesTradingAgent()
