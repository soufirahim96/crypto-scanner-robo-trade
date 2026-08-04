# VERSION 50: SINGLE STREAM HUB MODULE ROUTER
from fastapi import APIRouter
from backend.scanner import scanner_engine

router = APIRouter(prefix="/api/stream", tags=["Single Stream Hub"])

@router.get("/status")
def get_stream_status():
    return {
        "status": "success",
        "stream": scanner_engine.get_stats()
    }
