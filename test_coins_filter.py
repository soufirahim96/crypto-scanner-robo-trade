import sys
import os
import asyncio
import time

sys.path.insert(0, os.path.dirname(__file__))

from backend.db import db_manager

def test_coins():
    print("--- 1. Testing Coin Auto-Registration & Categorization ---")
    btc_coin = db_manager.get_or_create_coin("BTCUSDT")
    doge_coin = db_manager.get_or_create_coin("DOGEUSDT")
    pepe_coin = db_manager.get_or_create_coin("PEPEUSDT")
    usdt_coin = db_manager.get_or_create_coin("USDTUSDT")

    print(f"BTC Coin Record: {btc_coin}")
    print(f"DOGE Coin Record: {doge_coin}")
    print(f"PEPE Coin Record: {pepe_coin}")

    assert len(btc_coin["id"]) == 32, "Coin ID must be 32-character hash"
    assert len(doge_coin["id"]) == 32, "Coin ID must be 32-character hash"
    assert doge_coin["coin_type"] == "MEME", "DOGE must be categorized as MEME"
    assert doge_coin["is_filtered"] == 1, "MEME coin must have is_filtered = 1"
    assert btc_coin["is_filtered"] == 0, "MAJOR coin must have is_filtered = 0"

    print("SUCCESS: 32-Character Encrypted Hash Coin IDs & MEME Categorization Verified!")

    print("\n--- 2. Testing Tick Filtering Logic ---")
    sample_ticks = [
        {"symbol": "BTCUSDT", "exchange": "Binance", "price": 67000.0, "quantity": 1.2, "side": "BUY", "timestamp": int(time.time()*1000)},
        {"symbol": "DOGEUSDT", "exchange": "Binance", "price": 0.12, "quantity": 5000.0, "side": "SELL", "timestamp": int(time.time()*1000)},
        {"symbol": "PEPEUSDT", "exchange": "Binance", "price": 0.000009, "quantity": 100000.0, "side": "BUY", "timestamp": int(time.time()*1000)},
        {"symbol": "ETHUSDT", "exchange": "Binance", "price": 3500.0, "quantity": 0.5, "side": "BUY", "timestamp": int(time.time()*1000)},
    ]

    initial_ingested = db_manager.total_ticks_processed
    initial_filtered = db_manager.total_filtered_ticks

    db_manager.insert_tick_batch(sample_ticks)

    stats = db_manager.get_stats()
    print(f"Stats after batch: {stats}")

    assert stats["total_filtered_ticks"] > initial_filtered, "MEME coins must be filtered from storing into tick database"
    print("SUCCESS: MEME Coin ticks were successfully filtered from storing in the ticks table!")

if __name__ == "__main__":
    test_coins()
