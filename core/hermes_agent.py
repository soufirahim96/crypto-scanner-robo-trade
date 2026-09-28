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
        self.last_macro_time = 0.0
        self.position_entry_time = None
        self.position_entry_price = None
        self.position_side = None
        self.position_sl = None
        self.position_tp = None

    async def execute_cycle(self, is_macro: bool = False) -> dict:
        """
        Executes one autonomous cycle:
        - If is_macro=True: Uses M10 chart and Gemini 3.8 Flash (Superior macro reasoning).
        - If is_macro=False: Uses M3 chart and Gemini 3.7 Flash (Fast 3-minute sentry).
        Follows user's Stage 1 & Stage 2 Framework:
        - Stage 1: Buy (EMA9 cross 21 + RSI > 55 + Close > Prev Open). Sell (EMA9 cross 21 + RSI < 45 + Close < Prev Open).
        - Stage 2: Reversal Exit on opposite EMA cross, 4-hour hold limit, or continuation entries.
        """
        symbol = config.TARGET_SYMBOL
        timeframe = config.TIMEFRAME_MACRO if is_macro else config.TIMEFRAME_FAST
        model_tier = "superior" if is_macro else "fast"
        
        # 1. Perception & Features on active timeframe (3m or 10m)
        ticker = binance_adapter.fetch_ticker(symbol)
        candles = binance_adapter.fetch_candles(symbol, timeframe=timeframe, limit=50)
        features = extract_market_features(candles)
        spread_info = binance_adapter.fetch_orderbook_spread(symbol)
        account = binance_adapter.get_account_summary()
        current_pos = account.get("activePosition")
        
        wallet_balance = account.get("walletBalance", 5000.0)
        sl_distance = config.SL_TICKS * config.TICK_VALUE  # 100 * 0.10 = $10.00
        tp_distance = config.TP_TICKS * config.TICK_VALUE  # 600 * 0.10 = $60.00
        
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
            is_ema_cross_reversal = False
            
            # Rule: Close all if floating hits -2%
            if floating_pnl < 0 and floating_loss_pct >= config.MAX_FLOATING_LOSS_PCT:
                force_close = True
                close_reason = f"Emergency cut: Floating loss -{floating_loss_pct*100:.2f}% reached -2% account limit."
                
            # Rule: 4-hour max holding limit exit (take profit first)
            elif holding_hours >= 4.0:
                force_close = True
                close_reason = f"4-Hour holding limit reached ({holding_hours:.1f}h). Closing active position to take profit first."
                
            # Rule: Whenever new EMA9 cross with EMA21 occurs (opposite direction) -> exit active position first before Stage 1
            elif current_pos["side"] == "LONG" and features.get("cross_below"):
                force_close = True
                is_ema_cross_reversal = True
                close_reason = f"New bearish EMA9/21 cross on {timeframe}. Exiting active LONG position first before running Stage 1."
            elif current_pos["side"] == "SHORT" and features.get("cross_above"):
                force_close = True
                is_ema_cross_reversal = True
                close_reason = f"New bullish EMA9/21 cross on {timeframe}. Exiting active SHORT position first before running Stage 1."
                
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
                    key_used=f"HERMES_{timeframe.upper()}"
                )
                log_trade(symbol, "CLOSE", current_pos["size"], ticker["price"], close_res.get("orderId"), "CLOSED", floating_pnl)
                
                # Reset position tracking
                self.position_entry_time = None
                self.position_entry_price = None
                self.position_side = None
                self.position_sl = None
                self.position_tp = None
                
                if is_ema_cross_reversal:
                    # User's Rule: Exit active position first BEFORE running stage 1 to make a new entry!
                    current_pos = None
                    account = binance_adapter.get_account_summary()
                else:
                    return {
                        "timestamp": time.time(),
                        "action": "CLOSE",
                        "reason": close_reason,
                        "account": binance_adapter.get_account_summary()
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
            reason = f"Filter active: Candle gegar detected on {timeframe} (erratic volatility spike > 2.5x ATR). Entry withheld."
            log_thought(symbol, ticker["price"], features.get("rsi", 0.0), features.get("trend", "NEUTRAL"), "HOLD", 0.0, reason, "GEGAR_FILTER")
            return {"timestamp": time.time(), "action": "HOLD", "reason": reason}

        # ----------------------------------------------------
        # BRAIN SYNTHESIS (GEMINI EVALUATION)
        # ----------------------------------------------------
        holding_h = (time.time() - self.position_entry_time) / 3600.0 if (current_pos and self.position_entry_time) else 0.0
        float_pnl = current_pos.get("unrealizedProfit", 0.0) if current_pos else 0.0
        
        market_snapshot = {
            "symbol": symbol,
            "timeframe": timeframe,
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
            "prev_open": features.get("prev_open"),
            "close_above_prev_open": features.get("close_above_prev_open"),
            "close_below_prev_open": features.get("close_below_prev_open"),
            "spread_pct": spread_pct,
            "candle_gegar": features.get("candle_gegar"),
            "current_position": current_pos["side"] if current_pos else "NONE",
            "holding_hours": holding_h,
            "floating_pnl": float_pnl
        }
        
        decision = gemini_brain.evaluate_market(market_snapshot, model_tier=model_tier)
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
            "timeframe": timeframe,
            "tier": model_tier,
            "market": market_snapshot,
            "decision": decision,
            "trade": trade_result,
            "account": account
        }

    async def run_loop(self):
        self.is_running = True
        logger.info(f"HaG Autonomous Agent started. Sentry: {config.FAST_INTERVAL_SECONDS}s (3.7 Flash M3), Strategist: {config.MACRO_INTERVAL_SECONDS}s (3.8 Flash M10).")
        while self.is_running:
            try:
                now = time.time()
                # Priority rule: If 10 minutes have elapsed since last macro evaluation, prioritize Gemini 3.8 Flash!
                if (now - self.last_macro_time) >= config.MACRO_INTERVAL_SECONDS:
                    is_macro = True
                    self.last_macro_time = now
                    logger.info("Executing MACRO cycle with superior model (Gemini 3.8 Flash on M10)...")
                else:
                    is_macro = False
                    logger.info("Executing FAST SENTRY cycle (Gemini 3.7 Flash on M3)...")

                cycle_data = await self.execute_cycle(is_macro=is_macro)
                logger.info(f"Cycle completed [{cycle_data.get('timeframe')} | {cycle_data.get('tier')}]: {cycle_data.get('action') or cycle_data.get('decision', {}).get('action')}")
            except Exception as e:
                logger.error(f"Error in HaG cycle: {e}")
            await asyncio.sleep(config.FAST_INTERVAL_SECONDS)

hermes_agent = HermesTradingAgent()
