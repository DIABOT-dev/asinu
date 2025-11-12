ASINU_MASTER_SPEC_V1 

Sản phẩm: ASINU – Family Health OS
Pháp nhân: CÔNG TY CỔ PHẦN DIABOT (MSDN 0111234998)
Người sáng tạo: Trần Quang Tùng
Scope tài liệu: Ứng dụng Asinu (app + backend của Asinu). Dia Brain tách hệ độc lập; kết nối qua Bridge (nguyên tắc ở cuối).

0) Trạng thái & Mục tiêu

Hiện tại (CURRENT)

App: Next.js 14.2.7 monolith (Node runtime trong Docker).

DB: PostgreSQL 15 (dbname diabotdb, schema public).

Storage: tích hợp Viettel S3 (S3 compatible) đang chạy.

Bridge: đã có helper POST JSON (BRIDGE_URL/KEY).

Chưa có: Redis, ClickHouse, FastAPI riêng.

Đích đến (TARGET / NORTH-STAR)

App: Next.js 15 (App Router, RSC).

API: FastAPI tách service (giai đoạn 2). Giai đoạn 1: optional/placeholder để khớp repo hiện tại.

DB: PostgreSQL 16 (schema asinu_app).

Cache/Queue: Redis (TTL cache, rate limit, background jobs) – planned.

Analytics: ClickHouse – planned.

Tuyệt đối không BaaS bên thứ ba.

Nguyên tắc vàng: Asinu và Dia Brain tách rời hoàn toàn (hạ tầng + DB + storage). Giao tiếp chỉ qua Bridge (HTTPS + JWT), payload ẩn danh.

### 0.1 Tiến độ 12/11/2025

| Hạng mục | Tiến độ | Ghi chú |
|-----------|---------|---------|
| Mission Lite | ✅ Hoàn tất | DB (`missions`, `user_missions`, `mission_log`), API `/api/missions/*`, FE checklist + toast, Dia Brain bridge stub active. |
| Life Tree | 🚧 Sprint 1–2 done | Ledger `tree_events/points_ledger/tree_state`, helper award từ nhiệm vụ, API `/api/tree/state`, UI `LifeTreeCard` (flag `TREE_ENABLED`). |
| Rewards (Sprint 3) | 📘 Đã lên kế hoạch | Spec `docs/REWARDS_MODULE_SPEC.md`, migration skeleton `116_rewards_catalog.sql`, flag `REWARDS_ENABLED=false`. |
| Family Module | 🚧 Phase B backend | Phase A (schema + flag) hoàn tất; Phase B đã có API list/add/remove/dashboard với permission; Phase C (log hộ + emergency) pending. |
| CI & Docker workflows | ✅ Ổn định | Core CI (lint/type/test/build), Docker Build & Smoke (ping `/api/qa/selftest`), Extended QA chờ dữ liệu lab. |
| Các module khác | 🟧 Follow-up | Life Tree rendering nâng cao, Family Phase B (Viewer flows), Reward UI, Dia Brain bridge events, Emergency Mode pending sau MVP. |

1) Kiến trúc hệ thống (Asinu)
1.1 Sơ đồ tổng quát
[ASINU APP — Next.js 15 (TARGET) / 14.2.7 (CURRENT)]
   ├─ Auth (JWT cookie ký WebCrypto)
   ├─ UI: Mission, Life Tree, Health Logs, Family, Reports
   ├─ Storage: Viettel S3 (presigned)
   ├─ DB access (giai đoạn 1: trực tiếp; giai đoạn 2: qua API)
   └─ Bridge → Dia Brain (HTTPS, JWT, ẩn danh)

[ASINU API — FastAPI]  ← (Giai đoạn 2 – optional ở P1)
   ├─ Domain dịch vụ: missions, logs, family, reports
   ├─ Postgres 16 (schema asinu_app)
   ├─ Redis (TTL/queue)
   └─ Bridge client → Dia Brain

1.2 Triển khai (Docker Compose – bước tối thiểu P1)

services:

asinu-app (Next.js)

asinu-postgres:16 (nâng từ 15 → 16; nếu chưa kịp, ghi planned)

asinu-redis (planned – bật ở P2 nếu cần)

volumes: pgdata, redisdata

networks: asinu_net

