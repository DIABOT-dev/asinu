#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Load environment (env.txt is the shared baseline; .env overrides locally)
if [[ -f "$ROOT_DIR/env.txt" ]]; then
  # shellcheck disable=SC1090
  source "$ROOT_DIR/env.txt"
fi

if [[ -f "$ROOT_DIR/.env" ]]; then
  # shellcheck disable=SC1090
  source "$ROOT_DIR/.env"
fi

export NODE_ENV=production

echo "[$(date --iso-8601=seconds)] Running OTP cleanup..."
npm run --silent otp:cleanup
echo "[$(date --iso-8601=seconds)] OTP cleanup completed."
