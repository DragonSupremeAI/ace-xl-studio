#!/bin/bash
# Launch an ACE-Step 1.5 XL API instance on vast.ai.
#
# Usage:
#   ./launch.sh                      # search offers, pick cheapest, create
#   ./launch.sh <OFFER_ID>           # create onto a specific offer
#   GPU_QUERY='gpu_name=RTX_5090' ./launch.sh
#
# Requires: vastai CLI authenticated (`vastai set api-key`), an SSH key
# registered BEFORE create (`vastai create ssh-key ~/.ssh/id_ed25519.pub`),
# and this repo pushed somewhere public so PROVISIONING_SCRIPT can reach it.
set -euo pipefail

GPU_QUERY="${GPU_QUERY:-gpu_ram>=24 reliability>0.95 verified=true rentable=true direct_port_count>=1 geolocation!=CN}"
DISK_GB="${DISK_GB:-100}"
IMAGE="${IMAGE:-vastai/base-image:cuda-12.9.1-auto}"
PROVISIONING_URL="${PROVISIONING_URL:-https://raw.githubusercontent.com/DragonSupremeAI/ace-xl-studio/main/deploy/provision.sh}"

# Repo-local provisioning script takes priority when it has been pushed public.
if [ "${1:-}" = "" ]; then
    echo "== Searching offers: $GPU_QUERY"
    vastai search offers "$GPU_QUERY" -o 'dlperf_usd-' --limit 15
    echo ""
    read -rp "Offer ID to rent: " OFFER_ID
else
    OFFER_ID="$1"
fi

PORTAL_CONFIG='localhost:1111:11111:/:Instance Portal|localhost:8080:18080:/:Jupyter|localhost:8384:18384:/:Syncthing|localhost:8001:8001:/:ACE-Step API|localhost:8100:8100:/:Upload Helper'

vastai create instance "$OFFER_ID" \
    --image "$IMAGE" \
    --disk "$DISK_GB" \
    --ssh --direct \
    --label acestep-xl-api \
    --env "-p 8001:8001 -p 8100:8100 \
        -e PORTAL_CONFIG=\"$PORTAL_CONFIG\" \
        -e PROVISIONING_SCRIPT=$PROVISIONING_URL \
        -e ACESTEP_CONFIG_PATH=${ACESTEP_CONFIG_PATH:-acestep-v15-xl-turbo} \
        -e ACESTEP_LM_MODEL_PATH=${ACESTEP_LM_MODEL_PATH:-acestep-5Hz-lm-1.7B} \
        -e ACESTEP_API_KEY=${ACESTEP_API_KEY:-} \
        -e ACESTEP_MODELS=\"${ACESTEP_MODELS:-acestep-v15-xl-turbo acestep-v15-xl-base}\" \
        ${HF_TOKEN:+-e HF_TOKEN=$HF_TOKEN}"

echo ""
echo "Created. Poll:  vastai show instance <id>"
echo "Once running, the ACE-Step API is at http://<host>:<mapped-port-for-8001>"
echo "Check port mapping: vastai show instance <id> | jq '.ports'"
