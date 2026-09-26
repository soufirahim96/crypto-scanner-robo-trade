import asyncio
import os
import traceback
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates

from backend.config import config
from core.hermes_agent import hermes_agent
from core.journal import get_recent_thoughts, get_recent_trades
from adapters.binance_adapter import binance_adapter

template_dir = os.path.join(os.path.dirname(__file__), "templates")
templates = Jinja2Templates(directory=template_dir)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Launch HaG autonomous trading loop in background
    task = asyncio.create_task(hermes_agent.run_loop())
    yield
    hermes_agent.is_running = False
    task.cancel()

app = FastAPI(title="HaG Autonomous Trading Bot (Binance Demo)", lifespan=lifespan)

@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/api/state")
async def get_state():
    try:
        ticker = binance_adapter.fetch_ticker(config.TARGET_SYMBOL)
        account = binance_adapter.get_account_summary()
        thoughts = get_recent_thoughts(15)
        trades = get_recent_trades(15)
        return {
            "symbol": config.TARGET_SYMBOL,
            "price": ticker.get("price"),
            "account": account,
            "thoughts": thoughts,
            "trades": trades
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "traceback": traceback.format_exc()})

@app.post("/api/cycle/trigger")
async def trigger_manual_cycle():
    try:
        result = await hermes_agent.execute_cycle()
        return result
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "traceback": traceback.format_exc()})
