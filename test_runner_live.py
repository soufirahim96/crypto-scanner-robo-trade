import os
import sys
import json

project_root = r"C:\Users\User\.gemini\antigravity\scratch\mcl_scanner"
sys.path.insert(0, project_root)

# Read .env manually to ensure environment variables are populated
env_file = os.path.join(project_root, ".env")
if os.path.exists(env_file):
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip()

from backend.connection import moomoo_manager

print("Account in os.environ:", bool(os.environ.get("MOOMOO_LOGIN_ACCOUNT")))
print("Calling moomoo_manager.start()...")
moomoo_manager.start()

print("\nStatus after start():", json.dumps(moomoo_manager.get_status(), indent=2))
print("\nRunning test_connection()...")
res = moomoo_manager.test_connection()
print("\nTest Results:", json.dumps(res, indent=2))

moomoo_manager.stop()
