# Asinu Lite v1.0.0

## 📌 BÁO CÁO KỸ THUẬT CHỐT GỐC PHIÊN BẢN (v1.0.0-RC1 - 11/06/2026)

*   **Mục tiêu:** Khóa mốc đồng bộ cấu hình và hạ tầng chuẩn để phát hành.
*   **Trạng thái đồng bộ:** 🟢 **Hoàn tất đồng bộ 100%**.
*   **Các điểm chuẩn hóa cấu hình đã thực hiện:**
    1.  **Đồng bộ Package ID Android native:** Đổi `applicationId` và `namespace` trong `android/app/build.gradle` thành `"com.asinu.lite"` cho khớp Firebase.
    2.  **Dọn dẹp GitHub EAS Build Workflow:** Sửa lỗi sai thư mục `apps/mobile/` trong `.github/workflows/eas-build.yml` đưa về root.
    3.  **Quy chuẩn hóa endpoint Health Check trong CI/CD:** Loại bỏ hoàn toàn endpoint lỗi thời `/api/qa/selftest` (404) và chuyển sang `/healthz` (200 OK live trên VPS 2) trong cả 3 workflows: `deploy.yml`, `docker.yml`, `qa_db.yml`.
    4.  **Tích hợp script Audit Assets:** Tạo mới `scripts/check-assets.js` giúp tự động kiểm tra đủ 4 file âm thanh SOS và icon trước khi prebuild.

---

## Tổng quan

Đây là ứng dụng mobile `Expo React Native` cho iOS và Android, tập trung vào theo dõi sức khỏe cá nhân, check-in hằng ngày, kết nối người thân qua Care Circle, nhận cảnh báo, thanh toán Premium và ví nội bộ.

README này mô tả **trạng thái thực tế của phiên bản đang có trong repo** tại thời điểm kiểm tra mã nguồn ngày `2026-06-11`. Nội dung được tổng hợp từ routes trong `app/`, module nghiệp vụ trong `src/features/`, cấu hình `app.json`, workflow CI/CD và các tài liệu `docs/`.

## Thông tin phiên bản

- Tên app: `Asinu`
- Slug Expo: `asinu-lite`
- Version app: `1.0.0`
- Nền tảng build: `iOS`, `Android`
- Bundle ID iOS: `com.asinu.lite`
- Package Android trong `app.json`: `com.asinu.lite`
- New Architecture: bật
- Kiến trúc điều hướng: `expo-router`
- Ngôn ngữ hiện có: `vi`, `en`

## Stack kỹ thuật

- Framework: `Expo` `~54.0.0`
- React / React Native: `19.1.0` / `0.81.5`
- Router: `expo-router`
- State chính: `zustand`
- Data fetching: `@tanstack/react-query`
- I18n: `i18next`, `react-i18next`, `expo-localization`
- Auth/OAuth: Google, Apple, Zalo, Facebook
- Notifications: `expo-notifications`
- In-app purchase: `expo-iap`
- Audio / voice input: `expo-av`
- Native storage: `expo-secure-store`, `@react-native-async-storage/async-storage`

## Cấu trúc chức năng chính

- `app/`: route-level screens
- `src/features/`: logic nghiệp vụ theo domain
- `src/components/`: UI dùng lại
- `src/lib/`: API client, notifications, env, realtime sync
- `src/i18n/`: cấu hình đa ngôn ngữ
- `assets/`: asset app và notification sounds
- `docs/`: tài liệu thanh toán, OAuth, IAP

## Tính năng đang có trong phiên bản này

### 1. Khởi động, bootstrap và consent

- Splash screen custom với bootstrap auth và điều hướng ban đầu.
- Kiểm tra quyền đồng ý dữ liệu trước khi cho vào app.
- Tự điều hướng theo trạng thái đăng nhập, onboarding và notification deep link.

Nguồn chính:
- `app/index.tsx`

### 2. Đăng nhập và xác thực

- Đăng nhập email/password.
- OAuth social login qua `Google`, `Apple`, `Zalo`, `Facebook`.
- Luồng callback riêng cho từng nhà cung cấp.
- Lấy hồ sơ người dùng sau xác thực và lưu session nội bộ.

Nguồn chính:
- `app/login/index.tsx`
- `app/login/email.tsx`
- `app/auth/google/callback.tsx`
- `app/auth/facebook/callback.tsx`
- `app/auth/zalo/callback.tsx`
- `src/features/auth/auth.service.ts`
- `src/features/auth/oauth.service.ts`

### 3. Onboarding và hồ sơ người dùng

- Luồng onboarding sau đăng nhập.
- Hồ sơ người dùng với thông tin cá nhân, bệnh nền, số điện thoại, avatar.
- Sửa hồ sơ từ màn profile.
- Hỗ trợ đổi mật khẩu khi tài khoản có password.

