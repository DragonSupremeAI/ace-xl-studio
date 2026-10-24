#!/bin/bash
# Vast.ai PROVISIONING_SCRIPT for ACE-Step 1.5 XL API server.
# Runs after Supervisor starts on vastai/base-image (or vastai/pytorch).
# Registers two services: the ACE-Step REST API (:8001) and a dataset
# upload helper (:8100) used by the ace-xl-studio UI.
set -eo pipefail

REPO_URL="${ACESTEP_REPO_URL:-https://github.com/ACE-Step/ACE-Step-1.5.git}"
APP_DIR=/workspace/ACE-Step-1.5
MODELS="${ACESTEP_MODELS:-acestep-v15-xl-turbo acestep-v15-xl-base}"
LM_MODEL="${ACESTEP_LM_MODEL_PATH:-acestep-5Hz-lm-1.7B}"
DATA_DIR=/workspace/datasets
OUT_DIR=/workspace/acestep_output

. /venv/main/bin/activate

mkdir -p "$DATA_DIR" "$OUT_DIR" /opt/supervisor-scripts /var/log/portal

# --- 1. Clone and install ACE-Step ------------------------------------------
if [ ! -d "$APP_DIR" ]; then
    git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"
git pull --ff-only || true

# uv is preinstalled on the vastai base image; fall back to pip
if command -v uv >/dev/null 2>&1; then
    uv sync
else
    pip install -e .
fi
pip install fastapi uvicorn python-multipart soundfile 2>/dev/null || true

# torch 2.10.0+cu128 (repo's linux pin) breaks fp16/bf16 cuBLAS on older
# drivers (e.g. 570.x: CUBLAS_STATUS_INVALID_VALUE on 16-bit GEMMs).
# Downgrade to the Windows pin series, verified working on RTX 4090/570.144.
# uv run would re-sync and revert this, so the service script runs the venv
# binary directly instead of `uv run`.
uv pip install --python .venv/bin/python \
    torch==2.7.1 torchvision==0.22.1 torchaudio==2.7.1

# --- 2. Prefetch models (idempotent, resumable via HF cache) ----------------
export HF_HOME=/workspace/.cache/huggingface
cd "$APP_DIR"
for M in $MODELS "$LM_MODEL"; do
    python -c "
from huggingface_hub import snapshot_download
snapshot_download('ACE-Step/$M', local_dir='./checkpoints/$M')
print('downloaded $M')
" || echo "WARN: model fetch failed for $M (will retry at first request)"
done

# --- 3. Service scripts ------------------------------------------------------
cat > /opt/supervisor-scripts/acestep-api.sh <<'EOS'
#!/bin/bash
utils=/opt/supervisor-scripts/utils
[ -f "${utils}/logging.sh" ] && . "${utils}/logging.sh"
[ -f "${utils}/environment.sh" ] && . "${utils}/environment.sh"
. /venv/main/bin/activate
export HF_HOME=/workspace/.cache/huggingface
cd /workspace/ACE-Step-1.5
exec .venv/bin/acestep-api --port 8001
EOS
chmod +x /opt/supervisor-scripts/acestep-api.sh

UPLOAD_SERVER_URL="${UPLOAD_SERVER_URL:-https://raw.githubusercontent.com/DragonSupremeAI/ace-xl-studio/main/deploy/upload_server.py}"
curl -fsSL "$UPLOAD_SERVER_URL" -o /opt/upload_server.py

cat > /opt/supervisor-scripts/upload-server.sh <<'EOS'
#!/bin/bash
. /venv/main/bin/activate
exec python /opt/upload_server.py
EOS
chmod +x /opt/supervisor-scripts/upload-server.sh

# --- 4. Register with Supervisor, or launch directly -------------------------
# NOTE: --ssh launch mode replaces the image entrypoint, so supervisord may
# not be running. Fall back to plain nohup daemons in that case.
if supervisorctl status >/dev/null 2>&1; then
    cat > /etc/supervisor/conf.d/acestep-api.conf <<'EOS'
[program:acestep-api]
environment=PROC_NAME="%(program_name)s"
command=/opt/supervisor-scripts/acestep-api.sh
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
redirect_stderr=true
EOS
    cat > /etc/supervisor/conf.d/upload-server.conf <<'EOS'
[program:upload-server]
environment=PROC_NAME="%(program_name)s"
command=/opt/supervisor-scripts/upload-server.sh
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
redirect_stderr=true
EOS
    supervisorctl reread && supervisorctl update
else
    mkdir -p /var/log/ace-xl-studio
    nohup /opt/supervisor-scripts/acestep-api.sh > /var/log/ace-xl-studio/api.log 2>&1 &
    nohup /opt/supervisor-scripts/upload-server.sh > /var/log/ace-xl-studio/upload.log 2>&1 &
    echo "supervisord not running — services launched directly (logs in /var/log/ace-xl-studio/)"
fi
echo "ACE-Step provisioning complete. API on :8001, upload helper on :8100."
