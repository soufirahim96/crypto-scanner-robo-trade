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

init_db()