Nguồn chính:
- `app/onboarding/index.tsx`
- `app/(tabs)/profile/index.tsx`
- `src/features/profile/profile.api.ts`
- `src/features/profile/profile.store.ts`

### 4. Trang chủ sức khỏe

- Home dashboard hiển thị:
- chỉ số nhanh
- logs gần đây
- nhiệm vụ hôm nay
- health score
- notification bell
- tóm tắt dữ liệu tree / overview
- banner check-in nếu hôm nay chưa check-in
- điểm vào AI/chat nếu server cho phép

Nguồn chính:
- `app/(tabs)/home/index.tsx`
- `src/features/home/home.vm.ts`

### 5. Check-in sức khỏe hằng ngày

- Check-in tình trạng hằng ngày.
- Hỗ trợ flow câu hỏi, trạng thái sức khỏe và summary.
- Có ghi âm/voice input trong màn check-in.
- Có lấy báo cáo check-in theo tuần/tháng.

Nguồn chính:
- `app/checkin/index.tsx`
- `app/report/index.tsx`
- `src/features/checkin/checkin.api.ts`

### 6. Nhật ký sức khỏe

- Ghi log các loại:
- glucose
- blood pressure
- insulin
- meal
- medication
- water
- weight

- Có validation dữ liệu log.
- Có tổng hợp log về home và tree.
- Có tích hợp wellness logging để ghi nhận hành vi người dùng quanh flow sức khỏe.

Nguồn chính:
- `app/logs/index.tsx`
- `app/logs/glucose.tsx`
- `app/logs/blood-pressure.tsx`
- `app/logs/insulin.tsx`
- `app/logs/meal.tsx`
- `app/logs/medication.tsx`
- `app/logs/water.tsx`
- `app/logs/weight.tsx`
- `src/features/logs/logs.api.ts`
- `src/features/logs/logs.service.ts`
- `src/features/logs/logs.validation.ts`

### 7. Tree / Overview

- Màn hình tổng quan sức khỏe dạng overview.
- Hiển thị snapshot của glucose, huyết áp, cân nặng và trạng thái dữ liệu gần nhất.
- Dùng như màn tổng hợp thay cho kiểu dashboard chỉ số rời rạc.

Nguồn chính:
- `app/(tabs)/tree/index.tsx`
- `src/features/tree/tree.api.ts`
- `src/features/tree/tree.store.ts`

### 8. Missions

- Hệ thống nhiệm vụ hằng ngày.
- Có dữ liệu nhiệm vụ map theo ngôn ngữ.
- Có thể mở từ home và từ profile.

Nguồn chính:
- `app/(tabs)/missions/index.tsx`
- `src/features/missions/missions.api.ts`
- `src/features/missions/missions.store.ts`
- `src/features/missions/useMissionActions.ts`

### 9. Care Circle

- Kết nối người thân / caregiver.
- Mời tham gia, chấp nhận, từ chối, hủy lời mời.
- Xem danh sách kết nối.
- Xem màn chi tiết thành viên.
- Có điều kiện backend flag cho khả năng caregiver alert, caregiver view logs, caregiver acknowledge.

Nguồn chính:
- `app/(tabs)/care-circle/index.tsx`
- `app/care-circle/index.tsx`
- `app/care-circle/invite.tsx`
- `app/care-circle/member/[id].tsx`
- `src/features/care-circle/care-circle.api.ts`
- `src/features/care-circle/care-circle.hook.ts`
- `src/features/app-config/flags.api.ts`

### 10. Notifications và cảnh báo

- Xin quyền push notification.
- Tạo Android notification channels riêng cho:
- reminder
- alert
- care-circle
- checkin
- milestone

- Có sound riêng cho từng nhóm thông báo.
- Có action buttons cho `health_alert`:
- `ACKNOWLEDGE`
- `ON_MY_WAY`
- `CALL`

- Hỗ trợ:
- lưu notification vào store cục bộ
- badge/unread count
- deep link theo payload notification
- re-notify local khi app foreground để hiện action buttons

Nguồn chính:
- `src/lib/notifications.ts`
- `src/features/notifications/notifications.api.ts`

### 11. AI Feed / Notes

- Có route feed danh sách và feed detail.
- Có điểm vào từ home và profile dưới nhãn AI notes/bookmark.
- Dữ liệu đi qua endpoint `health-feed`.

Nguồn chính:
- `app/feed/index.tsx`
- `app/feed/[id].tsx`
- `app/chat-notes/index.tsx`
- `app/(tabs)/home/index.tsx`
- `app/(tabs)/profile/index.tsx`

### 12. AI Chat

- Có màn hình chat AI riêng.
- Tải lịch sử chat.
- Gửi tin nhắn tới backend chat API.
- Có medical disclaimer modal.
- Có hỗ trợ voice recording trong layout chat.
- Kiểm tra trạng thái Premium để hiển thị upsell khi cần.

