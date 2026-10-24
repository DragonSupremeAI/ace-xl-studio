---
name: acestep-api
description: ACE-Step 1.5 (XL) REST API contract for generation, editing, LoRA/LoKr training, dataset building, and adapter lifecycle. Use when writing code that calls the ACE-Step API server (default :8001), designing UI around its task types, or debugging request/response shapes.
---

# ACE-Step 1.5 REST API

Async task API. Server: `uv run acestep-api` (port 8001). Auth optional via
`ACESTEP_API_KEY` — send `Authorization: Bearer <key>` or `ai_token` in body.

**CORS:** restricted to `localhost`/`127.0.0.1` origins — a local web UI can call
it directly; remote/non-localhost clients need a proxy.

## Workflow

1. `POST /release_task` → `{"data": {"task_id": "..."}}`
2. `POST /query_result` with `{"task_id_list": [id]}` → poll until `status`:
   `0` queued/running, `1` succeeded, `2` failed
3. Result rows contain `file: "/v1/audio?path=..."` — fetch via `GET /v1/audio?path=...`
4. Each result row carries `prompt`, `lyrics`, `metas` (bpm/duration/genres/
   keyscale/timesignature), `seed_value`, `generation_info`, `lm_model`,
   `dit_model` → persist as generation manifests.

## Generation — POST /release_task

JSON or multipart. Multipart file fields: `reference_audio`/`ref_audio`
(style transfer) and `src_audio`/`ctx_audio` (cover/repaint source). Path
variants `reference_audio_path`/`src_audio_path` reference server files.
Param aliases accepted: snake_case and camelCase both work.

Core params (from `GenerateMusicRequest`):
- `prompt` (aka `caption`), `lyrics`, `vocal_language` (en/zh/ja/...50+)
- `task_type`: `text2music` | `cover` | `repaint` | `lego` | `extract` | `complete`
- `thinking` (5Hz LM planning; auto-skipped for cover/repaint/extract)
- `sample_mode` + `sample_query`/`description` (auto caption+lyrics)
- `use_format` (LM-enhance provided caption/lyrics)
- `audio_duration` 10–600s, `bpm`, `key_scale`, `time_signature`
- `inference_steps` (turbo=8, base/sft=50), `guidance_scale` (7.0, CFG models only)
- `use_random_seed`, `seed`, `batch_size` (≤8), `audio_format` (mp3/flac/wav/wav32/opus/aac)
- `model` — named DiT selection; server multi-model via ACESTEP_CONFIG_PATH{,2,3}
- Edit params: `repainting_start`, `repainting_end` (-1=end),
  `audio_cover_strength` (0–1; ~0.92–0.99 lyric-faithful remix, ~0.2 style
  transfer), `instruction`, `chunk_mask_mode`, `repaint_mode`
  (conservative/balanced/aggressive), `repaint_strength`
- `global_caption` + `prompt` — lego SFT-stems tasks (full-song + per-track)
- Analysis flags: `analysis_only`, `full_analysis_only`, `extract_codes_only`
- LM params: `lm_model_path`, `lm_backend` (vllm/pt/mlx), `lm_temperature`,
  `lm_cfg_scale`, `lm_top_p`, `use_cot_caption`, `use_cot_language`

## Other generation-adjacent endpoints

- `POST /format_input` — LM-enhance caption/lyrics (+ `param_obj` JSON metas)
- `POST /create_random_sample` — random sample generation
- `GET /v1/models`, `GET /v1/model_inventory`, `GET /v1/stats`, `GET /health`
- `POST /v1/init`, `POST /v1/reinitialize` — service/model init
- OpenRouter-compatible `/v1/chat/completions` (sync, base64 audio) — the
  bundled `.claude/skills/acestep` script uses this "completion" mode

## Training API (async)

Dataset state is server-side (`app.state.dataset`); audio must exist on the
server FS — upload via the companion upload helper or shared volume.

- `POST /v1/dataset/scan` — `{audio_dir, dataset_name, custom_tag,
  tag_position(prepend/append/replace), all_instrumental}`; recognizes
  `.mp3/.wav/.flac/.ogg/.opus/.m4a`, `{name}.lyrics.txt`, `{name}.caption.txt`,
  `{name}.json`, batch CSV (vocalremover Key-BPM-Finder format)
