#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${SMOKE_BASE_URL:-http://localhost:3000}"
COOKIE_JAR="$(mktemp)"
RESPONSE_FILE="$(mktemp)"

delete_temp() {
  rm -f "$COOKIE_JAR" "$RESPONSE_FILE"
}
trap delete_temp EXIT

echo "[smoke] Base URL: $BASE_URL"

curl_request() {
  local method="$1"
  local url="$2"
  local data="${3:-}"

  local args=("-sS" "-o" "$RESPONSE_FILE" "-w" "%{http_code}" "-X" "$method" "$url" "-b" "$COOKIE_JAR" "-c" "$COOKIE_JAR" "-H" "Accept: application/json")
  if [[ -n "$data" ]]; then
    args+=("-H" "Content-Type: application/json" "-d" "$data")
  fi

  local http_code
  http_code=$(curl "${args[@]}") || {
    echo "[smoke] Request failed: $method $url"
    cat "$RESPONSE_FILE" || true
    return 1
  }

  if [[ "$http_code" -ge 400 ]]; then
    echo "[smoke] Unexpected status $http_code for $method $url"
    cat "$RESPONSE_FILE" || true
    return 1
  fi

  echo "$http_code"
}

# 1. Health check
printf '\n[smoke] 1/4 GET /api/ping... '
if curl_request GET "$BASE_URL/api/ping" >/dev/null; then
  echo "OK"
else
  exit 1
fi

# Generate credentials
TS="$(date +%s)"
RAND_SUFFIX="$RANDOM$RANDOM"
EMAIL="smoke-${TS}-${RAND_SUFFIX}@qa.asinu.health"
PASSWORD="Smoke${TS}a1"
DISPLAY="Smoke QA ${TS}"

# 2. Register user
printf '[smoke] 2/4 POST /api/auth/register... '
REGISTER_PAYLOAD=$(cat <<JSON
{
  "contactType": "email",
  "email": "${EMAIL}",
  "password": "${PASSWORD}",
  "confirmPassword": "${PASSWORD}",
  "display_name": "${DISPLAY}",
  "agreeTerms": true,
  "agreeAI": true
}
JSON
)
if curl_request POST "$BASE_URL/api/auth/register" "$REGISTER_PAYLOAD" >/dev/null; then
  echo "OK"
else
  exit 1
fi

# 3. Login user (ensure session renewal works)
printf '[smoke] 3/4 POST /api/auth/login... '
LOGIN_PAYLOAD=$(cat <<JSON
{
  "contactType": "email",
  "email": "${EMAIL}",
  "password": "${PASSWORD}"
}
JSON
)
if curl_request POST "$BASE_URL/api/auth/login" "$LOGIN_PAYLOAD" >/dev/null; then
  echo "OK"
else
  exit 1
fi

# 4. Log hydration event
printf '[smoke] 4/4 POST /api/log/water... '
LOG_PAYLOAD='{ "volume_ml": 250 }'
if curl_request POST "$BASE_URL/api/log/water" "$LOG_PAYLOAD" >/dev/null; then
  echo "OK"
else
  exit 1
fi

echo '\n[smoke] Backend smoke completed successfully.'
