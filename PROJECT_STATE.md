# PROJECT STATE: ASINU-DIABRAIN
> Last Updated: 2025-12-19 13:53
> Status: RED (Critical)

## 1. MỤC TIÊU TỐI THƯỢNG (CURRENT P0)
- [ ] SHIP ASINU LITE MVP LÊN CH PLAY (Deadline: 30 ngày)
- [ ] Fix crash `dev-client` trên Mobile.
- [ ] Kết nối API Login/Register Mobile -> Backend.

## 2. BACKLOG KỸ THUẬT (Những việc đang dở dang)
### A. Mobile (Asinu Lite)
- Environment: Windows repo root; Expo SDK 54 (`expo` ^54.0.0); React Native 0.81.5; npm 10.9.0 (packageManager). Node version chưa thấy khai báo.
- Error hiện tại: Chưa thấy log lỗi trong repo; có ghi chú reset dev-client/Hermes trong `OPS_DEVCLIENT_RESET.md`.
- Thiết bị test: Chưa có ghi chú trong repo.

### B. Backend (Dia-Brain)
- Docker Status: Không thấy `docker-compose`/Dockerfile trong repo này.
- Data: Không có thông tin migrate/seed trong repo này.

## 3. MÔI TRƯỜNG & SECRETS (Checklist)
- [x] File `.env` đã được clean chưa? (Yes) — chỉ có biến `EXPO_PUBLIC_*`.
- [ ] Đã có `OPENAI_API_KEY` hay đang chạy Demo Mode? (Demo — không thấy `OPENAI_API_KEY` trong `.env`).
- [ ] Database URL đang trỏ về đâu? (Chưa thấy trong repo; chỉ có `EXPO_PUBLIC_API_BASE_URL=https://asinu.top/api`).

## 4. GHI CHÚ CHO AI (CONTEXT)
- Đừng đụng vào folder: `src/_archive/legacy-ui/*`.
- Ưu tiên sửa file: `app.json` trước.
