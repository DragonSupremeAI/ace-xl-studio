"""Training routes: dataset builder, preprocess, LoRA/LoKr runs, adapters.

Dataset files live on the ACE-Step instance — uploads are forwarded to the
companion upload helper, then /v1/dataset/scan points at the server dir.
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, UploadFile, File

from . import client

router = APIRouter(prefix="/api/training")


# --- dataset file management (upload helper on the instance) ----------------

@router.get("/datasets")
async def list_datasets() -> dict:
    return await client.helper_get("/datasets")


@router.get("/datasets/{name}/files")
async def list_dataset_files(name: str) -> dict:
    return await client.helper_get(f"/datasets/{name}/files")


@router.post("/datasets/{name}/files")
async def upload_dataset_files(name: str, files: List[UploadFile] = File(...)) -> dict:
    fwd = {}
    for f in files:
        fwd[f.filename or "file"] = (
            f.filename or "file",
            await f.read(),
            f.content_type or "application/octet-stream",
        )
    # helper expects repeated `files` field — rebuild multipart correctly
    async_files = [("files", v) for v in fwd.values()]
    import httpx
    from . import config

    async with httpx.AsyncClient(timeout=600) as c:
        r = await c.post(f"{config.UPLOAD_HELPER_URL}/datasets/{name}/files", files=async_files)
        r.raise_for_status()
        return r.json()


@router.delete("/datasets/{name}/files/{filename}")
async def delete_dataset_file(name: str, filename: str) -> dict:
    return await client.helper_delete(name, filename)


# --- dataset builder state on the ACE-Step server ----------------------------

@router.post("/dataset/scan")
async def dataset_scan(payload: dict) -> dict:
    return await client.post("/v1/dataset/scan", json=payload)


@router.post("/dataset/load")
async def dataset_load(payload: dict) -> dict:
    return await client.post("/v1/dataset/load", json=payload)


@router.post("/dataset/save")
async def dataset_save(payload: dict) -> dict:
    return await client.post("/v1/dataset/save", json=payload)


@router.get("/dataset/samples")
async def dataset_samples() -> dict:
    return await client.get("/v1/dataset/samples")


@router.get("/dataset/sample/{idx}")
async def dataset_sample(idx: int) -> dict:
    return await client.get(f"/v1/dataset/sample/{idx}")


@router.put("/dataset/sample/{idx}")
async def dataset_update_sample(idx: int, payload: dict) -> dict:
    payload = {**payload, "sample_idx": idx}
    async def _put():
        import httpx
        from . import config

        headers = {}
        if config.ACESTEP_API_KEY:
            headers["Authorization"] = f"Bearer {config.ACESTEP_API_KEY}"
        async with httpx.AsyncClient(timeout=config.REQUEST_TIMEOUT) as c:
            r = await c.put(
                f"{config.ACESTEP_API_URL}/v1/dataset/sample/{idx}",
                json=payload,
                headers=headers,
            )
            r.raise_for_status()
            return r.json()

    return await _put()


@router.post("/dataset/auto_label")
async def auto_label(payload: dict) -> dict:
    return await client.post("/v1/dataset/auto_label_async", json=payload)


@router.get("/dataset/auto_label_status")
async def auto_label_status() -> dict:
    return await client.get("/v1/dataset/auto_label_status")


@router.post("/dataset/preprocess")
async def preprocess(payload: dict) -> dict:
    return await client.post("/v1/dataset/preprocess_async", json=payload)


@router.get("/dataset/preprocess_status")
async def preprocess_status() -> dict:
    return await client.get("/v1/dataset/preprocess_status")


# --- training runs -----------------------------------------------------------

@router.post("/start")
async def start_lora(payload: dict) -> dict:
    return await client.post("/v1/training/start", json=payload)


@router.post("/start_lokr")
async def start_lokr(payload: dict) -> dict:
    return await client.post("/v1/training/start_lokr", json=payload)


@router.get("/status")
async def training_status() -> dict:
    return await client.get("/v1/training/status")


@router.post("/stop")
async def training_stop() -> dict:
    return await client.post("/v1/training/stop", json={})


@router.post("/export")
async def training_export(payload: dict) -> dict:
    return await client.post("/v1/training/export", json=payload)


@router.post("/load_tensor_info")
async def load_tensor_info(payload: dict) -> dict:
    return await client.post("/v1/training/load_tensor_info", json=payload)


# --- adapter lifecycle ---------------------------------------------------------

@router.post("/lora/load")
async def lora_load(payload: dict) -> dict:
    return await client.post("/v1/lora/load", json=payload)


@router.post("/lora/unload")
async def lora_unload() -> dict:
    return await client.post("/v1/lora/unload", json={})


@router.post("/lora/toggle")
async def lora_toggle(payload: dict) -> dict:
    return await client.post("/v1/lora/toggle", json=payload)


@router.post("/lora/scale")
async def lora_scale(payload: dict) -> dict:
    return await client.post("/v1/lora/scale", json=payload)


@router.get("/lora/status")
async def lora_status() -> dict:
    return await client.get("/v1/lora/status")
