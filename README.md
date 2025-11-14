# ASINU — Clean Scaffold (Next.js 14.2 + Postgres + Docker)


## 🚀 Quick Start

```bash
# 1️⃣ Clone
git clone https://github.com/<org>/<repo>.git asinu
cd asinu

# 2️⃣ ENV
cp .env.example .env.local
# Điền thông tin Postgres, Viettel S3, API Key, v.v.

# 3️⃣ Local run
pnpm install
pnpm dev

# 4️⃣ Docker run
docker compose up -d --build

# 5️⃣ Test & Typecheck
pnpm test
pnpm typecheck

# 6️⃣ Smoke test
curl -i http://localhost:3000/api/qa/selftest   # expect 200
```

## 🧪 API Endpoints — Smoke & Examples

### 1. POST Logs (all require JSON, content-type: application/json)

```bash
curl -i -X POST http://localhost:3000/api/log/bg \
  -H "Content-Type: application/json" \
  -d '{"value":123,"unit":"mg/dL","context":"fasting","ts":"2025-10-14T08:00:00Z"}'

curl -i -X POST http://localhost:3000/api/log/water \
  -H "Content-Type: application/json" \
  -d '{"ml":1800,"ts":"2025-10-14T08:00:00Z"}'

curl -i -X POST http://localhost:3000/api/log/weight \
  -H "Content-Type: application/json" \
  -d '{"kg":70,"ts":"2025-10-14T08:00:00Z"}'

curl -i -X POST http://localhost:3000/api/log/bp \
  -H "Content-Type: application/json" \
  -d '{"systolic":120,"diastolic":80,"pulse":70,"ts":"2025-10-14T08:00:00Z"}'

curl -i -X POST http://localhost:3000/api/log/insulin \
  -H "Content-Type: application/json" \
  -d '{"dose":12,"type":"rapid","context":"before meal","ts":"2025-10-14T08:00:00Z","note":"normal"}'

curl -i -X POST http://localhost:3000/api/log/meal \
  -H "Content-Type: application/json" \
  -d '{"meal_type":"lunch","text":"rice and chicken","portion":"medium","ts":"2025-10-14T12:00:00Z","photo_url":"https://example.com/photo.jpg"}'
```

### 2. GET Chart 7d (demo fallback if no data)

```bash
curl -s http://localhost:3000/api/chart/7d
```

### 3. QA Selftest (health check)

```bash
curl -i http://localhost:3000/api/qa/selftest
```

## 🔐 Native Auth (Email · Phone OTP · OAuth)

1. **Email / Phone (password)**
   ```bash
   # Register (contactType=email|phone)
   curl -i -X POST http://localhost:3000/api/auth/email/register \
     -H "Content-Type: application/json" \
     -d '{"contactType":"email","email":"demo@example.com","password":"Secure123","confirmPassword":"Secure123","agreeTerms":true,"agreeAI":true}'

   # Login
   curl -i -X POST "http://localhost:3000/api/auth/email/login?next=/dashboard" \
     -H "Content-Type: application/json" \
     -d '{"contactType":"email","email":"demo@example.com","password":"Secure123"}'
   ```
   Successful requests issue an `asinu.sid` HTTP-only cookie backed by the `auth_session` table.

2. **Phone OTP (static `123456` for internal testing)**
   ```bash
   curl -i -X POST http://localhost:3000/api/auth/phone/send \
     -H "Content-Type: application/json" \
     -d '{"phone":"0912345678"}'

   curl -i -X POST http://localhost:3000/api/auth/phone/verify \
     -H "Content-Type: application/json" \
     -d '{"phone":"0912345678","otp":"123456"}'
   ```
  The backend stores OTPs in `auth_otp_store` with a 5-minute TTL and auto-creates users on first verify.
  - UI: tại `/auth/login` chọn tab **“OTP (SMS)”** để gửi mã và xác thực trực tiếp, không cần rời trang.
  - Dọn dẹp OTP hết hạn: chạy tay `npm run otp:cleanup` hoặc cài cron `0 * * * * /opt/asinu/ops/otp_cleanup_cron.sh >> /var/log/asinu/otp_cleanup.log 2>&1`

