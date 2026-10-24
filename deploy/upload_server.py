"""Dataset upload helper for ACE-Step on vast.ai.

Runs on the GPU instance alongside the ACE-Step API (:8001). Accepts
multipart file uploads and stores them under /workspace/datasets/<name>/
so that POST /v1/dataset/scan can pick them up server-side.

Endpoints:
    POST /datasets/{name}/files   — multipart upload (field: files)
    GET  /datasets                — list dataset directories
    GET  /datasets/{name}/files   — list files in a dataset dir
    DELETE /datasets/{name}/files/{filename} — remove one file
    GET  /healthz                 — liveness
"""

from __future__ import annotations

import os
import shutil
from pathlib import Path
from typing import List

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
import uvicorn

DATASETS_ROOT = Path(os.environ.get("ACESTEP_DATASETS_DIR", "/workspace/datasets"))
ALLOWED_EXT = {".mp3", ".wav", ".flac", ".ogg", ".opus", ".m4a", ".txt", ".json", ".csv"}

app = FastAPI(title="ace-xl-studio upload helper")


def _safe_name(name: str) -> str:
    clean = "".join(c for c in name if c.isalnum() or c in "-_. ").strip()
    if not clean:
        raise HTTPException(400, "invalid dataset name")
    return clean


@app.get("/healthz")
def healthz() -> dict:
    return {"ok": True, "root": str(DATASETS_ROOT)}


@app.get("/datasets")
def list_datasets() -> dict:
    DATASETS_ROOT.mkdir(parents=True, exist_ok=True)
    return {"datasets": sorted(p.name for p in DATASETS_ROOT.iterdir() if p.is_dir())}


@app.get("/datasets/{name}/files")
def list_files(name: str) -> dict:
    d = DATASETS_ROOT / _safe_name(name)
    if not d.is_dir():
        return {"files": []}
    return {
        "files": [
            {"name": p.name, "size": p.stat().st_size}
            for p in sorted(d.iterdir())
            if p.is_file()
        ]
    }


@app.post("/datasets/{name}/files")
async def upload_files(name: str, files: List[UploadFile] = File(...)) -> dict:
    d = DATASETS_ROOT / _safe_name(name)
    d.mkdir(parents=True, exist_ok=True)
    saved = []
    for f in files:
        fname = Path(f.filename or "unnamed").name
        ext = Path(fname).suffix.lower()
        if ext not in ALLOWED_EXT:
            raise HTTPException(400, f"unsupported extension: {ext}")
        dest = d / fname
        with dest.open("wb") as out:
            shutil.copyfileobj(f.file, out)
        saved.append(fname)
    return {"dataset": name, "dir": str(d), "saved": saved}


@app.delete("/datasets/{name}/files/{filename}")
def delete_file(name: str, filename: str) -> JSONResponse:
    dest = DATASETS_ROOT / _safe_name(name) / Path(filename).name
    if dest.is_file():
        dest.unlink()
    return JSONResponse({"deleted": filename})


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8100)
