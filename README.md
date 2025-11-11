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
- RLS (Postgres) bắt buộc; không dùng Supabase runtime
- Feature flags điều khiển AI, chart, rewards, v.v.

## 🛡️ Safety & Rules

- ❌ Không commit secret, Supabase key, hoặc runtime
- 🔒 .env.example chỉ chứa placeholder, không secret thực
- ✅ Mọi PR phải qua CI và QA Smoke pass
- 🚫 Không force-push lên main

## 🧩 Team & License

Tech Lead: Trần Quang Tùng  
QA Lead: Đặng Tuấn Anh  
Product Owner: Trần Hoàng Nam

© 2025 CÔNG TY CỔ PHẦN ASINU — All rights reserved.
