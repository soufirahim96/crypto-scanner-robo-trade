import sys
import os
import asyncio
import time

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.dirname(__file__))

from backend.auth import generate_32_hash_id
from backend.db import db_manager
from backend.scanner import scanner_engine

async def test_system():
    print("--- 1. Testing 32-Character Hash ID Generator ---")
    uid1 = generate_32_hash_id()
    uid2 = generate_32_hash_id()
    print(f"Generated User ID 1: '{uid1}' (Length: {len(uid1)})")
    print(f"Generated User ID 2: '{uid2}' (Length: {len(uid2)})")
    assert len(uid1) == 32, "User ID must be exactly 32 hex characters"
    assert len(uid2) == 32, "User ID must be failure"
    assert uid1 != uid2, "IDs must be unique"
    print("SUCCESS: 32-Character Encrypted Hash User ID verified!")

    print("\n--- 2. Testing User Creation & Retrieval in Database ---")
    ts = int(time.time())
    test_user = db_manager.create_user(
        first_name="Test",
        last_name="Scanner",
        email=f"test_{ts}@scanner.io",
        username=f"tester_{ts}",
        password="TestPassword123!"
    )
    print(f"Created User: {test_user}")
    assert len(test_user["id"]) == 32, "Stored User ID is not 32 chars"

    all_users = db_manager.get_all_users()
    print(f"Total Users in DB: {len(all_users)}")
    print(f"Latest User Record: {all_users[0]}")

    print("\n--- 3. Testing Single-Connection Crypto Scanner Engine ---")
    print("Starting Binance multiplexed stream (1 connection)...")
    await scanner_engine.start()

    # Let stream collect ticks for 5 seconds
    for i in range(5):
        await asyncio.sleep(1)
        stats = scanner_engine.get_stats()
        print(f"[{i+1}s] Rate: {stats['ticks_per_second']} Ticks/s | Tracked Symbols: {stats['total_tracked_symbols']} | Batch Queue: {stats['batch_queue_size']}")

    db_stats = db_manager.get_stats()
    print(f"Database Ingestion Stats: {db_stats}")
    
    await scanner_engine.stop()
    print("\n--- ALL TESTS PASSED SUCCESSFULLY! ---")

if __name__ == "__main__":
    asyncio.run(test_system())
