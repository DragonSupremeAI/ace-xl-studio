#!/bin/bash
# Safe teardown for an ACE-Step vast.ai instance.
# Copies generated outputs + trained adapters off-box BEFORE destroy —
# destroy is the ONLY action that stops the full billing meter, and it
# permanently deletes the container disk.
#
# Usage: ./teardown.sh <INSTANCE_ID> [--keep]
#   --keep   copy outputs out, then stop (disk still bills) instead of destroy
set -euo pipefail

INSTANCE_ID="${1:?usage: teardown.sh <INSTANCE_ID> [--keep]}"
KEEP="${2:-}"
LOCAL_OUT="${LOCAL_OUT:-./vastai_outputs_$(date +%Y%m%d_%H%M%S)}"

mkdir -p "$LOCAL_OUT"

echo "== Copying outputs off instance $INSTANCE_ID → $LOCAL_OUT"
vastai copy "C.${INSTANCE_ID}:/workspace/acestep_output/" "local:${LOCAL_OUT}/acestep_output/" || \
    echo "WARN: output copy failed or empty"
vastai copy "C.${INSTANCE_ID}:/workspace/ACE-Step-1.5/lora_output/" "local:${LOCAL_OUT}/lora_output/" || \
    echo "WARN: no lora_output to copy"
vastai copy "C.${INSTANCE_ID}:/workspace/ACE-Step-1.5/lokr_output/" "local:${LOCAL_OUT}/lokr_output/" || \
    echo "WARN: no lokr_output to copy"
vastai copy "C.${INSTANCE_ID}:/workspace/datasets/" "local:${LOCAL_OUT}/datasets/" || \
    echo "WARN: no datasets to copy"

if [ "$KEEP" = "--keep" ]; then
    echo "== Stopping $INSTANCE_ID (disk continues to bill — destroy later when done)"
    vastai stop instance "$INSTANCE_ID"
else
    echo "== Destroying $INSTANCE_ID (stops ALL billing; disk deleted)"
    vastai destroy instance "$INSTANCE_ID" -y
fi
echo "Done. Local artifacts: $LOCAL_OUT"
