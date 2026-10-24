"""Async HTTP client for the remote ACE-Step API server."""

from __future__ import annotations

from typing import Any, Dict, Optional

import httpx

from . import config


def _headers() -> Dict[str, str]:
    h: Dict[str, str] = {}
    if config.ACESTEP_API_KEY:
        h["Authorization"] = f"Bearer {config.ACESTEP_API_KEY}"
    return h


async def get(path: str, params: Optional[dict] = None) -> Any:
    async with httpx.AsyncClient(timeout=config.REQUEST_TIMEOUT) as c:
        r = await c.get(f"{config.ACESTEP_API_URL}{path}", params=params, headers=_headers())
        r.raise_for_status()
        return r.json()


async def post(path: str, json: Optional[dict] = None) -> Any:
    async with httpx.AsyncClient(timeout=config.REQUEST_TIMEOUT) as c:
        r = await c.post(f"{config.ACESTEP_API_URL}{path}", json=json, headers=_headers())
        r.raise_for_status()
        return r.json()


async def post_multipart(path: str, fields: Dict[str, Any], files: Dict[str, tuple]) -> Any:
    data = {k: v for k, v in fields.items() if v is not None}
    async with httpx.AsyncClient(timeout=config.REQUEST_TIMEOUT) as c:
        r = await c.post(
            f"{config.ACESTEP_API_URL}{path}", data=data, files=files, headers=_headers()
        )
        r.raise_for_status()
        return r.json()


async def get_bytes(path: str, params: Optional[dict] = None) -> tuple[bytes, str]:
    async with httpx.AsyncClient(timeout=config.REQUEST_TIMEOUT) as c:
        r = await c.get(f"{config.ACESTEP_API_URL}{path}", params=params, headers=_headers())
        r.raise_for_status()
        ctype = r.headers.get("content-type", "application/octet-stream")
        return r.content, ctype


async def helper_get(path: str) -> Any:
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.get(f"{config.UPLOAD_HELPER_URL}{path}")
        r.raise_for_status()
        return r.json()


async def helper_upload(dataset: str, files: Dict[str, tuple]) -> Any:
    async with httpx.AsyncClient(timeout=600) as c:
        r = await c.post(
            f"{config.UPLOAD_HELPER_URL}/datasets/{dataset}/files", files=files
        )
        r.raise_for_status()
        return r.json()


async def helper_delete(dataset: str, filename: str) -> Any:
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.delete(f"{config.UPLOAD_HELPER_URL}/datasets/{dataset}/files/{filename}")
        r.raise_for_status()
        return r.json()
