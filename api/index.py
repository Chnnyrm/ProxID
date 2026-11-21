"""Vercel entry point.

Vercel's Python runtime looks for an ASGI callable. The FastAPI app is created in
backend/app/main.py, so this file only has to put the backend on the import path
and re-export the app.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.main import app  # noqa: E402

__all__ = ["app"]
