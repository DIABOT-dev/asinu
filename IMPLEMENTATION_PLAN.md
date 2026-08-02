# Asinu - Implementation Plan

## 1. Mục tiêu

Hoàn thiện chiều sâu của các module hiện tại để Asinu trở thành ứng dụng theo dõi và chăm sóc sức khỏe gia đình có thể sử dụng hằng ngày.

Trọng tâm là hoàn thiện luồng người dùng, trạng thái giao diện và khả năng quản lý dữ liệu. Không mở thêm module mới khi các module hiện tại chưa đạt tiêu chí hoàn thành.

## 2. Phạm vi

### Trong phạm vi

- Trang chủ và tổng quan sức khỏe.
- Ghi nhận chỉ số sức khỏe.
- Care Circle và chia sẻ với người thân.
- Hồ sơ cá nhân và cài đặt.
- Nhắc nhở và hộp thông báo.
- Báo cáo sức khỏe.
- Missions và Tree.
- Health Feed.
- Subscription, IAP và Wallet.
- Onboarding, legal, accessibility, iPad và offline states.

### Ngoài phạm vi giai đoạn này

- AI Chat và các tính năng AI.
- Check-in và triage.
- Mở thêm hình thức đăng nhập social.
- Thay đổi lớn về nhận diện thương hiệu.

## 3. Nguyên tắc triển khai

- Mỗi module phải có loading, skeleton, empty, error, retry và success state.
- Mọi dữ liệu có nguồn, thời điểm cập nhật và trạng thái đồng bộ rõ ràng.
- Người dùng luôn có thể quay lại thao tác trước đó hoặc sửa dữ liệu đã nhập.
- Không chặn luồng chính chỉ vì notification, quyền tùy chọn hoặc một API phụ bị lỗi.
- Tương thích tiếng Việt và tiếng Anh trên toàn bộ màn hình.
- Ưu tiên iPhone và iPad, không để layout vỡ khi nội dung dài.
- Không hiển thị số liệu sức khỏe mà không giải thích đơn vị hoặc thời điểm đo.

## 4. Giai đoạn 0 - Nền tảng giao diện và dữ liệu

### Frontend

- Tạo bộ skeleton dùng chung cho màn hình danh sách, card, biểu đồ, profile và dashboard.
- Chuẩn hóa các trạng thái `loading`, `refreshing`, `empty`, `error`, `offline`.
- Chuẩn hóa toast, inline error, retry và confirmation dialog.
- Thêm pull-to-refresh cho các màn có dữ liệu từ server.
- Kiểm tra responsive trên iPhone nhỏ, iPhone lớn và iPad.
- Kiểm tra toàn bộ chuỗi dịch Việt/Anh, không để fallback key hiển thị ra giao diện.

### Backend

- Chuẩn hóa response lỗi: `ok`, `error`, `code`, `details`.
- Đảm bảo các API list có pagination hoặc giới hạn rõ ràng.
- Thống nhất format thời gian ISO và timezone Việt Nam.
- Xác định trường nào được phép null và trường nào bắt buộc trong từng API.

### Tiêu chí hoàn thành

- Không còn màn hình trắng khi đang tải dữ liệu.
- API phụ lỗi không làm mất toàn bộ màn hình.
- Các màn chính có cùng cách hiển thị loading, lỗi và retry.

## 5. Giai đoạn 1 - Logs và Trang chủ

### Logs

- Tạo timeline chung tại `/logs` cho tất cả loại bản ghi.
- Lọc theo ngày, khoảng thời gian và loại chỉ số.
- Xem chi tiết, sửa và xóa bản ghi.
- Giữ các màn nhập riêng cho glucose, huyết áp, cân nặng, nước, bữa ăn, thuốc và insulin.
- Hiển thị đúng đơn vị và context của từng loại chỉ số.
- Thêm biểu đồ xu hướng 7 ngày và 30 ngày.
- Cho xuất dữ liệu logs dạng CSV hoặc JSON.
- Thêm xử lý bản ghi tạo thành công nhưng request trả về chậm hoặc bị lặp.

### Trang chủ

- Hiển thị các chỉ số mới nhất và thời điểm cập nhật.
- Hiển thị tiến độ ghi nhận trong ngày.
- Có nút thêm nhanh cho từng loại chỉ số.
- Hiển thị xu hướng ngắn gọn so với ngày trước.
- Có cảnh báo dữ liệu cũ hoặc chưa đủ dữ liệu.
- Hiển thị hoạt động gần đây và liên kết về chi tiết log.
- Cho refresh thủ công và tự phục hồi khi mất mạng.

