"""Generation + editing routes: release_task, query_result, audio, models."""

from __future__ import annotations

import json
import re
from typing import Optional

from fastapi import APIRouter, Form, HTTPException, UploadFile, File
from fastapi.responses import Response

from . import client

router = APIRouter(prefix="/api")

_ID_RE = re.compile(r"^[a-zA-Z0-9_-]+$")


@router.get("/health")
async def health() -> dict:
    return await client.get("/health")


@router.get("/stats")
async def stats() -> dict:
    return await client.get("/v1/stats")


@router.get("/models")
async def models() -> dict:
    return await client.get("/v1/models")


@router.post("/format_input")
async def format_input(payload: dict) -> dict:
    return await client.post("/format_input", json=payload)


@router.post("/generate")
async def generate(
    payload: str = Form(...),
    reference_audio: Optional[UploadFile] = File(None),
    src_audio: Optional[UploadFile] = File(None),
) -> dict:
    """Submit a generation task. `payload` is a JSON string of API params.

    Audio inputs are forwarded as multipart files to /release_task.
    """
    try:
        params = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise HTTPException(400, f"invalid payload JSON: {exc}")

    files = {}
    if reference_audio is not None:
        files["reference_audio"] = (
            reference_audio.filename or "ref",
            await reference_audio.read(),
            reference_audio.content_type or "application/octet-stream",
        )
    if src_audio is not None:
        files["src_audio"] = (
            src_audio.filename or "src",
            await src_audio.read(),
            src_audio.content_type or "application/octet-stream",
        )

    if files:
        return await client.post_multipart("/release_task", params, files)
    return await client.post("/release_task", json=params)


@router.post("/query_result")
async def query_result(payload: dict) -> dict:
    return await client.post("/query_result", json=payload)


@router.get("/audio")
async def audio(path: str) -> Response:
    """Proxy audio downloads: GET /api/audio?path=<server path>."""
    body, ctype = await client.get_bytes("/v1/audio", params={"path": path})
    return Response(content=body, media_type=ctype)
