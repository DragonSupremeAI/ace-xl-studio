"""ace-xl-studio local proxy.

Run:  uvicorn acestudio_proxy.main:app --port 8088
   or: acestudio  (installed entrypoint)

Serves the built frontend (web/dist) if present and exposes /api/* routes
forwarding to the remote ACE-Step API + upload helper + vastai CLI status.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import config
from .routes_generate import router as generate_router
from .routes_instance import router as instance_router
from .routes_library import router as library_router
from .routes_training import router as training_router

app = FastAPI(title="ace-xl-studio proxy")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (generate_router, training_router, library_router, instance_router):
    app.include_router(r)

DIST = Path(__file__).resolve().parents[3] / "web" / "dist"
if DIST.is_dir():
    app.mount("/", StaticFiles(directory=DIST, html=True), name="web")


def run() -> None:
    import uvicorn

    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    uvicorn.run(app, host="127.0.0.1", port=config.PROXY_PORT)