### API liên quan

- `/api/mobile/logs`
- `/api/mobile/logs/recent`
- `/api/mobile/logs/today`
- `/api/mobile/profile/basic`
- `/api/mobile/tree`
- `/api/mobile/missions`

### Tiêu chí hoàn thành

- Người dùng có thể ghi, xem, sửa, xóa và lọc dữ liệu mà không rời khỏi luồng chính.
- Trang chủ luôn trả lời được ba câu hỏi: hôm nay đã ghi gì, chỉ số mới nhất là gì, tiếp theo nên làm gì.

## 6. Giai đoạn 2 - Care Circle và Hồ sơ cá nhân

### Care Circle

- Hiển thị riêng lời mời đã gửi, lời mời nhận được và kết nối hiện tại.
- Cho gửi lại, hủy, chấp nhận, từ chối và xóa kết nối.
- Giải thích quyền `view logs`, `receive alerts`, `ack escalation` trước khi xác nhận.
- Cho chỉnh quyền sau khi kết nối.
- Hoàn thiện màn caregiver: thông tin thành viên, chỉ số gần nhất, lịch sử và cảnh báo.
- Hiển thị trạng thái người nhận đã xem hoặc đã xử lý cảnh báo.
- Có empty state khi chưa kết nối người thân.

### Hồ sơ cá nhân

- Chia thông tin thành cá nhân, chỉ số cơ bản, bệnh nền, mục tiêu và quyền riêng tư.
- Cho sửa đầy đủ các trường đang có trong model backend.
- Hiển thị ngày cập nhật cuối cho dữ liệu sức khỏe.
- Thêm người liên hệ khẩn cấp.
- Cho xuất dữ liệu và xóa tài khoản từ phần cài đặt.
- Hiển thị trạng thái subscription và quyền Premium hiện tại.

### API liên quan

- `/api/care-circle/invitations`
- `/api/care-circle/connections`
- `/api/mobile/care-circle/member/:memberId/health-summary`
- `/api/mobile/caregiver/logs/:patientId`
- `/api/mobile/caregiver/checkins/:patientId`
- `/api/mobile/profile`
- `/api/mobile/profile/avatar`

### Tiêu chí hoàn thành

- Người dùng hiểu chính xác dữ liệu nào đang được chia sẻ với ai.
- Mọi thay đổi quyền đều có xác nhận và phản hồi thành công/thất bại rõ ràng.
- Không có kết nối hoặc lời mời vẫn có giao diện hướng dẫn tiếp theo.

## 7. Giai đoạn 3 - Nhắc nhở và Thông báo

### Nhắc nhở

- Cho bật/tắt riêng từng nhóm: thuốc, glucose, huyết áp, nước và tổng kết ngày.
- Cho chọn giờ, ngày lặp và timezone.
- Cho tạm hoãn hoặc đánh dấu đã hoàn thành.
- Hiển thị lịch nhắc hiện tại trong màn reminder config.
- Không yêu cầu notification permission khi app khởi động.
- Nếu người dùng từ chối quyền, vẫn dùng app bình thường và hiển thị nút mở Settings khi cần.

### Hộp thông báo

- Phân loại cảnh báo sức khỏe, lời mời Care Circle, subscription và reminder.
- Đánh dấu từng thông báo hoặc tất cả là đã đọc.
- Xóa từng thông báo hoặc toàn bộ.
- Deep link đúng màn đích.
- Hiển thị badge chưa đọc và trạng thái empty.

### API liên quan

- `/api/notifications`
- `/api/notifications/preferences`
- `/api/notifications/engagement/preview`
- `/api/mobile/profile/push-token`

### Tiêu chí hoàn thành

- Notification permission là tùy chọn.
- Mỗi notification mở đúng màn hình và đúng context.
- Reminder có thể chỉnh sửa mà không cần cài lại app.

## 8. Giai đoạn 4 - Báo cáo và Health Feed

### Báo cáo

- Báo cáo theo tuần và tháng.
- Tổng số ngày có dữ liệu và tỷ lệ hoàn thành.
- Biểu đồ xu hướng glucose, huyết áp, cân nặng và nước.
- Danh sách ngày thiếu dữ liệu.
- Các mốc bất thường lấy trực tiếp từ dữ liệu đã ghi.
- So sánh kỳ hiện tại với kỳ trước.
- Xuất PDF hoặc CSV.
- Ghi chú cá nhân để mang theo khi đi khám.

