# Payment Test Flow

Tài liệu này gồm 2 phần:

- Test nhanh để kiểm tra UI/logic premium.
- Test thật với App Store / Google Play Billing.

Product ID đang dùng trong app:

```text
asinu.premium.monthly
asinu.premium.yearly
```

Bundle/package ID đang dùng:

```text
com.asinu.lite
```

## 1. Vì sao Android không test đơn giản như iOS StoreKit?

iOS có file `.storekit` để Xcode giả lập subscription trên Simulator. File này tạo product giả, transaction giả, renewal giả ngay trong Xcode. Vì vậy iOS có thể test local mà không cần đưa app lên App Store Connect.

Android Google Play Billing không có cơ chế local tương đương `.storekit`. Billing API của Android phụ thuộc vào các dịch vụ thật trên máy:

- Google Play Store.
- Google Play Services.
- Google Play Billing service.
- Tài khoản Google đang đăng nhập.
- App package đã được Google Play nhận diện.
- Subscription/base plan đã tồn tại trên Google Play Console.

Nếu thiếu một trong các điều kiện trên, app có thể build và chạy bình thường, nhưng Billing sẽ không init được. Lỗi thường gặp:

```text
Billing setup finished with error: Billing service unavailable on device.
```

Ý nghĩa: thiết bị/emulator hiện tại không có Billing service hợp lệ để `expo-iap` kết nối. Đây không phải lỗi UI, không phải lỗi nút mua, và thường không phải lỗi SKU.

Lý do Google làm như vậy:

- Giao dịch mua hàng Android phải đi qua Google Play Store để chống gian lận.
- Product/subscription phải thuộc đúng package app trên Play Console.
- Tài khoản tester phải được Google cho phép mua test.
- Receipt/purchase token thật chỉ sinh ra từ Google Play Billing service.

Vì vậy muốn test payment Android thật thì cách chuẩn là upload app lên một testing track của Google Play, thường là Internal Testing, rồi cài app từ Play Store.

## 2. Các mức test nên dùng

### 2.1 Mock/local app test

Dùng khi cần test nhanh:

- UI chọn gói.
- Trạng thái premium.
- Mở khóa tính năng.
- Backend update user.
- Xử lý nút "Nâng cấp ngay" về mặt app.

Không test được:

- Google Play purchase dialog.
- App Store purchase dialog thật.
- Receipt/purchase token thật.
- Renewal/cancel/refund thật.

### 2.2 iOS StoreKit local

Dùng khi cần test StoreKit trên iOS Simulator mà không cần submit app.

File đã có:

```text
ios/Asinu.storekit
```

Hướng dẫn chi tiết:

```text
ios/STOREKIT_TESTING.md
```

Lưu ý: StoreKit local có thể tạo transaction giả, nhưng backend verify Apple thật có thể trả:

```text
APPLE_VERIFY_FAILED
```

Đây là bình thường, vì transaction local do Xcode ký, không phải Apple production/sandbox server ký.

### 2.3 iOS test thật bằng Sandbox/TestFlight

Dùng khi cần test gần như thật:

- App Store purchase sheet.
- Sandbox transaction.
- Receipt/JWS verify với backend.
- Restore purchase.

Cần:

- App Store Connect có subscription product.
- Product ID đúng.
- Sandbox tester.
- Backend `APPLE_IAP_ENV=sandbox`.

### 2.4 Android test thật bằng Google Play Internal Testing

Dùng khi cần test Google Play Billing thật:

- Google Play purchase dialog.
- Purchase token thật.
- Backend verify Google.
- Subscription/base plan thật.
- Restore/check entitlement thật.

Cần upload AAB lên Internal Testing và cài app từ Google Play.

## 3. Android: test Google Play Billing thật

### Bước 1: Kiểm tra package

Trong app và Google Play Console phải cùng là:

```text
com.asinu.lite
```

Kiểm tra trong `app.json`:

```json
{
  "expo": {
    "android": {
      "package": "com.asinu.lite"
    }
  }
}
```

Nếu Play Console app có package khác, Billing sẽ không nhận product của app này.

### Bước 2: Kiểm tra env client

Trong `.env`:

```env
EXPO_PUBLIC_PAYMENT_METHOD=iap
EXPO_PUBLIC_IAP_PRODUCT_MONTHLY=asinu.premium.monthly
EXPO_PUBLIC_IAP_PRODUCT_YEARLY=asinu.premium.yearly
```

Sau khi đổi env cần rebuild app.

### Bước 3: Build Android AAB

Chạy trong thư mục app:

```bash
cd /Users/ducytcg123456/Desktop/APP/asinu
eas build --platform android --profile production --clear-cache
```

Build dùng để upload Play Console nên là `.aab`, không phải APK cài trực tiếp.

### Bước 4: Upload lên Internal Testing

Google Play Console:

```text
App Asinu > Testing > Internal testing
```

Thao tác:

1. Bấm `Create new release`.
2. Upload file `.aab`.
3. Điền release notes, ví dụ `Internal billing test`.
4. Bấm `Review release`.
5. Bấm `Start rollout to Internal testing`.

Chờ Google Play xử lý release. Có thể mất vài phút đến vài giờ.

### Bước 5: Thêm tester vào Internal Testing

Trong:

```text
Testing > Internal testing > Testers
```

Thêm Gmail dùng để test.

Gmail này phải là Gmail đang đăng nhập trong Google Play Store trên thiết bị/emulator test.

### Bước 6: Thêm License Tester

Trong Google Play Console cấp account:

```text
Setup > License testing
```

Thêm cùng Gmail tester.

Chọn:

```text
RESPOND_NORMALLY
```

Mục đích: giao dịch test không trừ tiền thật.

