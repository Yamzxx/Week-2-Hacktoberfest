"""
Launcher for DealGuard
Starts FastAPI backend server and serves UI at http://localhost:8000
"""
import sys
import os
from pathlib import Path

# Fix Windows stdout encoding for cp1252
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

# Add root and backend to sys.path
root_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(root_dir))
sys.path.insert(0, str(root_dir / "backend"))

if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*60)
    print("DealGuard - Local-First AI Negotiation Simulator")
    print("Serving DealGuard at: http://127.0.0.1:8000")
    print("="*60 + "\n")
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