Nguồn chính:
- `app/ai-chat.tsx`
- `src/features/chat/chat.api.ts`
- `src/components/AiChatLayout.tsx`
- `src/components/MedicalDisclaimerModal.tsx`

### 13. Subscription / Premium

- Kiểm tra trạng thái `free` / `premium`.
- Hiển thị plans và FAQ.
- Mua gói qua:
- IAP
- QR payment
- wallet balance

- Poll trạng thái thanh toán.
- Restore purchases.
- Có lịch sử subscription.

Nguồn chính:
- `app/subscription/index.tsx`
- `src/features/subscription/plans.tsx`
- `src/features/iap/IapPurchaseCard.tsx`
- `src/features/iap/RestoreLink.tsx`
- `src/features/iap/iap.api.ts`
- `src/features/iap/iap.service.ts`

### 14. Tặng Premium cho người thân

- Có flow gift subscription cho người trong Care Circle.
- Hỗ trợ:
- tạo QR gift
- thanh toán gift bằng wallet
- chọn người nhận
- chọn plan

Nguồn chính:
- `app/subscription/gift.tsx`

### 15. Ví nội bộ

- Xem số dư.
- Nạp tiền qua QR.
- Xem lịch sử thanh toán.
- Poll trạng thái giao dịch.
- Được dùng cả như funding source cho subscription.

Nguồn chính:
- `app/wallet/index.tsx`

### 16. Cài đặt và tiện ích hệ thống

- Đổi cỡ chữ.
- Đổi ngôn ngữ `vi` / `en`.
- Cấu hình nhắc nhở.
- Chia sẻ app.
- Mở hỗ trợ qua Zalo.
- Xem Terms / Privacy / Data Deletion.
- Xóa tài khoản vĩnh viễn.

Nguồn chính:
- `app/(tabs)/profile/index.tsx`
- `app/reminder-config/index.tsx`
- `app/legal/content.tsx`

## Điều hướng người dùng hiện tại

### Tab bar đang hiển thị

- `Home`
- `Care Circle / Kết nối`
- `Tree / Tổng quan`
- `Profile`

### Có route nhưng không nằm trên tab bar

- `Missions`
- `Check-in`
- `Logs`
- `Feed`
- `AI Chat`
- `Wallet`
- `Subscription`
- `Subscription Gift`
- `Report`
- `Reminder Config`
- `Legal Content`
- `Care Circle Invite`
- `Care Circle Member Detail`

Ghi chú:
- `missions` cố ý bị ẩn khỏi tab bar nhưng vẫn mở được từ home, profile và deep link.

## Tính năng ẩn, khóa hoặc chưa bật mặc định

### 1. Tính năng có trong code nhưng đang hard-disable

Các cờ dưới đây bị ép `false` trong store, kể cả backend có trả khác đi:

- `ENABLE_REWARDS_WALLET`
- `ENABLE_FAMILY_MODE`
- `ENABLE_ADVANCED_AI`

Nguồn:
- `src/features/app-config/flags.store.ts`

### 2. AI Chat được mở theo backend flag

- Việc hiển thị entry point chatbot không mặc định luôn bật.
- App dùng `chatbot.available` hoặc fallback `FEATURE_AI_CHAT`.
- Nghĩa là route `app/ai-chat.tsx` tồn tại, nhưng cửa vào cho user phụ thuộc cờ backend.

Nguồn:
- `src/features/app-config/flags.api.ts`
- `src/features/app-config/flags.store.ts`
- `app/(tabs)/home/index.tsx`

### 3. Phone auth có code nhưng hiện đang tắt

- Hằng số `PHONE_AUTH_ENABLED = false`.
- Repo vẫn còn service `submitPhoneAuth`, nhưng bề mặt đăng nhập hiện không cho thấy đây là luồng mặc định.

Nguồn:
- `src/features/auth/auth.flags.ts`
- `src/features/auth/auth.service.ts`

### 4. Care Pulse có provider/store nhưng popup đang không render

- `CarePulseProvider` đang được mount ở app root.
- Nhưng `PulsePopup` trong provider đang bị comment.
- Điều này cho thấy engine/state của tính năng vẫn còn, nhưng popup check-in nhanh chưa bật hoàn toàn trên UI.

Nguồn:
- `app/_layout.tsx`
- `src/features/care-pulse/providers/CarePulseProvider.tsx`

### 5. Missions là tính năng bán ẩn

- Route vẫn tồn tại.
- Tab item bị `href: null`.
- Người dùng chỉ vào từ điểm điều hướng bên trong app hoặc deep link/push.

Nguồn:
- `app/(tabs)/_layout.tsx`

### 6. AI Notes / Feed là tính năng phụ, không nằm trong primary nav

