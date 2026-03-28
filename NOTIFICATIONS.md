# Hệ thống Thông báo (Push Notification)

## 1. Luồng hoạt động tổng quan

```
App khởi động (SessionProvider)
  → xin quyền thông báo
  → lấy Expo Push Token
  → gửi token lên backend (users.push_token)

Cron job chạy mỗi giờ (backend)
  → kiểm tra điều kiện từng user
  → gửi push qua Expo Push Service
  → lưu vào bảng notifications (in-app)

User nhận thông báo ngoài app (push)
  → nhấn vào → mở app
  → thông báo hiện trong chuông (NotificationBell)
```

---

## 2. Các loại thông báo push (ngoài app)

### Nhóm A — Cron định kỳ (`basic.notification.service.js`)

| Type | Gửi khi | Điều kiện thêm | Cooldown |
|------|---------|----------------|----------|
| `reminder_log_morning` | Giờ sáng đã cài (default 8h) | Chưa log hôm nay | 1 lần/ngày |
| `reminder_afternoon` | Giờ chiều đã cài (default 14h) | — | 1 lần/ngày |
| `reminder_log_evening` | Giờ tối đã cài (default 21h) | Chưa log tối | 1 lần/ngày |
| `reminder_glucose` | Giờ sáng | Có tiểu đường + chưa đo | 1 lần/ngày |
| `reminder_bp` | Giờ sáng | Có huyết áp + chưa đo | 1 lần/ngày |
| `reminder_medication_morning` | Giờ sáng | Có bệnh nền + chưa uống thuốc | 1 lần/ngày |
| `reminder_medication_evening` | Giờ tối | Có bệnh nền + chưa uống thuốc | 1 lần/ngày |
| `streak_7` / `streak_14` / `streak_30` | Giờ sáng | Đạt chuỗi milestone | 1 lần/25 ngày |
| `weekly_recap` | Chủ nhật 20:00 | — | 1 lần/tuần |

### Nhóm B — Checkin flow (kích hoạt theo hành vi user, `checkin.service.js`)

| Type | Gửi cho | Khi nào | Cooldown |
|------|---------|---------|----------|
| `morning_checkin` | User | 7:00 mỗi sáng | 1 lần/ngày |
| `checkin_followup` | User | Miss lần 1 (sau 2–4h không trả lời) | Theo `next_checkin_at` |
| `checkin_followup_urgent` | User | Miss lần 2+ | Theo `next_checkin_at` |
| `caregiver_alert` | Caregiver | User không phản hồi nhiều lần / AI thấy nguy hiểm | CRITICAL — không cooldown |
| `emergency` | Caregiver | User báo khẩn cấp | CRITICAL — không cooldown |
| `health_alert` | User / Caregiver | AI phát hiện triệu chứng nghiêm trọng | 30 phút |
| `caregiver_confirmed` | User (bệnh nhân) | Caregiver đã xác nhận hành động | — |

### Nhóm C — Care Circle (`careCircle.service.js`)

| Type | Gửi cho | Khi nào | Cooldown |
|------|---------|---------|----------|
| `care_circle_accepted` | Người gửi lời mời | Được chấp nhận vào vòng kết nối | 30 phút |

### Nhóm D — AI Engagement (`engagement.notification.service.js`)

| Type | Gửi cho | Khi nào | Cooldown |
|------|---------|---------|----------|
| `engagement` | User | User không active lâu, AI tạo nội dung cá nhân hoá | 120 phút |

---

## 3. Kênh Android (Notification Channels)

| Channel | Âm thanh | Rung | Dùng cho |
|---------|----------|------|----------|
| `reminder` | asinu_reminder.wav | nhẹ | Nhắc nhở hàng ngày |
| `alert` | asinu_alert.wav | mạnh | Cảnh báo sức khoẻ |
| `care-circle` | asinu_care.wav | vừa | Vòng kết nối |
| `checkin` | asinu_reminder.wav | vừa | Check-in |
| `milestone` | asinu_milestone.wav | ngắn | Thành tích / streak |

---

