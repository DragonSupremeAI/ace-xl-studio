# ACE XL Studio

A local web UI for [ACE-Step 1.5 XL](https://github.com/ACE-Step/ACE-Step-1.5) running on a
[vast.ai](https://vast.ai) GPU instance — generation, audio editing, LoRA/LoKr training,
and a local generation library.

## Layout

```
deploy/            # vast.ai launch + provisioning + upload helper + teardown
server/            # local FastAPI proxy (forwards to the remote ACE-Step API)
web/               # React + TypeScript UI (Vite)
.devin/skills/     # acestep-api skill — REST contract reference
```

## Run locally

```bash
# 1. Backend proxy (port 8088)
cd server && uv venv .venv && . .venv/bin/activate && uv pip install -e .
ACESTEP_API_URL=http://<instance-host>:<port> ACESTEP_API_KEY=<key> acestudio

# 2. Frontend dev server (port 5173, proxies /api → 8088)
cd web && npm install && npm run dev
```

Or `npm run build` and the proxy serves `web/dist` directly on :8088.

## Deploy to vast.ai

```bash
vastai set api-key <key>
vastai create ssh-key ~/.ssh/id_ed25519.pub        # before first create
cd deploy && ./launch.sh                          # search offers → pick → create
# when done:
./teardown.sh <INSTANCE_ID>                       # copies outputs out, then destroys
```

Model config via env at create: `ACESTEP_MODELS`, `ACESTEP_CONFIG_PATH`,
`ACESTEP_LM_MODEL_PATH`, `ACESTEP_API_KEY`, `HF_TOKEN`.

> `deploy/provision.sh` is fetched via `PROVISIONING_SCRIPT` — push this repo
> (or a public fork of the deploy dir) and set `PROVISIONING_URL` in launch.sh.

## Notes

- Generation/editing need no extra services. **Training** requires the upload
  helper (instance port 8100) since dataset scan paths are server-side.
- LoRA adapters load via dir path (needs `adapter_config.json`); LoKr via
  `.safetensors` file. Adapter loading requires quantization off.
- Only `vastai destroy` stops all billing — `stop` keeps charging for disk.
