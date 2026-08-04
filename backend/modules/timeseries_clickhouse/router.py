# VERSION 50: TIMESERIES CLICKHOUSE MODULE ROUTER
from fastapi import APIRouter
from backend.db import db_manager

router = APIRouter(prefix="/api/timeseries", tags=["Time-Series ClickHouse"])

@router.get("/stats")
def get_timeseries_stats():
    return {
        "status": "success",
        "database": db_manager.get_database_stats()
    }
