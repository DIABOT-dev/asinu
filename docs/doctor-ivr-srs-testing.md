# Kiểm tra Doctor IVR trong development

Ngày 27/10/2026. Giữ Doctor ẩn trong staging/production.

## Xem giao diện

Trong menu development của app mở **Tổng đài bác sĩ**: lời mời, câu hỏi, ghi âm 30/60 giây, chờ, kết quả và lỗi mạng. Gallery dùng view thật với nền/theme/check-in hiện tại, dữ liệu trong bộ nhớ. Không tạo ca, thu micro, gửi API hay bỏ qua xác thực phiên thật.

Ảnh native: `.expo/doctor-ivr-srs-native/native-question-ios.png`. Ảnh Doctor admin là Next với API fixture, không phải ảnh app.

## Thử phiên thật

1. Chạy Asinu backend và Doctor backend/frontend với cấu hình cầu nối local, bật cờ IVR. Asinu backend cần migration 120–122 (đã áp dụng local).
2. Đăng nhập bệnh nhân và bác sĩ phụ trách cùng ca local. Trong Doctor mở ca → Tổng đài → tạo, sửa và duyệt câu hỏi.
3. Gửi vào app trước. Bệnh nhân trả lời ngay hoặc nhắc sau. Chọn khi đang nghe, nghe xác nhận xong mới sang câu tiếp; thử ra nền/mở lại và quay lại sửa đáp án.
4. Chọn Khác: đồng ý ghi âm, thử bản rỗng và bản có giọng, ngắt mạng khi gửi; kiểm file gốc/STT và trạng thái chờ gửi. Câu cuối tối đa 60 giây.
5. Bác sĩ xem báo cáo, nghe file gốc, sửa/gửi kết quả; bệnh nhân đọc/nghe rồi Đã hiểu. Chỉ ca tương ứng đóng.

Kênh gọi cần **build development native mới**, có `getCapabilities().doctorIvr`. IPA trước thay đổi này không có phương thức mới qua Metro/OTA. Cài bản mới, đăng nhập để đăng ký năng lực thiết bị, bật `DOCTOR_IVR_CALL_ENABLED=true` ở **backend local**. Cần APNs/FCM hoạt động và các quyền thiết bị phù hợp.

Cuộc gọi hiện là incoming CallKit/Telecom rồi chuyển vào màn nghe/chọn sau xác thực và nhả audio. Không gọi SIM/PSTN, không nhận DTMF từ bàn phím hệ điều hành.

## Kiểm tra tự động

- `npx tsc --noEmit`
- `npm run test:doctor-ivr`: file chờ gửi, đọc xác nhận, màn câu hỏi và QR-10.
- `npm run test:doctor-hidden`: quét toàn src và ma trận local/dev/staging/production.
- `npm run test:checkin-native`: hồi quy handoff iOS/Android.
- `npm run test:checkin-android`: JVM/Robolectric, không thay cho FCM trên máy thật.

Artifact Simulator/XCUITest nằm ở `.expo/doctor-ivr-srs-native/`. Gallery không chứng minh micro, nhận cuộc gọi khi khóa màn hình, Bluetooth, giọng vùng miền hay SLA production. Biên bản SRS và giới hạn chi tiết ở repo `backend.asinu/docs/doctor-ivr-srs-20261027.md`.


## Ứng viên phát hành 28/10/2026

Đợt phát hành được kiểm tra trên nhánh riêng trước khi cập nhật production. Migration 122 ràng buộc khả năng nhận cuộc gọi vào đúng push token của từng nền tảng; một bản Android mới không bật cuộc gọi cho iOS cũ cùng tài khoản. Đăng ký khả năng native chỉ chạy sau khi lưu token thành công.

Profile EAS `development-vps` kết nối https://asinu.top, vẫn dùng môi trường development. App Store/Google Play hiện tại tiếp tục giữ ẩn Doctor. Việc commit mã native không tự cập nhật ứng dụng đã cài.

Kiểm tra ứng viên ngày 28/10: luồng HTTP/UI với Dr7, TTS và STT thật đã hoàn tất trên dữ liệu cô lập, gồm mất mạng, từ chối micro, upload lại, đọc xác nhận, red flag, kết quả và đóng đúng ca. Hai ca sinh câu hỏi riêng (đau đầu, ho) cũng qua kiểm định. Bundle iOS/Android production export thành công; chưa thay thế nghiệm thu cuộc gọi trên điện thoại thật.
