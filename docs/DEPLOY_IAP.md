# Asinu Mobile App — Pull bản có IAP và build

Repo: `https://github.com/DIABOT-dev/asinu`

App đã thêm Apple IAP + Google Play Billing qua `expo-iap`. Doc này chỉ
nói về phần **pull + rebuild client**. Setup product trên App Store
Connect / Play Console: xem `IAP_SETUP_GUIDE.md`.

---

## 1. Pull code

```bash
cd /path/to/asinu
git fetch origin
git checkout main
git pull --ff-only origin main
```

## 2. Cài deps mới

```bash
npm install
# postinstall sẽ chạy patch-package tự động
```

Bản này thêm 1 dep: `expo-iap` (StoreKit 2 + Play Billing v6 cho Expo).

## 3. Cập nhật `.env`

Mở `.env` (hoặc copy từ `.env.example`). Đảm bảo 3 biến này có giá trị:

```env
EXPO_PUBLIC_PAYMENT_METHOD=iap
EXPO_PUBLIC_IAP_PRODUCT_MONTHLY=asinu.premium.monthly
EXPO_PUBLIC_IAP_PRODUCT_YEARLY=asinu.premium.yearly
```

> Trong khi chờ App Store / Play Console duyệt product, giữ
> `EXPO_PUBLIC_PAYMENT_METHOD=hidden` để app hiển thị placeholder "sắp
> ra mắt" thay vì gọi StoreKit fail.

## 4. Prebuild + build native

Bản này thay đổi `app.json` (thêm plugin `expo-iap`, iOS deploymentTarget
15.0, Android BILLING permission). PHẢI prebuild lại để áp dụng vào
`ios/` + `android/`.

```bash
npx expo prebuild --clean
```

> `--clean` quan trọng: xoá `ios/` + `android/` cũ rồi gen lại. Nếu bạn có
> custom native code trong 2 thư mục đó, backup trước.

## 5. Build dev client (test local)

### iOS Simulator (cần macOS)

```bash
npx expo run:ios
```

Mặc định build configuration `Debug`. Để test với StoreKit local
configuration trên Simulator, xem [`../ios/STOREKIT_TESTING.md`](../ios/STOREKIT_TESTING.md).

### Android Emulator / thiết bị

```bash
npx expo run:android
```

## 6. Build production qua EAS

```bash
# Cài EAS CLI nếu chưa có
npm install -g eas-cli
eas login

# Build cả 2 platform
eas build --platform all --profile production
```

`eas.json` đã có profile sẵn. EAS build mất 15-30 phút mỗi platform.

## 7. Submit lên store

### iOS — App Store Connect

```bash
eas submit --platform ios --latest
```

Hoặc upload thủ công file `.ipa` từ EAS build vào App Store Connect →
chọn TestFlight build → Submit for Review.

**Trước khi submit:**
- ✅ 2 subscription products đã ở trạng thái `Ready to Submit`
- ✅ App Store Server Notifications V2 URL đã paste:
  `https://asinu.top/api/iap/apple-notifications`
- ✅ Kèm Sandbox Tester credentials trong note review

### Android — Google Play Console

```bash
eas submit --platform android --latest
```

Hoặc upload `.aab` thủ công vào Play Console → Internal Testing →
Promote to Production.

**Trước khi submit:**
- ✅ 2 subscription products có base plan `Active`
- ✅ RTDN topic Pub/Sub đã trỏ về `https://asinu.top/api/iap/google-notifications`
- ✅ Service Account đã grant `View financial data` + `Manage orders`

## 8. Smoke test sau khi build

Mở app trên thiết bị:

1. **Free user** → mở `/subscription` → hiện card chọn gói + nút "Nâng cấp ngay" + "Khôi phục mua hàng".
2. Bấm "Nâng cấp ngay" → Apple/Google sheet hiện → confirm (sandbox).
3. Backend log `iap.apple_verify` hoặc `iap.google_verify` → user thành premium.
4. **Premium user** → reload `/subscription` → vẫn thấy nút "Khôi phục mua hàng" dưới badge expiry (Apple Guideline 3.1.1).

## 9. Rollback / tắt IAP nhanh

Khi cần ẩn flow IAP (vd phát hiện bug critical, store yêu cầu sửa gấp):

```env
EXPO_PUBLIC_PAYMENT_METHOD=hidden
```

Rebuild + submit lại. Trong khi chờ, UI cũ "Đang tích hợp Apple Pay /
Google Pay" sẽ hiện ra thay cho card mua.

## 10. Local StoreKit test (iOS Simulator)

File `ios/Asinu.storekit` cho phép test full luồng mua/restore/refund
trên Simulator mà không cần Apple Developer / Sandbox Tester. Chi tiết:
[`../ios/STOREKIT_TESTING.md`](../ios/STOREKIT_TESTING.md).

---

## Tham khảo

- [`IAP_SETUP_GUIDE.md`](./IAP_SETUP_GUIDE.md) — full setup App Store / Play Console
- [`IAP_ENV_VARS.md`](./IAP_ENV_VARS.md) — bảng env vars chi tiết
- Repo backend: `https://github.com/DIABOT-dev/backend.asinu` — pull cùng lúc để app + backend đồng bộ
