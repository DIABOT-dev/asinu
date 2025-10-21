#!/usr/bin/env bash
set -euo pipefail
URL="${URL:-https://anora.top/api/qa/selftest}"
LOG="${LOG:-/opt/anora/health_fail.log}"
if curl -fsS "$URL" >/dev/null; then
  echo "OK $(date -Is)"
else
  echo "$(date -Is) Healthcheck failed: $URL" >> "$LOG"
  exit 1
fi
