# VERSION 62: BACKTEST RESULT MODULE ROUTER (START/END PRICE LOGGING & DEDUPLICATED RERUN)
from fastapi import APIRouter
from backend.db import db_manager

router = APIRouter(prefix="/api/backtest", tags=["Backtest Result"])

@router.get("/eligible_coins")
def get_backtest_eligible_coins():
    coins = db_manager.get_all_coins()
    eligible = [
        c for c in coins
        if c.get("coin_type", "").upper() not in ["CURRENCY", "MEME"]
    ]
    eligible.sort(key=lambda x: x.get("name", "").lower())
    return {
        "status": "success",
        "total_eligible": len(eligible),
        "coins": eligible
    }

@router.get("/years")
def get_backtest_years(coin_id: str):
    years = db_manager.get_past_pattern_years(coin_id)
    return {"status": "success", "coin_id": coin_id, "years": years}

@router.get("/patterns")
def get_backtest_patterns(coin_id: str = None, year: int = None, time_type: str = None):
    patterns = db_manager.get_past_patterns(coin_id, year=year, time_type=time_type)
    return {"status": "success", "coin_id": coin_id, "patterns": patterns}

@router.post("/reset_and_rerun")
def reset_and_rerun_backtest():
    """
    VERSION 62: Wipe all backtest pattern data and trigger Group E to re-analyze from scratch with Start & End Price logging.
    """
    db_manager.clear_past_patterns()
    from backend.main import run_sequential_backtest, RunBacktestRequest
    coins = db_manager.get_all_coins()
    eligible = [c["symbol"].upper() for c in coins if c.get("coin_type", "").lower() not in ["currency", "meme"]]
    for coin in eligible[:6]:
        run_sequential_backtest(RunBacktestRequest(coin_id=coin, start_year=2016, end_year=2026))
    return {
        "status": "success", 
        "message": "Group E successfully wiped old backtest records and completed fresh deduplicated 10-year backtest generation with explicit Start/End prices."
    }
