"""vast.ai instance visibility — shells out to the `vastai` CLI (--raw JSON).

Optional convenience surface for the Settings bar; the UI still works fully
against any reachable ACE-Step API without it.
"""

from __future__ import annotations

import json
import subprocess
from typing import Any

from fastapi import APIRouter

router = APIRouter(prefix="/api/instance")


def _vastai(*args: str) -> Any:
    r = subprocess.run(
        ["vastai", *args, "--raw"], capture_output=True, text=True, timeout=30
    )
    if r.returncode != 0:
        return {"error": r.stderr.strip() or r.stdout.strip()}
    try:
        return json.loads(r.stdout)
    except json.JSONDecodeError:
        return {"raw": r.stdout}


@router.get("/status")
async def instance_status() -> dict:
    return {"instances": _vastai("show", "instances")}


@router.get("/instance/{instance_id}")
async def instance_detail(instance_id: int) -> dict:
    return _vastai("show", "instance", str(instance_id))


@router.get("/balance")
async def balance() -> dict:
    return _vastai("show", "user")
