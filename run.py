import os
import sys
import uvicorn

# Ensure the root directory is in the Python search path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"\n=======================================================")
    print(f" Starting HaG Autonomous Robo Trader & Scanner")
    print(f" Local Web Dashboard: http://localhost:{port}")
    print(f" API State Endpoint:  http://localhost:{port}/api/state")
    print(f"=======================================================\n")
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=False)