3. **OAuth (Google / Zalo)**
   - Configure environment variables:
     ```
     GOOGLE_OAUTH_CLIENT_ID=placeholder
     GOOGLE_OAUTH_CLIENT_SECRET=placeholder
     GOOGLE_OAUTH_REDIRECT_URI=https://app.asinu.ai/api/auth/google   # optional override
     ZALO_OAUTH_APP_ID=placeholder
     ZALO_OAUTH_APP_SECRET=placeholder
     ZALO_OAUTH_REDIRECT_URI=https://app.asinu.ai/api/auth/zalo       # optional override
     ```
   - Visit `/api/auth/google` or `/api/auth/zalo` to start the flow; on success the user is provisioned (or linked) and redirected to `/`.

4. **Sessions**
   - All auth flows create rows in `auth_session` and set `asinu.sid=<session_id>` (httpOnly, secure).
   - `/api/auth/logout` and `/api/auth/session` clear the cookie and delete the DB record.

## 🌱 Mission Lite (Daily Actions)

1. Enable the feature:
   ```bash
   export FEATURE_MISSION=true
   export NEXT_PUBLIC_FEATURE_MISSION=true
   ```
2. Apply the latest migrations (includes `missions`, `user_missions`, `mission_log`).
3. Hit the APIs with a valid `asinu.sid` session cookie:
   ```bash
   curl -i --cookie "asinu.sid=..." http://localhost:3000/api/missions/today
   curl -i --cookie "asinu.sid=..." -X POST http://localhost:3000/api/missions/checkin \
     -H "Content-Type: application/json" \
     -d '{"mission_id":"<uuid-from-today>"}'
   ```
4. Visit `/dashboard` to see the “Today's Missions” checklist update live.

## 🎁 Rewards & Donate (flagged)

1. Enable the flags (Tree ledger is required for the catalog gate):
   ```bash
   export TREE_ENABLED=true
   export REWARDS_ENABLED=true
   export NEXT_PUBLIC_REWARDS=true
   ```
2. Run the latest migrations (`115_tree_ledger.sql` + `117_reward_wallet.sql`).
3. Smoke the APIs with a valid `asinu.sid`:
   ```bash
   curl -i --cookie "asinu.sid=..." http://localhost:3000/api/rewards/catalog
   curl -i --cookie "asinu.sid=..." http://localhost:3000/api/rewards/redemptions
   curl -i --cookie "asinu.sid=..." -X POST http://localhost:3000/api/rewards/redeem \
     -H "Content-Type: application/json" \
     -d '{"item_id":"11111111-2222-4aaa-8888-000000000001"}'
   curl -i --cookie "asinu.sid=..." -X POST http://localhost:3000/api/donate \
     -H "Content-Type: application/json" \
     -d '{"provider":"vnpay","amount_points":60}'
   ```
4. Visit `/rewards` to see the catalog, ladder, donation buttons, and redemption history update instantly.
5. (Optional) Donation/deposit features stay OFF for MVP—only set `DONATION_ENABLED=true` / `NEXT_PUBLIC_DONATION=true` later when payments are approved.

## 🌉 Dia Brain Bridge

Set the following environment variables to stream anonymized events to Dia Brain:

```bash
export BRIDGE_URL="https://bridge.example.com/v1/events"
export BRIDGE_KEY="paste-issued-key"
export BRIDGE_HASH_SECRET="per-env-random-secret"
```

The bridge client automatically hashes `user_id`, signs short-lived JWTs, and records all attempts in `bridge_log`.

## 🧠 Architecture

```
src/
 ├─ domain/          → entities, schemas, usecases
 ├─ application/     → services, DTO, validators
 ├─ infrastructure/  → db adapters, schedulers
 └─ interfaces/      → api routes, ui/pages, hooks, components
```

- API → Application → Domain (Clean Architecture)
- RLS (Postgres) bắt buộc; không phụ thuộc BaaS/runtime bên thứ ba
- Feature flags điều khiển AI, chart, rewards, v.v.

## 🛡️ Safety & Rules

- ❌ Không commit secret hoặc khoá dịch vụ bên thứ ba
- 🔒 .env.example chỉ chứa placeholder, không secret thực
- ✅ Mọi PR phải qua CI và QA Smoke pass
- 🚫 Không force-push lên main

## 🧩 Team & License

Tech Lead: Trần Quang Tùng  
QA Lead: Đặng Tuấn Anh  
Product Owner: Trần Hoàng Nam

© 2025 CÔNG TY CỔ PHẦN ASINU — All rights reserved.
