# VERSION 63: HOLDING & TRANSACTION HISTORY MODULE ROUTER (FRESH START RESET)
from fastapi import APIRouter
from backend.db import db_manager

router = APIRouter(prefix="/api/paper", tags=["Holding & Transaction History"])

@router.get("/transactions")
def get_transaction_history():
    return {"status": "success", "transactions": db_manager.get_all_transaction_history()}

@router.delete("/transactions/clear")
def clear_paper_transactions():
    db_manager.clear_transaction_history()
    return {"status": "success", "message": "All transaction history cleared successfully."}

@router.get("/holdings")
def get_active_holdings():
    return {"status": "success", "holdings": db_manager.get_all_active_holdings()}

@router.delete("/holdings/clear")
def clear_all_active_holdings():
    db_manager.clear_active_holdings()
    return {"status": "success", "message": "All active holdings cleared."}

@router.post("/reset_v63")
def reset_v63_fresh_start():
    """VERSION 63: Wipe all active holdings, transaction history, and schedules for a clean $100.00 start"""
    db_manager.reset_v63_fresh_start()
    return {
        "status": "success", 
        "message": "VERSION 63 Fresh Start Complete: All active paper holdings, transaction history, and schedules wiped. Bot balances reset to $100.00 USD."
    }
