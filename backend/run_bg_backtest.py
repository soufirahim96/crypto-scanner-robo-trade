# VERSION 62: GROUP E BACKGROUND BACKTEST RUNNER SCRIPT
import urllib.request
import json
import time
import sys

sys.stdout.reconfigure(encoding='utf-8')

print("Starting Group E 10-Year Backtest Engine background processing for all eligible coins...")

try:
    res = urllib.request.urlopen("http://127.0.0.1:8000/api/backtest/eligible_coins").read().decode("utf-8")
    coins = json.loads(res).get("coins", [])
    print(f"Total Eligible Coins for Group E Backtest: {len(coins)}")

    for idx, coin in enumerate(coins):
        sym = coin.get("symbol", "").upper()
        print(f"[{idx+1}/{len(coins)}] Group E Backtest processing {sym} (2016-2026)...")
        req = urllib.request.Request(
            "http://127.0.0.1:8000/api/backtest/run",
            data=json.dumps({"coin_id": sym, "start_year": 2016, "end_year": 2026}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        try:
            r = urllib.request.urlopen(req).read().decode("utf-8")
            out = json.loads(r)
            gen_count = out.get("patterns_generated", 0)
            print(f"[{idx+1}/{len(coins)}] {sym} Complete: {gen_count} patterns generated with Start/End prices.")
        except Exception as e:
            print(f"[{idx+1}/{len(coins)}] {sym} Warning: {e}")
        time.sleep(0.2)

    print("=== Group E 10-Year Backtest Engine completed background processing for all coins! ===")

except Exception as ex:
    print(f"Group E Backtest Task Error: {ex}")
