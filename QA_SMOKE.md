# QA Smoke Checklist (sau deploy)
> Tip: chạy `npm run smoke` với `ASINU_SMOKE_SESSION=<cookie>` để tự động hóa các bước Auth → Mission → Rewards/Donate → Bridge → Healthz. Các POST sẽ chỉ thực thi khi `SMOKE_ALLOW_WRITES=1`.
- [ ] GET /api/qa/selftest → **200**
- [ ] HEAD / (chưa login) → **302** /login
- [ ] GET /auth/login → **200**
- [ ] GET /api/chart/7d → **200** JSON hợp lệ
- [ ] POST /api/log/bg → **201**
- [ ] POST /api/log/water → **201**
- [ ] POST /api/log/bp → **201**
- [ ] RLS: user A **không** thấy data user B
- [ ] Healthcheck ghi log OK/Fail vào `/opt/diabot/health_fail.log`
- [ ] S3: file backup mới nhất có trong bucket

## Staging Log Review — 2025-11-18
| Hạng mục | Trạng thái | Ghi chú |
|----------|-----------|---------|
| Native auth migrations | ✅ SUCCESS | `psql -v ON_ERROR_STOP=1 ... -f migrations/118_native_auth.sql` và `117_reward_wallet.sql` trả về toàn NOTICE "already exists" → schema đã áp dụng, không lỗi mới. |
| Env / service reload | ⚠️ WARNING | `docker inspect asinu-app` báo **unhealthy** (healthcheck exit code 8) dù container vẫn chạy; cần sửa `/api/qa/selftest` hoặc healthcommand trước khi coi staging ổn định. |
| OTP cleanup timer | ❌ ERROR | `/var/log/asinu/otp_cleanup.log` spam `tsx: not found` và `getaddrinfo ENOTFOUND asinu-postgres`; job không thể kết nối DB → cần chạy script từ runtime có tsx/node và cập nhật host/resolver. |
| `/api/healthz` | ❌ ERROR | `curl http://localhost:3000/api/healthz` trả HTTP 503, payload `database.status = error (getaddrinfo ENOTFOUND asinu-postgres)` → app không truy cập được Postgres bằng hostname hiện tại. |
