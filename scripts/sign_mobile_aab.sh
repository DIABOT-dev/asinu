#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: KEYSTORE_PATH=/path KEYSTORE_PASS=*** KEY_ALIAS=asinu KEY_ALIAS_PASS=*** $0 <path-to-aab>"
  exit 1
fi

: "${KEYSTORE_PATH:?Set KEYSTORE_PATH to keystore file}"
: "${KEYSTORE_PASS:?Set KEYSTORE_PASS to store password}"
: "${KEY_ALIAS:?Set KEY_ALIAS to alias name}"
: "${KEY_ALIAS_PASS:?Set KEY_ALIAS_PASS to alias password}"

AAB_PATH="$1"
if [[ ! -f "$AAB_PATH" ]]; then
  echo "AAB file not found: $AAB_PATH" >&2
  exit 1
fi

jarsigner \
  -verbose \
  -sigalg SHA256withRSA \
  -digestalg SHA-256 \
  -keystore "$KEYSTORE_PATH" \
  -storepass "$KEYSTORE_PASS" \
  -keypass "$KEY_ALIAS_PASS" \
  "$AAB_PATH" \
  "$KEY_ALIAS"

echo "Signed AAB: $AAB_PATH"
