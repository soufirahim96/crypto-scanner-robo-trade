# VERSION 50: COIN REGISTRY & FILTER MODULE ROUTER
from fastapi import APIRouter
from backend.db import db_manager

router = APIRouter(prefix="/api/coins", tags=["Coin Registry & Filter"])

@router.get("")
def get_all_coins():
    coins = db_manager.get_all_coins()
    return {"status": "success", "total_coins": len(coins), "coins": coins}
