# Staging Bootstrap — Native Auth, Rewards & OTP Cleanup

This playbook captures the exact commands to finish the 18/11 rollout on the staging VPS. Run them **in order** from a privileged shell on the host (replace paths and credentials to match your environment).

---

## 0. Assumptions

- Source code lives at `/opt/asinu` (adjust if different).
- PostgreSQL is reachable via `DATABASE_URL` or `DIABOT_DB_URL` (export before running).
- The deploy user has permission to reload `systemd` units.

```bash
cd /opt/asinu
export DATABASE_URL="postgres://user:pass@localhost:5432/diabotdb?sslmode=disable"
```

---

## 1. Apply database migrations (`118_native_auth.sql`, `117_reward_wallet.sql`)

> **Tip:** Run with `-v ON_ERROR_STOP=1` so the command aborts on the first SQL error.

```bash
cd /opt/asinu

# Ensure we are on the latest main
git fetch origin main
git reset --hard origin/main

# Native Auth tables + indexes
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/118_native_auth.sql

# Rewards ledger + donation log (safe to run multiple times)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/117_reward_wallet.sql

# Guarantee every session sees the right schema (once per database)
psql "$DATABASE_URL" -c "ALTER DATABASE diabotdb SET search_path TO asinu_app, public;"
```

Validate quickly:

```bash
psql "$DATABASE_URL" -c "\dt auth_session"
psql "$DATABASE_URL" -c "\dt asinu_app.vp_ledger"
```

---

## 2. Update staging environment variables

Edit `/opt/asinu/.env.staging` (and any secrets manager or deployment manifest) so these keys exist:

```bash
# Sessions / cookies
SESSION_SECRET=generate-a-random-64-char-string
SESSION_TTL_SECONDS=86400

# OTP
OTP_TTL_SECONDS=300
OTP_STATIC_VALUE=123456        # change when SMS gateway is ready

# OAuth callbacks
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=https://staging.asinu.ai/api/auth/google
ZALO_OAUTH_APP_ID=...
ZALO_OAUTH_APP_SECRET=...
ZALO_OAUTH_REDIRECT_URI=https://staging.asinu.ai/api/auth/zalo

# Missions / Rewards / Donate flags
FEATURE_MISSION=true
TREE_ENABLED=true
REWARDS_ENABLED=true
NEXT_PUBLIC_REWARDS=true
DONATION_ENABLED=false         # keep OFF until payments launch
NEXT_PUBLIC_DONATION=false

# Dia Brain bridge (required for mission/donate/redeem events)
BRIDGE_URL=https://bridge.dia-brain.ai/v1/events
BRIDGE_KEY=...
BRIDGE_HASH_SECRET=<reuse SESSION_SECRET or stronger>
```

Reload the app (compose or systemd, depending on staging) so Next.js picks up the new values:

```bash
docker compose pull && docker compose up -d --build
# or
systemctl restart asinu-web.service
```

---

## 3. Install the OTP cleanup `systemd` service + timer

The repo already contains `ops/otp_cleanup_cron.sh`. Copy it to the host (or reuse directly if the repo will stay at `/opt/asinu`):

```bash
cd /opt/asinu
chmod +x ops/otp_cleanup_cron.sh
```

Create `/etc/systemd/system/asinu-otp-cleanup.service`:

```bash
sudo tee /etc/systemd/system/asinu-otp-cleanup.service >/dev/null <<'EOF'
[Unit]
Description=Asinu OTP store cleanup
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
WorkingDirectory=/opt/asinu
ExecStart=/usr/bin/env bash ops/otp_cleanup_cron.sh
User=asinu
Group=asinu
EOF
```

> Replace `User`/`Group` with the deploy account if it is not `asinu`.

Create the hourly timer `/etc/systemd/system/asinu-otp-cleanup.timer`:

```bash
sudo tee /etc/systemd/system/asinu-otp-cleanup.timer >/dev/null <<'EOF'
[Unit]
Description=Run Asinu OTP cleanup every hour

[Timer]
OnCalendar=*:00/1
AccuracySec=1min
Persistent=true
Unit=asinu-otp-cleanup.service

[Install]
WantedBy=timers.target
EOF
```

Reload and enable:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now asinu-otp-cleanup.timer
sudo systemctl status asinu-otp-cleanup.timer
```

Manual test (should log “OTP cleanup completed”):

```bash
sudo systemctl start asinu-otp-cleanup.service
journalctl -u asinu-otp-cleanup.service -n 20
```

---

## 4. Post-bootstrap smoke checklist (after you run the commands)

Once the server restarts, capture the following responses (we will double-check logs together):

```bash
curl -i --cookie "asinu.sid=<session>" https://staging.asinu.ai/api/auth/session
curl -i --cookie "asinu.sid=<session>" https://staging.asinu.ai/api/missions/today
curl -i --cookie "asinu.sid=<session>" https://staging.asinu.ai/api/rewards/catalog
curl -i https://staging.asinu.ai/api/healthz
```

Save the raw output and paste it back so we can verify schema + smoke scripts without needing SSH access.
