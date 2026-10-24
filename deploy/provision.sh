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

# --- 3. Supervisor: ACE-Step API server -------------------------------------
cat > /opt/supervisor-scripts/acestep-api.sh <<'EOS'
#!/bin/bash
utils=/opt/supervisor-scripts/utils
. "${utils}/logging.sh"
. "${utils}/environment.sh"
. /venv/main/bin/activate
export HF_HOME=/workspace/.cache/huggingface
cd /workspace/ACE-Step-1.5
exec uv run acestep-api --port 8001
EOS
chmod +x /opt/supervisor-scripts/acestep-api.sh

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

# --- 4. Supervisor: dataset upload helper -----------------------------------
UPLOAD_SERVER_URL="${UPLOAD_SERVER_URL:-https://raw.githubusercontent.com/PLACEHOLDER_USER/ace-xl-studio/main/deploy/upload_server.py}"
curl -fsSL "$UPLOAD_SERVER_URL" -o /opt/upload_server.py

cat > /opt/supervisor-scripts/upload-server.sh <<'EOS'
#!/bin/bash
. /venv/main/bin/activate
exec python /opt/upload_server.py
EOS
chmod +x /opt/supervisor-scripts/upload-server.sh

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
echo "ACE-Step provisioning complete. API on :8001, upload helper on :8100."