## 4. Thời gian gửi thông báo (Smart Schedule)

Backend học từ lịch sử 60 ngày để tìm giờ tốt nhất:
- **Buổi sáng** (5–11h): dựa theo giờ user hay ghi log buổi sáng
- **Buổi chiều** (14h): mặc định, chưa có inference
- **Buổi tối** (17–23h): dựa theo giờ user hay ghi log buổi tối

Fallback: User set → Inference → Mặc định (sáng 8h, tối 21h)

---

## 5. File quan trọng

### Frontend
| File | Vai trò |
|------|---------|
| `src/lib/notifications.ts` | Setup handler, xin quyền, lấy token, tạo Android channels |
| `src/stores/notification.store.ts` | State: danh sách, unread count, fetch/read/delete |
| `src/features/notifications/notifications.api.ts` | API calls đến backend |
| `src/components/NotificationBell.tsx` | UI chuông thông báo |
| `src/providers/SessionProvider.tsx` | Khởi tạo khi app mở |

### Backend
| File | Vai trò |
|------|---------|
| `src/services/notification/basic.notification.service.js` | 11 loại nhắc nhở định kỳ |
| `src/services/notification/push.notification.service.js` | Gửi lên Expo Push Service |
| `src/services/notification/smart.schedule.service.js` | Học giờ tốt nhất từ hành vi |
| `src/services/notification/engagement.notification.service.js` | AI re-engagement |
| `src/services/notification/notification.orchestrator.js` | Cooldown, chống spam |
| `src/constants/index.js` | NOTIF_MAP: catalog 21 loại |

---

## 6. Trạng thái issues

### ✅ Đã fix

**[1] Token xóa khi tắt thông báo** — Endpoint đã tồn tại, settings đã gọi đúng.

**[2] Token lưu sau đăng nhập lại** — SessionProvider đã tách effect riêng theo `[authToken, expoPushToken]`.

**[3] Timezone Vietnam** — `basic.notification.service.js` đã dùng `nowVN()` với Asia/Ho_Chi_Minh.

**[4] Quiet hours 22:00–05:00** — `runBasicNotifications` bỏ qua tất cả reminder, chỉ chạy checkin follow-ups.

**[5] Afternoon smart inference** — `inferHours` đã infer `afternoon_hour` (11–16h), `refreshInferredHours` lưu `inferred_afternoon_time`, `afternoonMatch` dùng giờ đã infer.

**[6] File cũ** — Đã xóa `notifications 2.ts` và `notification.store 2.ts`.

**[7] NotificationBell fetch khi app mở** — `home/index.tsx` thêm `AppState` listener, fetch ngay khi app về foreground.

**[8] UI chỉnh giờ thông báo** — Settings đã có section "Giờ nhắc nhở" với time picker cho sáng/chiều/tối.

---

## 7. Fix đã thực hiện (thông báo ngoài app)

**[9] Logout không xóa push_token** — `mobile.routes.js` `/auth/logout` chỉ return 200 mà không xóa token → cron vẫn gửi sau khi logout. Đã fix: route gọi `logout(pool, userId)` trong `auth.service.js` để `UPDATE users SET push_token = NULL`.

**[10] Orchestrator dùng in-memory cooldown** — `notification.orchestrator.js` dùng `Map` lưu thời gian gửi gần nhất → mất khi server restart → cron gửi lại toàn bộ. Đã fix: thay bằng DB query `SELECT FROM notifications WHERE created_at >= NOW() - interval`.

---

## 8. API endpoints thông báo

```
GET    /api/notifications              Lấy danh sách
PUT    /api/notifications/:id/read     Đánh dấu đã đọc
PUT    /api/notifications/mark-all-read Đọc tất cả
DELETE /api/notifications/:id          Xóa một
DELETE /api/notifications              Xóa tất cả
GET    /api/notifications/preferences  Lấy preferences
PUT    /api/notifications/preferences  Cập nhật preferences

POST   /api/notifications/basic/run    [Cron] Chạy nhắc nhở
POST   /api/notifications/engagement/run [Cron] Chạy AI engagement
```