- `POST /v1/dataset/load` — `{dataset_path}` load existing dataset JSON
- `GET /v1/dataset/samples`, `GET/PUT /v1/dataset/sample/{idx}` (caption, genre,
  lyrics, bpm, keyscale, timesignature, language, is_instrumental,
  prompt_override)
- `POST /v1/dataset/save` — `{save_path, dataset_name, custom_tag?, ...}`
- `POST /v1/dataset/auto_label[_async]` — LM caption/metas labeling;
  `skip_metas`, `format_lyrics`, `transcribe_lyrics`, `only_unlabeled`,
  `lm_model_path`, `save_path`; status via `GET /v1/dataset/auto_label_status[/{task_id}]`
  (LM auto-labels captions OK but hallucinates BPM/key — detect locally instead)
- `POST /v1/dataset/preprocess[_async]` — `{output_dir, skip_existing}` →
  preprocessed `.pt` tensors; status `GET /v1/dataset/preprocess_status[/{task_id}]`

### Start training

`POST /v1/training/start` (LoRA): `tensor_dir`, `lora_rank` (64), `lora_alpha`
(128), `lora_dropout` (0.1), `learning_rate` (1e-4), `train_epochs` (size-based:
1–10 songs→200–500, 10–50→100–200, 50+→50–100), `train_batch_size` (1),
`gradient_accumulation` (4), `save_every_n_epochs` (5), `training_shift`
(3.0 turbo / 1.0 base-sft), `training_seed`, `lora_output_dir`, `use_fp8`,
`gradient_checkpointing`

`POST /v1/training/start_lokr` (LoKr, ~10× faster): `tensor_dir`, `output_dir`,
`lokr_linear_dim` (64), `lokr_linear_alpha` (128), `lokr_factor` (-1 auto),
`lokr_decompose_both`, `lokr_use_tucker`, `lokr_use_scalar`,
`lokr_weight_decompose` (DoRA, default true), `learning_rate` (0.03),
`train_epochs` (500), plus shared fields.

- `GET /v1/training/status`, `POST /v1/training/stop`,
  `POST /v1/training/export` (`export_path`, `lora_output_dir`)
- `POST /v1/training/load_tensor_info`
- TensorBoard events land in `<output_dir>/runs/`

### Adapter lifecycle

- `POST /v1/lora/load` — `{lora_path}` accepts **either** a PEFT LoRA dir
  (adapter_config.json + adapter_model.safetensors) **or** a LoKr/LyCORIS
  `.safetensors` file (verified in `api/http/lora_routes.py` — Gradio only does
  PEFT, but the API handles both)
- `POST /v1/lora/unload`, `POST /v1/lora/toggle`, `POST /v1/lora/scale`,
  `GET /v1/lora/status`
- Constraint: LoRA loading requires quantization disabled (no INT8)

## Adapter output layouts

LoRA: `<out>/final/{adapter_config.json,adapter_model.safetensors}` +
`checkpoints/epoch_N/` (inference-ready) + `runs/` (TB events).
LoKr: `<out>/final/lokr_weights.safetensors` + `checkpoints/`.

## CLI training (Side-Step, integrated)

`python train.py fixed|vanilla|estimate` — `fixed` = corrected (continuous
logit-normal timesteps + 15% CFG dropout; recommended). `--preprocess` does
two-pass tensor gen (~3GB then ~6GB VRAM). `--resume-from <ckpt>` resumes.
`estimate` = gradient sensitivity analysis. Wizard mode: bare `train.py`.

## Models

DiT: `acestep-v15-{base,sft,turbo}` (2B) and `acestep-v15-xl-{base,sft,turbo}`
(4B). turbo=8 steps fast gen; sft=50+CFG quality/cover/repaint; base=all tasks
(extract/lego/complete) + training base. LM: `acestep-5Hz-lm-{0.6B,1.7B,4B}`.
VRAM: XL ≥12GB offload+int8 / ≥20GB / ≥24GB w/ 4B LM. Full weights ~65GB.
