import os
import sys
import subprocess
import time
import uvicorn

# Ensure the root directory is in the Python search path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

def free_port_if_busy(port: int):
    """Automatically terminates any orphaned process holding the port on Windows."""
    if sys.platform != "win32":
        return
    try:
        cmd = f'powershell -Command "Get-NetTCPConnection -LocalPort {port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess"'
        res = subprocess.check_output(cmd, shell=True, text=True).strip()
        if res:
            pids = [int(p) for p in res.split() if p.isdigit()]
            for pid in pids:
                if pid != os.getpid():
                    print(f"[*] Port {port} is occupied by process {pid}. Cleaning up stale process...")
                    subprocess.run(f"taskkill /F /PID {pid}", shell=True, capture_output=True)
                    time.sleep(1)
    except Exception:
        pass

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    free_port_if_busy(port)

    print(f"\n=======================================================")
    print(f" Starting HaG Autonomous Robo Trader & Scanner")
    print(f" Local Web Dashboard: http://127.0.0.1:{port}")
    print(f" Alternative Link:   http://localhost:{port}")
    print(f" API State Endpoint:  http://127.0.0.1:{port}/api/state")
    print(f"=======================================================\n")
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=False)