- Có route và có entry từ home/profile.
- Không nằm trên tab chính.
- Có thể xem là tính năng phụ hoặc đang soft-launch.

### 7. Gift Premium là tính năng phụ trợ, không nằm trong nav chính

- Chỉ mở từ màn subscription.
- Không có tab hoặc shortcut riêng ở điều hướng chính.

### 8. Voice features đã hiện diện ở nhiều nơi

- Check-in có ghi âm.
- AI chat layout có ghi âm.
- Có `VoiceLogButton` và `voice.api.ts`.

Tùy backend/runtime, đây có thể là tính năng đang rollout dần chứ không phải tất cả màn đều lộ công khai như nhau.

Nguồn:
- `app/checkin/index.tsx`
- `src/components/AiChatLayout.tsx`
- `src/components/VoiceLogButton.tsx`
- `src/features/logs/voice.api.ts`

## Đa ngôn ngữ

- Namespace hiện có:
- `common`
- `home`
- `profile`
- `missions`
- `tree`
- `settings`
- `auth`
- `onboarding`
- `careCircle`
- `chat`
- `logs`
- `subscription`
- `report`
- `wallet`

- File locale đang có đầy đủ cho `vi` và `en`.
- Qua kiểm tra mã nguồn, keysets `vi/en` đang khớp nhau.

Nguồn:
- `src/i18n/index.ts`
- `src/i18n/locales/`

## Âm thanh thông báo hiện có

Repo hiện chứa 4 asset âm thanh logic:

- `asinu_reminder.wav`: nhắc nhở hằng ngày, check-in, local reminders
- `asinu_alert.wav`: cảnh báo sức khỏe / caregiver alert
- `asinu_care.wav`: Care Circle invitation / acceptance
- `asinu_milestone.wav`: thành tích / milestone / recap

Các file này được bundle cho Expo/iOS và copy vào `android/app/src/main/res/raw` cho Android notification channel.

Nguồn:
- `src/lib/notifications.ts`
- `scripts/generate-sounds.js`
- `app.json`

## Backend dependencies quan trọng

App phụ thuộc mạnh vào các nhóm API sau:

- `/api/mobile/auth/*`
- `/api/auth/*`
- `/api/mobile/profile/*`
- `/api/mobile/flags`
- `/api/mobile/checkin/*`
- `/api/subscriptions/*`
- `/api/payments/*`
- `/api/health-feed*`
- API logs / tree / missions / care-circle / notifications

Lưu ý:
- Repo này là mobile client; không chứa đầy đủ implementation backend route.

## Build và phân phối

### Mobile

- iOS và Android build bằng Expo / native project đi kèm.
- Android có cấu trúc native `android/`.
- iOS có cấu trúc native `ios/`.
- Có `eas.json` cho build profiles.

### CI/CD hiện có trong repo

- `deploy.yml`
- `docker.yml`
- `qa_db.yml`
- `eas-build.yml`

Ghi chú kỹ thuật tại thời điểm kiểm tra:
- Repo đã được chỉnh workflow để bỏ phụ thuộc `selftest` cũ trong CI/deploy và chuyển sang `healthz`.

## Tài liệu đi kèm repo

- `docs/DEPLOY_IAP.md`
- `docs/GOOGLE_OAUTH_CLIENT_ID_FIX.md`
- `docs/IAP_ENV_VARS.md`
- `docs/IAP_SETUP_GUIDE.md`
- `docs/PAYMENT_TEST_FLOW.md`

Các tài liệu này tập trung vào:
- IAP
- môi trường thanh toán
- OAuth Google
- flow test payment

## Đánh giá trạng thái sản phẩm của phiên bản này

### Nhóm tính năng đã khá rõ ràng và thành hình

- auth social
- onboarding
- home dashboard
- health logs
- daily check-in
- care circle
- notifications
- premium subscription
- wallet
- gift premium
- localization `vi/en`

### Nhóm tính năng có dấu hiệu rollout chọn lọc hoặc chưa fully surfaced

- AI chat
- AI notes / feed
- care pulse popup
- phone auth
- reward wallet mode
- family mode
- advanced AI
- mission tab trên điều hướng chính

## File tham chiếu chính

- `app/`
- `src/features/`
- `src/lib/notifications.ts`
- `src/i18n/index.ts`
- `app.json`
- `eas.json`

## Kết luận

Phiên bản hiện tại của Asinu Lite không còn là một MVP cực nhỏ. Nó đã có đủ các trục sản phẩm chính: theo dõi sức khỏe, nhật ký, check-in, cảnh báo, người thân đồng hành, thanh toán Premium, ví và đa ngôn ngữ. Đồng thời, trong code vẫn còn một lớp tính năng đang được giữ ở trạng thái ẩn hoặc rollout có kiểm soát thông qua route phụ, feature flag hoặc hard-disable.
