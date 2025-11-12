# QA Freeze Checklist – DIABOT MPV

## A. Compliance
- [ ] A1 Account Deletion: xác nhận 2 bước, `DELETE /api/profile/delete` → 200, UI redirect `/auth/login`
- [ ] A2 Privacy/Terms: `/privacy`, `/terms` hiển thị + link ở Auth/Settings
- [ ] A3 Disclaimer: `/about` + Onboarding có cảnh báo y tế
- [ ] A4 Permission rationale: “late-ask” hiển thị đúng ngữ cảnh
- [ ] A5 Empty states: Chart/Timeline không crash khi trống (hiện CTA)
- [ ] A6 Apple Sign-in: nút UI xuất hiện, flow OAuth backend chạy

## B. Core (mock hoạt động)
- [ ] B1 Reminders thuốc: tạo/sửa/xóa, danh sách hiện đúng
- [ ] B2 Reminders ăn/ngủ: reuse engine, lưu & hiển thị
- [x] B3 Meal log: items/portion/ảnh; upload Storage; thumbnail hiển thị
- [x] B4 Export CSV: tải được 7 ngày gần nhất (`/api/export`)
- [x] B5 Demo seed: bật `NEXT_PUBLIC_CHART_USE_DEMO=true`, chart 7/30 hiển thị khi trống data

## C. UI/UX
- [x] C1 Auth polish: font ≥15.5px, hit-area ≥44px, contrast ≥4.5
- [ ] C2 Onboarding 3 bước: Quyền → Mục tiêu → Nhắc; vào app mượt
- [x] C2.1 Onboarding flow 3 bước:
  - [x] Hoàn thành flow → gọi POST /api/profile/setup/complete trả 200.
  - [x] Sau khi hoàn thành, profile của user có `prefs.onboarded = true`.
  - [x] Goals được lưu qua POST /api/profile/goals trả 200.
  - [x] Goals có thể được truy xuất qua GET /api/profile/goals trả 200.


## D. QA & Deploy
- [x] D1 Smoke script: xanh cho các route chính
- [ ] D2 Android: có tài liệu build .aab + Data Safety form (template)
- [ ] D3 iOS: có tài liệu TestFlight + App Privacy (Nutrition Labels)
