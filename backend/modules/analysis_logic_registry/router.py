# VERSION 79: ANALYSIS LOGIC REGISTRY ROUTER (7-STAGE 3-REGIME SWITCHING PROTOCOL & BREAKEVEN TRAILING ENGINE)
from fastapi import APIRouter

router = APIRouter(prefix="/api/ai", tags=["Analysis Logic Registry"])

analysis_rules_db = [
    {
        "id": "STAGE-1-WFO",
        "logic_name": "Stage 1: Backtest Result Analysis & Out-of-Sample Rolling Parameter Optimization",
        "target_scope": "Historical Parameter Optimization Across 3 Regimes",
        "assigned_agent": "🤖 Group E Sentinel & Backtest Engine",
        "rule_type": "Walk-Forward Parameter Optimization",
        "description": "Optimizes FVG min size (Bull: max(0.35%, 1.5x ATR_14), Bear: max(0.40%, 1.8x ATR_14), Side: max(0.20%, 1.0x ATR_14)), 50-candle liquidity sweep lookbacks (20 for Sideways), and Open Interest delta requirements (+5% Bull, +8% Bear, +3% Side) over 6-month windows with 1-month out-of-sample forward testing."
    },
    {
        "id": "STAGE-2-MACRO",
        "logic_name": "Stage 2: Macro & Asset Screening (Daily & 4H Layer 1 Confluence)",
        "target_scope": "Macro Trend, 4H EMA & Relative Strength Filter",
        "assigned_agent": "🤖 Macro Sentinel & Liquidity Guard",
        "rule_type": "3-Regime Relative Screening & $5M Volume Filter",
        "description": "Filters non-meme/currency coins ($5M+ 24h volume). Bullish: RS_Bull = %ΔCoin_24h / %ΔBTC_24h > 1.15 AND Price > EMA_50_4H. Bearish: RW_Bear = %ΔCoin_24h / %ΔBTC_24h < 0.85 AND Price < EMA_50_4H. Sideways: Band_Width_Side <= 0.05 (5% compression)."
    },
    {
        "id": "STAGE-3-WYCKOFF",
        "logic_name": "Stage 3: Structural Wholesale Level Mapping & ATR Volatility Exits (Layer 2 Confluence)",
        "target_scope": "4H Wholesale Zones, 1H Wyckoff Sweeps & ATR Targets",
        "assigned_agent": "👑 Supreme God AI & Wyckoff Auditor",
        "rule_type": "Wyckoff Phase C & Volatility ATR Exits",
        "description": "Bullish: Discount Zone (<= 50% Fib) + 4H Bull OB + 1H Wyckoff Spring. Bearish: Premium Zone (>= 50% Fib) + 4H Bear OB + 1H Wyckoff UTAD. Sideways: Vault Low min(Low_50_4H) & Vault High max(High_50_4H). Dynamic Targets: TP = Entry +/- (2.5x ATR_1H), SL = Entry -/+ (1.2x ATR_1H)."
    },
    {
        "id": "STAGE-4A-CHOCH",
        "logic_name": "Stage 4A: Protection Feature 1 - 5-Minute CHoCH Circuit Breaker Shield",
        "target_scope": "5M Micro-Structure Breakdown Protection",
        "assigned_agent": "🛡️ 5M Structure Sentinel & Risk Guard",
        "rule_type": "5M CHoCH Hard Veto Shield",
        "description": "Detects 5M Higher Low violation (Close_5M < Swing_Low_5M) with 1.5x ATR_5M body displacement. Triggers Hard Veto (Score = 0.0, Entry Blocked). Minor wicks without body close trigger Soft Penalty (-2.0 Pts)."
    },
    {
        "id": "STAGE-4B-VOLUME",
        "logic_name": "Stage 4B: Protection Feature 2 - 6-Candle 5M Heavy Volume Spike Guard",
        "target_scope": "30-Minute Institutional Dumping Guard",
        "assigned_agent": "⚡ Orderbook Flow Sentinel",
        "rule_type": "30-Min Volume Ratio Hard Veto",
        "description": "Calculates Volume Ratio = 6-Candle 30-Min Volume / (6 * SMA_20 Volume). If Red Sell Volume Ratio > 2.0 (200%+ sell spike), triggers Hard Veto (Score = 0.0, Entry Blocked)."
    },
    {
        "id": "STAGE-5-ORDERFLOW",
        "logic_name": "Stage 5: Order Flow & LTF Execution Trigger (Layer 3 Confluence)",
        "target_scope": "15M & 5M Order Flow Execution",
        "assigned_agent": "⚡ Group C OB Lead & Flow Auditor",
        "rule_type": "Derivatives & Spot CVD Execution Trigger",
        "description": "Evaluates 15M SSL/BSL Sweep (+2.5), Spot CVD Absorption/Distribution (+2.5), Funding Rate (< 0% / > +0.05%) (+2.0), 15M BOS/CHoCH (+1.5), and 15M FVG Retest (+1.5)."
    },
    {
        "id": "STAGE-6-SCORING",
        "logic_name": "Stage 6: 10.0-Point Score Matrix, 2-Min Timer 5-Coin Schedule Plan & Grade S Scaling",
        "target_scope": "10-Point Scoring, 2-Min Re-Analysis & Position Protection",
        "assigned_agent": "👑 God AI & Risk Evaluator",
        "rule_type": "Scoring Matrix, 2-Min Timer Schedule & Invalidation Exit",
        "description": "Requires Score >= 8.5 Points & Veto == False. Maintained 5-Coin Schedule Entry Plan in sidebar menu even with 5 holdings open, re-analyzing every 2 minutes (120s timer). Prioritizes highest points and Grade S (>= 9.5 Pts) FVG scale-in entries for God Mode AI. Re-evaluates active holdings every 10s: if score drops < 8.5 Pts or Veto == True, immediately exits and closes transaction."
    },
    {
        "id": "STAGE-7-COUNCIL",
        "logic_name": "Stage 7: 5-Loop AI Council Verification & Dynamic Breakeven Trailing Engine",
        "target_scope": "5-Pass Stress Test & Zero-Loss Breakeven Engine",
        "assigned_agent": "🤖 5-Agent Collaborative AI Council",
        "rule_type": "Unanimous Consensus & Dynamic Trailing Engine",
        "description": "Executes 5 back-to-back verification loops. Dispatches trades with 0.20% Commission Fee deduction. Breakeven Lock: If Profit >= +2.0%, moves SL to Entry + 0.40% (covers fee). Trailing Lock: If Profit >= +4.0%, trails SL at Peak - 1.5% (locks +3.50% profit)."
    },
    {
        "id": "STAGE-7-GOD-PRIVILEGES",
        "logic_name": "Stage 7 (Formula #3, #4 & #5): Supreme God AI Exclusive Execution, Pullback Scan & 2-Hour Capital Recycle",
        "target_scope": "👑 God of Trade AI Exclusive Portfolio Scaling & Capital Recycling",
        "assigned_agent": "👑 Supreme God AI (Master Strategy Architect)",
        "rule_type": "Exclusive AI Privilege & 2-Hour Capital Recycle Engine",
        "description": "1. Grade S Priority Scale-In (Score >= 9.5 Pts): Immediately prioritizes Grade S setups for scale-in entries.\n2. Peak-Trailing Stop Lock (Peak >= +4.0%): Immediately locks Stop Loss at +3.50% (Entry * 1.035) or Peak - 1.5%.\n3. Grade S Position Rotation (Formula #3): If 5 holdings are open and a queued coin score is >= 9.0 Pts, Supreme God AI Bot automatically exits the lowest PnL holding position to scale into the higher-scoring Grade S setup!\n4. 3 S/R Pairs Pullback Scan (Formula #4): Before entry, scans 3 pairs of Weak/Strong Support & Resistance levels (5M Micro, 1H Structural, 4H Wholesale) for pullback defense.\n5. God of Trade 2-Hour Capital Recycle Exit (Formula #5): If God AI Bot holds a position for > 2 hours and Net PnL >= +$0.05 USD (Capital * 0.25% after 0.20% fee), it automatically exits to recycle capital into fresh Grade S setups!\n6. Every 6-Hour Golden Opportunity Exit Windows (12PM-2PM, 6PM-8PM, 12AM-2AM, 6AM-8AM MYT): BOTH bot groups (God AI & Group C) exit active holding positions when Net PnL >= +$0.05 USD (covering 0.20% fee + net profit).\n7. Delisted Binance Safety Filter: Excludes delisted, inactive, currency, and meme coins universally."
    },
    {
        "id": "STAGE-8-IRON-RULE",
        "logic_name": "Stage 8: Iron Rule Stage - 100% Spot-Only Zero-Leverage Capital Constraint",
        "target_scope": "Strict Risk Control & Zero Liquidation Risk",
        "assigned_agent": "🛡️ Unanimous AI Council & Risk Sentinel",
        "rule_type": "Spot-Only Capital Allocation & Leverage Hard Veto",
        "description": "All trades for both Robo Trade groups must strictly use raw capital (1x Spot-only, e.g. $20.00 USD allocation per trade) without using any leverage. If any order attempt detects leverage > 1x, all 5 AI Council members cast an immediate UNANIMOUS HARD VETO to block trade entry!"
    },
    {
        "id": "STAGE-9-MULTI-ADMIN-IP-GUARD",
        "logic_name": "Stage 9: Multi-Admin Authentication & 3-Concurrent Active IP Limit Guard",
        "target_scope": "Security Access Control & Concurrent IP Session Management",
        "assigned_agent": "🔐 Multi-Admin Security Sentinel",
        "rule_type": "Multi-Admin Provisioning & 3-IP Concurrent Session Limit",
        "description": "Supports multiple admin credentials (admin, admin1, admin2, admin3, soufi_admin -> password: admin123). Tracks active sessions strictly by Client IP Address. Allows a maximum of 3 distinct active IP sessions concurrently. If a 4th distinct IP attempts to log in, entry is strictly BLOCKED (HTTP 403) until an existing session is logged out or expires!"
    }
]

@router.get("/analysis_logic")
def get_analysis_logic():
    return {
        "status": "success",
        "total_rules": len(analysis_rules_db),
        "rules": analysis_rules_db
    }

