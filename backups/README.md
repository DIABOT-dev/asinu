# Database Backups

This directory contains database snapshots for safe rollback.

## Current Snapshots

- `sb_2025-09-12.sql` - V4 UI Phase checkpoint (PROVISIONAL PASS)

## Usage

To restore a snapshot:
1. Copy the SQL file to the database host.
2. Run `psql "$DATABASE_URL" -f backups/<filename>.sql`.
3. Verify application health and smoke tests.

## Export New Snapshot

```bash
pg_dump "$DATABASE_URL" \
  --schema=asinu_app \
  --no-owner \
  --file "backups/asinu_$(date +%Y-%m-%d).sql"
```
