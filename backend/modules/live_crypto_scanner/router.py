# VERSION 50: LIVE CRYPTO SCANNER & ROBO TRADE MODULE ROUTER
from fastapi import APIRouter
from backend.db import db_manager
from backend.scanner import scanner_engine

router = APIRouter(prefix="/api/scanner", tags=["Live Crypto Scanner"])

@router.get("/stats")
def get_scanner_stats():
    return {
        "status": "success",
        "scanner": scanner_engine.get_stats(),
        "database": db_manager.get_database_stats()
    }
