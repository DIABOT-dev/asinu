# Local StoreKit Testing trên Xcode

File `Asinu.storekit` đi kèm cho phép test full luồng mua / restore / hủy
trên **iOS Simulator** mà không cần Apple Developer account, không cần
Sandbox Tester, không cần internet đến App Store.

## Bật trong Xcode

1. Mở `ios/Asinu.xcworkspace`.
2. Chọn scheme **Asinu** → **Edit Scheme** (`Cmd+Shift+,`).
3. Sidebar trái → **Run** → tab **Options**.
4. **StoreKit Configuration** → chọn `Asinu.storekit` (file đã có sẵn).
5. Đóng modal → chạy app trên Simulator.

## Test gì được

Trong Xcode khi app đang chạy, menu **Debug → StoreKit**:

- **Manage Transactions** — list, refund, expire transaction đang test.
- **Test Renewal Rate** — đẩy nhanh: 1 month thành 5 giây để test renewal/expire.
- **Simulate Failure** — bật các lỗi StoreKit để test error path (mạng kém, key invalid, decline...).
- **Reset** — xóa sạch transaction để test luồng first-purchase lại.

## Lưu ý

- File này CHỈ dùng cho local test. Khi build TestFlight / App Store
  Connect, Xcode tự ngó vào product thật trên App Store Connect, không
  đọc `.storekit` nữa.
- Backend `/api/iap/verify` sẽ TRẢ LỖI khi nhận signed transaction từ
  StoreKit local (vì chữ ký do Xcode tự ký, không phải Apple). Hai cách
  xử lý khi test simulator:
  1. **Test FE only** — log xem `purchaseUpdatedListener` có nhận event không,
     không quan tâm backend.
  2. **Bypass verify** — tạm thời comment đoạn `verifyAppleReceipt` trong
     `iap.service.js` để dev local nhanh. NHỚ revert trước khi commit.

## Khi sửa giá / thêm product

Mở `Asinu.storekit` trực tiếp trong Xcode (UI editor), không sửa JSON
tay — Xcode tự rewrite file. Đảm bảo:

- `productID` khớp `EXPO_PUBLIC_IAP_PRODUCT_MONTHLY` / `_YEARLY`.
- `subscriptionGroupID` giống nhau cho cả 2 products (1 group = 1 "ladder").
- `displayPrice` là VND không có dấu chấm phẩy (vd `199000` không phải `199.000`).

Khi đã tạo product thật trên App Store Connect, **không cần** xóa file
này — nó vẫn hữu ích cho local dev mỗi khi sửa flow IAP.
