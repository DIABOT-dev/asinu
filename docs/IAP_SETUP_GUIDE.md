# IAP Asinu V2

Mobile dùng `expo-iap` và lấy danh mục từ backend. Chỉ sáu Store SKU sau được hỗ trợ:

| Gói | Tháng | Năm |
|---|---|---|
| An Tâm 2 | `asinu.antam2.monthly` | `asinu.antam2.yearly` |
| An Tâm 4 | `asinu.antam4.monthly` | `asinu.antam4.yearly` |
| An Tâm 8 | `asinu.antam8.monthly` | `asinu.antam8.yearly` |

Không dùng `An Tâm 1` hoặc `asinu.premium.*`.

## Test iOS Sandbox

```bash
cd /Users/ducytcg123456/Desktop/APP/app/asinu
npx eas-cli@24.8.0 build --platform ios --profile development
npx expo start --dev-client
```

- Cài development build lên iPhone thật và bật Developer Mode.
- Đăng nhập Sandbox Apple Account trong Settings, Developer.
- Backend phải là local/staging dùng Apple sandbox, không trỏ database production.
- Expo Go không có native IAP module.

## Test Android

- Upload AAB package `com.asinu.lite` lên Internal testing.
- Thêm cùng email vào Internal testers và License testing.
- Cài app từ Play Store opt-in link.
- Sáu subscription và base plan phải được activate trước khi test.

## Xác nhận sau khi mua

- App log có `[iap] init success`, `fetch products success`, `purchase updated`, `verify success`.
- `GET /api/subscriptions/status` trả đúng gói/thời hạn.
- `GET /api/subscription-household` trả giới hạn 2, 4 hoặc 8.
- Restore không cấp trùng lượt dr.asinu.
- Nâng gói Android tính chênh lệch ngay; hạ gói có hiệu lực ở kỳ kế tiếp.
