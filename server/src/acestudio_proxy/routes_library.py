"""Local generation library: manifests + cached audio downloads.

Every completed task can be snapshotted locally — the full result JSON plus
each audio file — so the UI's Library tab works even after the instance is
destroyed.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from . import client, config

router = APIRouter(prefix="/api/library")


def _entry_dir(task_id: str) -> Path:
    safe = "".join(c for c in task_id if c.isalnum() or c in "-_")
    return config.LIBRARY_DIR / safe


@router.post("/snapshot/{task_id}")
async def snapshot(task_id: str, body: Optional[Dict[str, Any]] = None) -> dict:
    """Fetch task result from the remote API and persist manifest + audio.

    The request body may carry ``params`` — the generation settings the UI
    submitted — so the library can rehydrate the form later.
    """
    res = await client.post("/query_result", json={"task_id_list": [task_id]})
    rows = res.get("data") or []
    if not rows:
        raise HTTPException(404, "task not found")
    row = rows[0]
    if row.get("status") != 1:
        raise HTTPException(409, f"task not complete (status={row.get('status')})")

    d = _entry_dir(task_id)
    d.mkdir(parents=True, exist_ok=True)

    results = json.loads(row.get("result", "[]")) if isinstance(row.get("result"), str) else row.get("result", [])
    saved: List[str] = []
    for i, item in enumerate(results):
        file_path = item.get("file", "")
        if not file_path:
            continue
        # file looks like "/v1/audio?path=/abs/server/path.mp3"
        audio_path = file_path.split("path=", 1)[-1]
        body, _ = await client.get_bytes("/v1/audio", params={"path": audio_path})
        ext = Path(audio_path).suffix or ".mp3"
        name = f"{task_id}_{i}{ext}"
        (d / name).write_bytes(body)
        item["local_file"] = name
        saved.append(name)

    manifest = {
        "task_id": task_id,
        "saved_at": datetime.now(timezone.utc).isoformat(),
        "params": (body or {}).get("params") or {},
        "row": {**row, "result": json.dumps(results)},
        "files": saved,
    }
    (d / "manifest.json").write_text(json.dumps(manifest, indent=2))
    return {"task_id": task_id, "files": saved}


@router.get("/entries")
async def entries() -> dict:
    out: List[Dict[str, Any]] = []
    if config.LIBRARY_DIR.is_dir():
        for p in sorted(config.LIBRARY_DIR.iterdir()):
            m = p / "manifest.json"
            if m.is_file():
                data = json.loads(m.read_text())
                row = data.get("row", {})
                results = json.loads(row.get("result", "[]")) if isinstance(row.get("result"), str) else []
                first = results[0] if results else {}
                metas = first.get("metas", {})
                out.append(
                    {
                        "task_id": data["task_id"],
                        "saved_at": data["saved_at"],
                        "prompt": first.get("prompt") or metas.get("prompt", ""),
                        "lyrics_preview": (first.get("lyrics") or "")[:80],
                        "duration": metas.get("duration"),
                        "bpm": metas.get("bpm"),
                        "seed_value": first.get("seed_value"),
                        "files": data.get("files", []),
                    }
                )
    return {"entries": sorted(out, key=lambda e: e["saved_at"], reverse=True)}


@router.get("/entries/{task_id}/manifest")
async def manifest(task_id: str) -> dict:
    m = _entry_dir(task_id) / "manifest.json"
    if not m.is_file():
        raise HTTPException(404, "manifest not found")
    return json.loads(m.read_text())


@router.get("/entries/{task_id}/files/{filename}")
async def library_file(task_id: str, filename: str) -> FileResponse:
    f = _entry_dir(task_id) / Path(filename).name
    if not f.is_file():
        raise HTTPException(404, "file not found")
    return FileResponse(f)


@router.delete("/entries/{task_id}")
async def delete_entry(task_id: str) -> dict:
    import shutil

    d = _entry_dir(task_id)
    if d.is_dir():
        shutil.rmtree(d)
    return {"deleted": task_id}
