"""Vercel entry point for the FastAPI application.

Vercel's Python runtime looks for an ASGI callable. The app lives in
backend/app/main.py, so this file puts the backend on the import path and
re-exports the application. It contains no logic of its own.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.main import app  # noqa: E402

__all__ = ["app"]