Giai đoạn 1: vẫn monolith, chưa bắt buộc asinu-api.
Giai đoạn 2: thêm asinu-api (FastAPI + Uvicorn) và chuyển mọi /api/* logic sang đó.

2) Tính năng & Hành vi
2.1 Mission Lite (đang chạy)

Nhiệm vụ vàng/ngày: uống nước, vận động, ghi mood.

Check-in → cộng coin + E_day (năng lượng ngày).

API (giai đoạn 1 – nằm trong app):

GET /api/missions/today

POST /api/missions/checkin

Cron seed hằng ngày (00:05) sinh user_missions.

2.2 Life Tree 🌳

10 cấp độ theo E_day (0–50). SVG 9:16 không nền, Framer Motion rung nhẹ.

Hàm tính stage: life_tree.stage(E_day).

> Chi tiết trải nghiệm, hiệu ứng dopamine, và roadmap Life Tree xem `ASINU_LIFE_TREE_DOCS.md` (phiên bản 1.0).

**Roadmap thực thi (2025-11-12):**
- Sprint 1 (đang triển khai): dựng schema `tree_events`, `points_ledger`, `tree_state` + helper award điểm + API `/api/tree/state`.
- Sprint 2 (tiếp theo): dựng UI Life Tree (React/Three hoặc Lottie) + dopamine micro-feedback, chưa gắn rewards.
- Sprint 3+: ladder rewards & catalog, Sprint 4 tie-in Family Forest (sau khi Family Phase B bật).

2.3 Health Logs

Bảng & field:

log_bg(glucose_mmol, taken_at)

log_bp(systolic, diastolic, taken_at)

log_weight(weight_kg, bmi, taken_at)

log_sleep(start_at, end_at, quality)

log_activity(type, minutes, steps, kcal)

log_meal(carbs_g, protein_g, fat_g, kcal)

log_mood(mood_score, note)

Phase sau: auto-log từ ngôn ngữ tự nhiên.

2.4 Family Mode

Gói 3 / 5 người; người thân xem dashboard, nhắc nhau, tặng Premium.

API (giai đoạn 1 – trong app):

GET /api/relative/list  
POST /api/relative/add  
DELETE /api/relative/remove  
GET /api/relative/dashboard?user_id=

> **Tiến độ:** Phase A (schema + flag) DONE. Phase B backend (list/add/remove/dashboard với kiểm soát owner/relative) đã hoàn thiện; Phase C (log hộ/editor + emergency alert) đang chờ UI/consent.

2.5 Reports & Alerts

Báo cáo tuần/tháng → PDF (reportlab hoặc node-pdf lib).

Cảnh báo chỉ số vượt ngưỡng, “quên check-in 3 ngày” (dùng TTL/Redis khi có).

3) Cơ sở dữ liệu (PostgreSQL)

TARGET: Postgres 16, schema asinu_app.
CURRENT: Postgres 15, schema public. → Migration 110→111 chuyển schema.

3.1 Bảng cốt lõi

Người dùng & hồ sơ

app_user(id uuid pk, email citext unique, phone text, password_hash text null, created_at timestamptz)

user_settings(user_id fk, locale, tz, notification_prefs jsonb)

Mission

missions(mission_id uuid pk, code text, title text, energy int, active_from, active_to)

user_missions(user_id, mission_id, mission_date, status, completed_at, unique(user_id, mission_id, mission_date))

mission_log(id pk, user_id, mission_id, action, created_at)

Health logs

log_bg, log_bp, log_weight, log_sleep, log_activity, log_meal, log_mood (có user_id, taken_at/created_at, **logged_by** để track ghi hộ)

Gia đình

family(id pk, name, created_by) **(legacy – được thay bằng relatives)**

relatives(id uuid pk, owner_user_id, relative_user_id, relation, role, created_at, unique(owner_user_id, relative_user_id), logged_by audit thông qua các bảng log)

notifications(id pk, user_id, family_id, type, payload jsonb, created_at) *(đang freeze)*

Tổng hợp

metrics_day(user_id, day, bg_avg, steps, kcal, mood_avg, e_day)

metrics_week(user_id, week, …)

Bridge

bridge_log(id pk, event_id, user_id, user_hash, type, payload jsonb, status, created_at)

Life Tree Ledger

tree_events(id, user_id, event_type, amount, meta, idempotency_key, created_at)  
points_ledger(id, user_id, delta, reason, event_id, idempotency_key, created_at)  
tree_state(user_id pk, total_points, level, e_day, streak, last_event_at, updated_at)

3.2 RLS (áp dụng khi chuyển sang API hoặc ngay trong app nếu đã set GUC)
-- ví dụ: health_log
ALTER TABLE asinu_app.log_bg ENABLE ROW LEVEL SECURITY;

CREATE POLICY log_bg_owner_sel ON asinu_app.log_bg
FOR SELECT USING (user_id = current_setting('asinu.user_id', true)::uuid);

CREATE POLICY log_bg_owner_ins ON asinu_app.log_bg
FOR INSERT WITH CHECK (user_id = current_setting('asinu.user_id', true)::uuid);


App/API set GUC: SET LOCAL asinu.user_id = '<uuid>'; cho mỗi request sau khi xác thực.

4) API contract (để Codex scaffold)

P1 (monolith): routes nằm trong Next.js.
P2 (tách API): giữ nguyên contract, chỉ đổi host.

4.1 Auth (nếu app xử lý)

POST /api/auth/login → {token, user}

GET /api/me (bearer) → {user, settings}

Cookie: asinu.sid = JWT (JWS), ký WebCrypto, exp 7 ngày.

4.2 Missions

GET /api/missions/today → danh sách nhiệm vụ ngày + trạng thái

POST /api/missions/checkin {mission_id} → 200 + cập nhật coin/E_day

4.3 Health Logs (ví dụ)

POST /api/logs/bg {glucose_mmol, taken_at}

POST /api/logs/mood {mood_score, note}

4.4 Family

GET /api/family/dashboard

POST /api/family/notify {to_user_id, message}

4.5 Reports

GET /api/reports/daily|weekly?date=YYYY-MM-DD → JSON + link PDF (nếu có)

4.6 Bridge (App→Dia Brain qua Asinu)

POST /api/bridge/emit

{
  "event_id": "uuid",
  "user_hash": "HMAC(user_id, ASINU_SECRET)",
  "type": "log_mood",
  "data": {"mood_score": 4, "ts": "2025-11-11T09:00:00Z"}
}

5) Storage & CDN

Viettel S3: upload/download qua presigned URL (10–15’).

Thư mục khuyến nghị:

asinu/media/{user_id}/...

asinu/reports/{user_id}/...

Có thể đẩy qua Caddy hoặc Cloudflare CDN.

6) Bảo mật

JWT (JWS) ký WebCrypto, rotate key 90 ngày.

RLS tại DB; không query chéo người dùng.

Rate limit (Redis khi sẵn): 100 req/5 phút/IP.

Bridge: HTTPS + Authorization: Bearer <BRIDGE_JWT>; IP allowlist.

4.7 Life Tree

GET /api/tree/state → trạng thái cây (level, E_day, streak, next milestone).  
POST /api/tree/event (tbd) → ingest điểm từ nhiệm vụ/log.

Tuyệt đối không gửi PII sang Dia Brain; chỉ user_hash + dữ liệu đã chuẩn hoá.

7) ENV (mẫu)
# App
APP_PORT=3000
NODE_ENV=production
JWT_ISS=asinu
JWT_AUD=asinu.app
JWT_PRIVATE_KEY=...
WEBCRYPTO_SECRET=...

# DB
PGHOST=asinu-postgres
PGPORT=5432
PGUSER=asinu
PGPASSWORD=...
PGDATABASE=asinu_db   # đổi từ diabotdb
PG_SCHEMA=asinu_app   # TARGET

# Redis (planned)
REDIS_URL=redis://asinu-redis:6379/0

# S3
S3_ENDPOINT=https://s3.viettelcloud.vn
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET=asinu-bucket

# Bridge
BRIDGE_URL=https://api.diabrain.top/v1/bridge/emit
BRIDGE_KEY=...

8) Roadmap kỹ thuật (trùng với repo thực tế)

P1 – Chuẩn hoá hiện trạng (ngay)

 Nâng DB name + schema: diabotdb/public → asinu_db/asinu_app (migration 111).

 Chuẩn hoá Auth cookie → JWT (JWS) ký WebCrypto.

 Giữ monolith, không thêm FastAPI/Redis vào runtime nếu chưa cần.

P2 – Tách API (1 tuần)

 Tạo service asinu-api (FastAPI), port 8080.

 Port dần /api/missions, /api/logs, /api/reports sang API.

 Thêm Redis (rate limit/TTL/queue nhẹ).

P3 – Analytics & Alerts (tuỳ tải)

 ClickHouse cho thống kê & báo cáo nhanh.

 Queue background (RQ/Celery) cho Bridge/reports.

Definition of Done

App không truy DB trực tiếp (sau P2).

DB 16 + schema asinu_app; RLS hoạt động.

Bridge ẩn danh, log 2 đầu.

Tài liệu này thay thế DIABOT_Master_Spec_V5.

9) Nguyên tắc ranh giới với Dia Brain (tóm lược)

Tách rời hạ tầng & lưu trữ.

Dòng dữ liệu 1 chiều: Asinu → Dia Brain, payload ẩn danh (user_hash), không PII.

Dia Brain trả gợi ý (text/tone/mission_hint) – không dữ liệu người thật.

Tất cả call Bridge: HTTPS + JWT + IP allowlist + audit log 2 phía.

10) UI khung (để Codex/Wedev bám theo)

Dashboard: Life Tree + E_day, Missions today, quick logs.

Missions: checklist, coin, lịch sử ngày.

Health: biểu đồ 7/30 ngày (BG, BP, weight, steps, sleep).

Family: danh sách thành viên, nhắc nhở, trạng thái.

Reports: xem/tải PDF tuần/tháng.

11) Acceptance Criteria (cho QA)

Tạo user → login (JWT cookie) → RLS đúng user.

Seed mission lúc 00:05, GET /missions/today hiển thị đúng.

Check-in 3 nhiệm vụ → E_day cập nhật, Life Tree đổi stage.

Ghi 3 loại log (bg/bp/mood) → metrics_day cập nhật.

Bridge emit 1 event → ghi bridge_log status=sent.

Backup S3 chạy tay thử (script) → file xuất hiện ở prefix đúng.
