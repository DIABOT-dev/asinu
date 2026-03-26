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

## 2. Các loại thông báo (21 loại)

### CRITICAL — không có cooldown
| Type | Mô tả |
|------|-------|
| `emergency` | Cảnh báo khẩn từ caregiver |
| `checkin_followup_urgent` | Follow-up sức khoẻ khẩn |

### HIGH — cooldown 30 phút
| Type | Mô tả |
|------|-------|
| `health_alert` | Chỉ số sức khoẻ bất thường |
| `caregiver_alert` | Thông báo cho caregiver |
| `morning_checkin` | Check-in buổi sáng |
| `care_circle_invitation` | Mời vào vòng kết nối |
| `care_circle_accepted` | Chấp nhận lời mời |

### MEDIUM — cooldown 60 phút
| Type | Mô tả |
|------|-------|
| `reminder_glucose` | Nhắc đo đường huyết |
| `reminder_bp` | Nhắc đo huyết áp |
| `reminder_medication_morning/evening` | Nhắc uống thuốc |
| `reminder_log_morning/evening` | Nhắc ghi chỉ số |
| `reminder_afternoon` | Nhắc buổi chiều |

### LOW — cooldown 120 phút
| Type | Mô tả |
|------|-------|
| `reminder_water` | Nhắc uống nước |
| `streak_7/14/30` | Đạt chuỗi ngày liên tiếp |
| `weekly_recap` | Tổng kết tuần (Chủ nhật 20h) |
| `engagement` | AI re-engagement cá nhân hoá |

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

## 7. Fix ưu tiên ngay (thông báo ngoài app)

### Fix [1] — Token deletion endpoint

Trong `backend.asinu/src/routes/auth.routes.js` hoặc `mobile.routes.js`, cần có:
```js
router.delete('/push-token', authMiddleware, async (req, res) => {
  await pool.query('UPDATE users SET push_token = NULL WHERE id = $1', [req.user.id]);
  res.json({ ok: true });
});
```

### Fix [3] — Timezone Vietnam cho notification

Trong `basic.notification.service.js`, thay:
```js
const hour = new Date().getUTCHours(); // UTC
```
thành:
```js
const nowVN = new Date(Date.now() + 7 * 60 * 60 * 1000);
const hour = nowVN.getUTCHours(); // UTC+7
const minute = nowVN.getUTCMinutes();
```

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
