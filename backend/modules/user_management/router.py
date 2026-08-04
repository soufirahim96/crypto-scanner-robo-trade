# VERSION 50: USER MANAGEMENT MODULE ROUTER
from fastapi import APIRouter
from backend.db import db_manager

router = APIRouter(prefix="/api/users", tags=["User Management"])

@router.get("")
def get_all_users():
    users = db_manager.get_all_users()
    return {"status": "success", "total_users": len(users), "users": users}
