import sqlite3
import os
import json
import time

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "storage", "hag_journal.db")

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Table 1: Thought & Reasoning Journal
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS thought_journal (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp REAL,
        symbol TEXT,
        price REAL,
        rsi REAL,
        trend TEXT,
        action TEXT,
        confidence REAL,
        reasoning TEXT,
        key_used TEXT
    )
    """)
    
    # Table 2: Executed Trades
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS trade_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp REAL,
        symbol TEXT,
        side TEXT,
        quantity REAL,
        price REAL,
        order_id TEXT,
        status TEXT,
        realized_pnl REAL DEFAULT 0.0
    )
    """)
    
    conn.commit()
    conn.close()

def log_thought(symbol: str, price: float, rsi: float, trend: str, action: str, confidence: float, reasoning: str, key_used: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO thought_journal (timestamp, symbol, price, rsi, trend, action, confidence, reasoning, key_used)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (time.time(), symbol, price, rsi, trend, action, confidence, reasoning, key_used))
    conn.commit()
    conn.close()

def log_trade(symbol: str, side: str, qty: float, price: float, order_id: str, status: str, realized_pnl: float = 0.0):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO trade_history (timestamp, symbol, side, quantity, price, order_id, status, realized_pnl)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (time.time(), symbol, side, qty, price, str(order_id), status, realized_pnl))
    conn.commit()
    conn.close()

def get_recent_thoughts(limit: int = 20):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM thought_journal ORDER BY id DESC LIMIT ?", (limit,))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

def get_recent_trades(limit: int = 20):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM trade_history ORDER BY id DESC LIMIT ?", (limit,))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

def get_performance_stats():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM trade_history ORDER BY id ASC")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    total_trades = len(rows)
    closed_trades = [r for r in rows if r["side"] == "CLOSE"]
    wins = [r for r in closed_trades if (r["realized_pnl"] or 0.0) > 0]
    losses = [r for r in closed_trades if (r["realized_pnl"] or 0.0) < 0]
    
    total_realized_pnl = sum((r["realized_pnl"] or 0.0) for r in closed_trades)
    win_rate = (len(wins) / len(closed_trades) * 100) if closed_trades else 0.0
    
    gross_profit = sum((r["realized_pnl"] or 0.0) for r in wins)
    gross_loss = abs(sum((r["realized_pnl"] or 0.0) for r in losses))
    profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else (gross_profit if gross_profit > 0 else 1.0)

    # Build cumulative equity curve for Chart.js
    equity_curve = []
    cumulative = 0.0
    for t in closed_trades:
        pnl = t["realized_pnl"] or 0.0
        cumulative += pnl
        equity_curve.append({
            "timestamp": t["timestamp"],
            "date": time.strftime("%H:%M:%S", time.localtime(t["timestamp"])),
            "pnl": round(pnl, 2),
            "cumulative": round(cumulative, 2)
        })

    return {
        "total_trades": total_trades,
        "closed_trades": len(closed_trades),
        "wins": len(wins),
        "losses": len(losses),
        "win_rate": round(win_rate, 1),
        "net_pnl": round(total_realized_pnl, 2),
        "gross_profit": round(gross_profit, 2),
        "gross_loss": round(gross_loss, 2),
        "profit_factor": round(profit_factor, 2),
        "equity_curve": equity_curve
    }

def reset_journal():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM thought_journal")
    cursor.execute("DELETE FROM trade_history")
    conn.commit()
    conn.close()

init_db()