### Health Feed

- Phân loại nội dung theo chủ đề.
- Đánh dấu đã đọc và lưu bài viết.
- Màn danh sách bài đã lưu.
- Hiển thị nguồn và thời điểm cập nhật.
- Có loading, empty, retry và nội dung liên quan đến chỉ số người dùng đang theo dõi.

### Tiêu chí hoàn thành

- Người dùng có thể mở báo cáo và hiểu dữ liệu mà không cần giải thích bên ngoài app.
- Feed không có nội dung thì vẫn có hướng dẫn hoặc empty state rõ ràng.

## 9. Giai đoạn 5 - Missions và Tree

### Missions

- Chia nhiệm vụ thành hôm nay, đang thực hiện và đã hoàn thành.
- Mỗi nhiệm vụ phải liên kết với một hành động thật trong app.
- Có tiến độ, thời hạn và lịch sử.
- Cho hoàn thành trực tiếp hoặc mở màn logs tương ứng.
- Có streak và thành tích nhưng không tạo áp lực hoặc thông báo quá nhiều.

### Tree

- Giải thích điểm cây được tính từ logs và missions như thế nào.
- Hiển thị lịch sử phát triển theo tuần.
- Hiển thị milestone đã đạt.
- Liên kết mỗi thay đổi của cây với hành động người dùng vừa hoàn thành.

### Tiêu chí hoàn thành

- Người dùng biết hôm nay nên làm nhiệm vụ nào và vì sao.
- Tree phản ánh dữ liệu và hành động thật, không chỉ là hình ảnh trang trí.

## 10. Giai đoạn 6 - Subscription và Wallet

- Bảng so sánh Free/Premium.
- Hiển thị gói đang dùng, ngày bắt đầu và ngày hết hạn.
- Hoàn thiện purchase, restore purchase và trạng thái pending.
- Xử lý payment success, failure, retry và timeout.
- Lịch sử giao dịch và subscription.
- Đồng bộ trạng thái IAP sau khi app mở lại.
- Hiển thị rõ số dư Wallet và lịch sử nạp/trừ.
- Kiểm tra trường hợp thanh toán thành công nhưng webhook về chậm.
- Luồng tặng Premium phải xác nhận đúng người nhận và quyền kết nối.

### Tiêu chí hoàn thành

- Người dùng luôn biết mình đã thanh toán chưa và quyền Premium đã được kích hoạt chưa.
- Không hiển thị sai trạng thái giữa App Store, backend và giao diện.

## 11. Giai đoạn 7 - Onboarding, Legal và chất lượng phát hành

- Onboarding có thanh tiến độ và cho bỏ qua từng bước.
- Hiển thị đối tượng sử dụng: bản thân, bố mẹ hoặc người thân.
- Cho chọn chỉ số muốn theo dõi và đơn vị đo.
- Hoàn thiện bản dịch Việt/Anh cho màn login, profile, legal và subscription.
- Kiểm tra accessibility label, font lớn và contrast.
- Kiểm tra iPad landscape và portrait.
- Kiểm tra offline, mạng chậm, API timeout và app mở lại sau background.
- Kiểm tra tài khoản mới, tài khoản không có Care Circle, tài khoản không có logs và tài khoản Free.

## 12. Definition of Done

Một module chỉ được xem là hoàn thành khi:

- Có loading/skeleton ổn định.
- Có empty state có hướng dẫn hành động tiếp theo.
- Có error state và retry.
- Có xử lý offline hoặc mạng chậm.
- Có bản dịch Việt và Anh.
- Không vỡ layout trên iPhone và iPad.
- Có phân quyền đúng.
- Có analytics/log lỗi cho thao tác quan trọng.
- Có API response và validation thống nhất.
- Đã kiểm tra luồng thành công, thất bại, hủy thao tác và dữ liệu rỗng.

## 13. Thứ tự triển khai đề xuất

1. Giai đoạn 0: nền tảng trạng thái UI, skeleton và responsive.
2. Giai đoạn 1: Logs và Trang chủ.
3. Giai đoạn 2: Care Circle và Hồ sơ.
4. Giai đoạn 3: Reminder và Notification.
5. Giai đoạn 4: Báo cáo và Health Feed.
6. Giai đoạn 5: Missions và Tree.
7. Giai đoạn 6: Subscription và Wallet.
8. Giai đoạn 7: QA, accessibility, iPad và release.

Không đưa AI hoặc Check-in vào các mốc trên để tránh làm loãng mục tiêu hoàn thiện các module hiện tại.
