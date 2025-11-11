#!/usr/bin/env bash
#
# Perform a full pg_dump of the Asinu database and store it on the mounted
# Viettel Object Storage path.

set -euo pipefail

CONTAINER=${CONTAINER:-asinu-postgres}

DATABASE=${DATABASE:-diabotdb}

DB_USER=${DB_USER:-postgres}
BACKUP_DIR=${BACKUP_DIR:-/mnt/diabot-prod/db-backup}
RETENTION_DAYS=${RETENTION_DAYS:-14}

timestamp="$(date +%Y-%m-%d-%H%M)"
outfile="${BACKUP_DIR}/asinu-db-full-${timestamp}.sql.gz"

if [ ! -d "${BACKUP_DIR}" ]; then
  echo "Backup directory ${BACKUP_DIR} not found; aborting." >&2
  exit 1
fi

echo "[backup] dumping ${DATABASE} from container ${CONTAINER} -> ${outfile}"

docker exec "${CONTAINER}" pg_isready -U "${DB_USER}" -d "${DATABASE}" >/dev/null

docker exec "${CONTAINER}" pg_dump -U "${DB_USER}" -d "${DATABASE}" \
  --no-owner --no-privileges --format=plain |
  gzip -9 > "${outfile}"

echo "[backup] dump completed: ${outfile}"

cp "${outfile}" "${BACKUP_DIR}/asinu-db-latest.sql.gz"

echo "[backup] pruning backups older than ${RETENTION_DAYS} days"
find "${BACKUP_DIR}" -maxdepth 1 -name "asinu-db-full-*.sql.gz" -mtime +"${RETENTION_DAYS}" -print -delete

echo "[backup] done"
