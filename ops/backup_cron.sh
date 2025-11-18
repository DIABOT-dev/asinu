#!/usr/bin/env bash
set -euo pipefail
TS=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup"
FILE="${BACKUP_DIR}/db_${TS}.sql"
mkdir -p "$BACKUP_DIR"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-asinu-staging}"
DB_NAME="${DB_NAME:-diabotdb}"

pushd "${PROJECT_ROOT}" >/dev/null
docker compose --project-name "${COMPOSE_PROJECT_NAME}" exec -T asinu-postgres \
  pg_dump -U postgres "${DB_NAME}" > "$FILE"
popd >/dev/null

S3_BUCKET="${S3_BUCKET:-s3://diabot-backup}"
S3_ENDPOINT="${S3_ENDPOINT:-https://s3.viettelcloud.vn}"
aws s3 cp "$FILE" "$S3_BUCKET/" --endpoint-url "$S3_ENDPOINT"
echo "✅ Backup uploaded: ${S3_BUCKET}/$(basename "$FILE")"
