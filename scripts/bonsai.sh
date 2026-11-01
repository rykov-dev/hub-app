#!/usr/bin/env bash
# Starts the local Bonsai model (llama.cpp server) for the chat in dev.
# The dev server proxies /llm to it, see rsbuild.config.ts.
set -euo pipefail

dir="${BONSAI_DIR:-$(dirname "$0")/../../bonsai}"
model="${BONSAI_MODEL:-Ternary-Bonsai-2-27B-PQ2_0.gguf}"

cd "$dir"
exec ./bin/llama-server \
  -m "$model" \
  --alias bonsai \
  --host 127.0.0.1 \
  --port "${BONSAI_PORT:-8081}" \
  --ctx-size "${BONSAI_CTX:-16384}" \
  --parallel 1
