# SYSTEM ARCHITECTURE (FINAL MANUAL LOCK)

## 1. SOURCE OF TRUTH
- **ROOT (`./`):** Code base thực tế.
- **Mobile Screens:** `src/app/` (Đã xác nhận: nằm trong folder src).
- **Config:** `app.json` tại Root.

## 2. RUNTIME RULE (BẮT BUỘC)
- **Port:** 19000 (Cố định).
- **Host:** 127.0.0.1 (Để tránh lỗi WSL Network).
- **Lệnh chạy chuẩn:** `npx expo start --clear --host 127.0.0.1 --port 19000`