### Bước 7: Tạo và active subscriptions

Trong app trên Play Console:

```text
Monetize > Products > Subscriptions
```

Cần có đúng 2 subscription:

```text
asinu.premium.monthly
asinu.premium.yearly
```

Mỗi subscription cần có:

- Base plan.
- Billing period đúng: monthly/yearly.
- Price.
- Status/base plan là `Active`.

Nếu subscription/base plan chưa active, app có thể query không ra product hoặc không có offer token.

### Bước 8: Cài app từ Play Store

Quay lại:

```text
Testing > Internal testing
```

Lấy link opt-in:

```text
Join on Android
```

Mở link trên đúng thiết bị/emulator test, bằng đúng Gmail tester.

Thao tác:

1. Bấm `Become a tester`.
2. Mở link cài app từ Google Play.
3. Cài app từ Play Store.

Không dùng các cách này để test Billing thật:

```bash
adb install
expo run:android
eas build:run
```

Những cách này có thể chạy app, nhưng không đảm bảo Google Play Billing nhận app như app từ Play Store.

### Bước 9: Test mua

Mở app vừa cài từ Play Store.

Vào màn Premium, chọn gói, bấm:

```text
Nâng cấp ngay
```

Nếu setup đúng, Google Play purchase dialog sẽ hiện. Giao dịch test sẽ không trừ tiền thật nếu Gmail đã nằm trong License testing.

## 4. Android checklist khi lỗi

### Lỗi: Billing service unavailable on device

Ý nghĩa:

```text
Thiết bị/emulator không có Google Play Billing service hợp lệ.
```

Kiểm tra:

- Emulator có system image `Google Play`, không chỉ là `Google APIs`.
- Play Store mở được.
- Google Play Services đang hoạt động.
- Đã đăng nhập Gmail tester.
- App được cài từ Play Store Internal Testing.

### Lỗi: SKU not found

Ý nghĩa:

```text
Google Play Billing chạy được, nhưng không tìm thấy product/subscription ID.
```

Kiểm tra:

- Product ID đúng 100%.
- Subscription/base plan đã `Active`.
- App package đúng `com.asinu.lite`.
- Build đã upload vào Play Console.
- Cài app từ Internal Testing.
- Đợi Google Play sync product, có thể mất vài giờ.

### Lỗi: missing offer token

Ý nghĩa:

```text
Subscription có thể tồn tại, nhưng base plan/offer không khả dụng.
```

Kiểm tra:

- Base plan active.
- Base plan có price.
- Product không ở draft/inactive.

## 5. iOS: test StoreKit local

Mở Xcode:

```text
ios/Asinu.xcworkspace
```

Không mở:

```text
ios/Asinu.xcodeproj
```

Trong Xcode:

1. Chọn scheme `Asinu`.
2. `Product > Scheme > Edit Scheme`.
3. `Run > Options`.
4. `StoreKit Configuration` chọn `Asinu.storekit`.
5. Chạy app trên iOS Simulator.

Khi app đang chạy:

```text
Debug > StoreKit > Manage Transactions
```

Dùng để xem, refund, expire, reset transaction local.

## 6. iOS: test thật bằng Sandbox/TestFlight

### Bước 1: Kiểm tra bundle ID

App Store Connect và app phải cùng:

```text
com.asinu.lite
```

### Bước 2: Kiểm tra subscription

App Store Connect:

```text
App Asinu > Monetization > Subscriptions
```

Cần có:

```text
asinu.premium.monthly
asinu.premium.yearly
```

Status tối thiểu nên là:

```text
Ready to Submit
```

Lần đầu subscription cần được submit kèm một app version mới.

### Bước 3: Tạo Sandbox Tester

App Store Connect:

```text
Users and Access > Sandbox > Testers
```

Tạo tester mới. Nên dùng email chưa từng là Apple ID thật.

### Bước 4: Đăng nhập sandbox trên iPhone

Trên iPhone test:

```text
Settings > App Store > Sandbox Account
```

Đăng nhập bằng sandbox tester.

### Bước 5: Build và cài app

Có thể test bằng:

- Xcode/device.
- TestFlight.

Nếu muốn backend verify Apple thật, nên dùng Sandbox/TestFlight thay vì `.storekit` local.

### Bước 6: Backend env

Backend khi test sandbox:

```env
APPLE_BUNDLE_ID=com.asinu.lite
APPLE_IAP_ENV=sandbox
```

Nếu dùng StoreKit local, backend verify Apple thật có thể fail. Nếu dùng Sandbox/TestFlight, backend verify mới đúng ý nghĩa.

## 7. Lệnh xem log IAP trong app

Chạy Metro:

```bash
cd /Users/ducytcg123456/Desktop/APP/asinu
npm run start -- --clear
```

Khi bấm mua, xem các dòng:

```text
[iap] init start
[iap] init success
[iap] init failed
[iap] fetch products success
[iap] purchase requested
[iap] requestPurchase exception
[iap] purchase error event
```

Nếu cần debug, copy toàn bộ các dòng bắt đầu bằng:

```text
[iap]
```

## 8. Kết luận ngắn

iOS có 2 cách:

- Test local bằng `.storekit`: nhanh, không cần submit, nhưng backend verify thật có thể fail.
- Test thật bằng Sandbox/TestFlight: dùng để verify payment thật.

Android có 2 cách:

- Mock app logic: nhanh, không test Google Billing thật.
- Internal Testing: phức tạp hơn, nhưng là cách chuẩn để test Google Play Billing thật.

Nếu gặp:

```text
Billing service unavailable on device
```

thì cần sửa môi trường test Android, không phải sửa UI/card hay nút mua.
