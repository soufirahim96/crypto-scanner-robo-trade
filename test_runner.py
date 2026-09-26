import os
import sys
import json

project_root = r"C:\Users\User\.gemini\antigravity\scratch\mcl_scanner"
sys.path.insert(0, project_root)

from backend.connection import moomoo_manager

print("--- Running Moomoo Connection & Contract Discovery Diagnostic ---")
status = moomoo_manager.get_status()
print("Initial Status:", json.dumps(status, indent=2))

print("\nTriggering full test_connection()...")
results = moomoo_manager.test_connection()
print("\nResults:", json.dumps(results, indent=2))
