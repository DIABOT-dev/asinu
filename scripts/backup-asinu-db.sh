#!/usr/bin/env bash
# Shells into the Compose-managed Postgres container and performs a gzip'd dump.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-asinu-staging}"
DATABASE="${DATABASE:-diabotdb}"
DB_USER="${DB_USER:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-/backup}"
KEEP_COUNT="${KEEP_COUNT:-7}"
SECRETS_FILE="${SECRETS_FILE:-${PROJECT_ROOT}/secrets/viettel.env}"
S3_PREFIX="${S3_PREFIX:-db-backup}"

timestamp="$(date +%Y-%m-%d-%H%M)"
outfile="${BACKUP_DIR}/asinu-db-full-${timestamp}.sql.gz"

if [ ! -d "${BACKUP_DIR}" ]; then
  echo "Backup directory ${BACKUP_DIR} not found; aborting." >&2
  exit 1
fi

pushd "${PROJECT_ROOT}" >/dev/null

echo "[backup] dumping ${DATABASE} via docker compose (${COMPOSE_PROJECT_NAME}) -> ${outfile}"
docker compose --project-name "${COMPOSE_PROJECT_NAME}" exec -T asinu-postgres \
  pg_isready -U "${DB_USER}" -d "${DATABASE}" >/dev/null

docker compose --project-name "${COMPOSE_PROJECT_NAME}" exec -T asinu-postgres \
  pg_dump -U "${DB_USER}" -d "${DATABASE}" --no-owner --no-privileges --format=plain |
  gzip -9 > "${outfile}"

popd >/dev/null

echo "[backup] dump completed: ${outfile}"
cp "${outfile}" "${BACKUP_DIR}/asinu-db-latest.sql.gz"

if command -v aws >/dev/null 2>&1 && [ -f "${SECRETS_FILE}" ]; then
  # shellcheck disable=SC1090
  source "${SECRETS_FILE}"
  export AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY}"
  export AWS_SECRET_ACCESS_KEY="${S3_SECRET_KEY}"
  export AWS_DEFAULT_REGION="${S3_REGION:-us-east-1}"
  endpoint="${S3_ENDPOINT:-https://s3.viettelcloud.vn}"
  bucket="${S3_BUCKET:-diabot-prod}"
  object_key="${S3_PREFIX}/$(basename "${outfile}")"
  echo "[backup] uploading ${outfile} to s3://${bucket}/${object_key}"
  if aws --endpoint-url "${endpoint}" s3 cp "${outfile}" "s3://${bucket}/${object_key}"; then
    echo "[backup] upload completed"
  else
    echo "[backup] WARNING: upload failed" >&2
  fi
else
  echo "[backup] WARNING: aws CLI or secrets missing; skipped upload" >&2
fi

echo "[backup] keeping latest ${KEEP_COUNT} files locally"
mapfile -t backups < <(ls -1t "${BACKUP_DIR}"/asinu-db-full-*.sql.gz 2>/dev/null || true)
if [ "${#backups[@]}" -gt "${KEEP_COUNT}" ]; then
  for ((i=KEEP_COUNT; i<${#backups[@]}; i++)); do
    rm -f "${backups[$i]}"
  done
fi

echo "[backup] done"
