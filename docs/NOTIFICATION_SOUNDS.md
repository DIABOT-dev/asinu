# Bộ âm thanh thông báo Asinu – Warm v1

Nguồn: bộ `Asinu_NhacChuong_AmAp` do người dùng cung cấp. Nhập nguyên bản CAF từ `ios_caf/` và OGG từ `android_ogg/`, không tổng hợp lại nhạc hoặc thay giọng đọc. Giọng Tuấn Anh và file hướng dẫn mở app sau khi nghe cuộc gọi giữ nguyên.

## Ghép âm thanh

| Ngữ cảnh | iOS | Android |
| --- | --- | --- |
| Cuộc gọi check-in thường, kể cả mức MILD | `asinu_incoming.caf` | `asinu_incoming.ogg` |
| Cuộc gọi URGENT, URGENT_REPEAT, SOS, cảnh báo sức khỏe khẩn cấp | `asinu_emergency.caf` | `asinu_emergency.ogg` |
| Thông báo xác nhận sau khi người thân không trả lời cuộc gọi (`checkin_call/FALLBACK`, không URGENT) | `asinu_missed.caf` | `asinu_missed.ogg` |
| Nhắc check-in, vòng kết nối, chuyên gia, thành tích, gói chăm sóc/thanh toán | `asinu_notification.caf` | `asinu_notification.ogg` |
| Chờ người nhận trả lời cuộc gọi đi | `asinu_ringback.caf` | `asinu_ringback.ogg` |

`ringback` chỉ được đóng gói để dùng về sau; hiện app không có luồng cuộc gọi đi nên không tự phát. Không tạo thêm sự kiện cuộc gọi nhỡ: `missed` được ghép với thông báo FALLBACK vốn có trong nghiệp vụ. FALLBACK có severity URGENT vẫn dùng nhạc emergency.

Thông báo loại chưa được liệt kê dùng nhóm nhắc nhở/nhạc notification; `requiresImmediate: true` hoặc `alertType: emergency` được ưu tiên nhóm cảnh báo. Không dùng nhạc emergency cho thông báo thanh toán thông thường.

## Các lớp triển khai

- `src/config/notification-sounds.json`: danh mục 5 âm thanh, 9 nhóm thông báo và các loại sự kiện. Backend có cùng manifest tại `src/config/notification-sounds.json`; test kiểm tra hai bản trùng nhau.
- iOS: CAF được thêm vào Resources của Xcode; CallKit chọn incoming hoặc emergency trước khi báo cuộc gọi đến. Expo push/local notification dùng tên CAF.
- Android: OGG được đóng gói trong `res/raw/`. Expo notification dùng channel có hậu tố `warm_v1`; dịch vụ FCM cuộc gọi dùng channel riêng có hậu tố `warm_v2`. Kênh cuộc gọi và cảnh báo dạng thông báo tách riêng để không nhầm mức âm lượng ringtone/notification.
- `plugins/withAsinuNotificationSounds.js`: tự đồng bộ đúng định dạng cho từng nền tảng khi prebuild, chặn trùng basename trong Android raw resources.
- Giữ 4 WAV và 6 channel cũ để app mới vẫn nhận đúng payload từ backend chưa nâng cấp. Không xóa/recreate channel khi đổi ngôn ngữ hoặc mở app; không ghi đè lựa chọn âm thanh của người dùng.
- Âm lượng, chế độ im lặng/DND và cách phát chuông do hệ điều hành/người dùng kiểm soát. Không tăng cưỡng ép âm lượng hoặc xin thêm quyền Critical Alerts. Android giữ cơ chế phát notification hiện có, không thêm một bộ phát nhạc lặp nền dễ đè giọng cuộc gọi.

## Build và triển khai

Các âm thanh mới là tài nguyên native: cần build và cài lại app, không chỉ reload Metro/OTA. Không cần chuyển đổi thủ công CAF sang OGG.

1. Đồng bộ tài nguyên đã lưu trong repo:

   ```sh
   npm run sounds:sync
   npm run test:notification-sounds
   npm run type-check
   npm run test:checkin-native
   ```

2. Build bằng profile đang sử dụng (ví dụ development):

   ```sh
   npx eas-cli build --platform ios --profile development
   npx eas-cli build --platform android --profile development
   ```

3. Cài bản mới lên thiết bị thật, mở app ít nhất một lần và cấp quyền thông báo để Android tạo channel mới. Kiểm tra chuông gọi và notification cả lúc app đang mở, ở nền và thiết bị khóa.
4. Chỉ triển khai mapping backend mới sau khi có bản app chứa tài nguyên/channel mới; FE và BE phải phát hành theo cùng contract. Không đẩy riêng JavaScript mới lên binary chưa có bộ âm thanh này. Thiết bị còn binary cũ không có CAF/channel mới và có thể nghe âm mặc định thay vì bộ này.
5. Test incoming thường, URGENT, FALLBACK sau không trả lời, lời mời vòng kết nối, thông báo chuyên gia và thanh toán. Kiểm tra lời nhắc Tuấn Anh không bị thay đổi và sau khi trả lời thì chuông không đè lời nhắc.

Trong tác vụ thay nhạc chỉ sửa và kiểm tra code/tài nguyên local; chưa tự deploy VPS, phát hành app hoặc gọi đến tài khoản thật.

## Nhập lại bộ nhạc

Không chạy script cũ để tổng hợp các tone điện tử. `generate-sounds.js` hiện chỉ là alias đồng bộ tài nguyên đã nhập.

```sh
npm run sounds:sync -- --import '/Users/ducytcg123456/Downloads/Asinu_NhacChuong_AmAp'
```

Lệnh import kiểm tra đủ 10 file trước khi copy vào đúng thư mục tài nguyên; lệnh sync không phụ thuộc Downloads khi build/CI.

## Nguồn kỹ thuật

- [Apple – UNNotificationSound](https://developer.apple.com/documentation/usernotifications/unnotificationsound): CAF PCM và giới hạn âm thanh thông báo dưới 30 giây.
- [Expo – Sending notifications](https://docs.expo.dev/push-notifications/sending-notifications/): trường remote sound dùng cho iOS, Android theo channel.
- [Android – Notification channels](https://developer.android.com/develop/ui/compose/notifications/channels): sound của channel đã tạo không thể đổi trực tiếp bằng code.
