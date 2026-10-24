"""Runtime configuration for the ace-xl-studio proxy."""

from __future__ import annotations

import os
from pathlib import Path

ACESTEP_API_URL = os.environ.get("ACESTEP_API_URL", "http://127.0.0.1:8001").rstrip("/")
ACESTEP_API_KEY = os.environ.get("ACESTEP_API_KEY", "")

# Companion upload helper on the same instance (deploy/upload_server.py).
UPLOAD_HELPER_URL = os.environ.get(
    "ACESTEP_UPLOAD_URL", ACESTEP_API_URL.replace(":8001", ":8100")
).rstrip("/")

DATA_DIR = Path(os.environ.get("ACESTUDIO_DATA_DIR", "./data")).resolve()
LIBRARY_DIR = DATA_DIR / "library"      # generation manifests + downloaded audio
UPLOADS_DIR = DATA_DIR / "uploads"      # staging for files we forward

PROXY_PORT = int(os.environ.get("ACESTUDIO_PORT", "8088"))

REQUEST_TIMEOUT = float(os.environ.get("ACESTUDIO_TIMEOUT", "300"))
