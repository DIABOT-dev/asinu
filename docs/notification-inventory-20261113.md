# Thông báo trong chuông và ngoài app Asinu

Ngày rà soát: **13/11/2026**. Phạm vi: frontend `asinu` và backend `backend.asinu` tại local, nhánh `change/check-in`.

## Phạm vi và cách đếm

Tài liệu chỉ tính:

- **Trong chuông:** bản ghi lưu trong bảng `notifications`, người dùng mở chuông để xem/đọc/xóa.
- **Ngoài app:** push/banner/màn hình khóa/trung tâm thông báo và thông báo cuộc gọi native iOS/Android.

**Không tính toast, hộp thoại, popup xin quyền, hiệu ứng nhận xu, lỗi form hoặc trạng thái loading trong màn hình.**

Đếm theo mã `type`, gộp các tình huống/nội dung khác nhau của cùng mã vào một loại. Trong source tìm thấy **47 mã nghiệp vụ có đường lưu vào chuông**, cùng **2 mã payload cuộc gọi native riêng**, tổng **49 mã có producer** trong phạm vi này. Có loại cần bật cấu hình/gói/quyền hoặc đang tạm dừng mặc định; số này không phải 49 thông báo mỗi ngày và không khẳng định tất cả đang bật trên VPS.

Ngoài danh mục hữu hạn này, API tự tạo thông báo trong chuông cho chính tài khoản nhận `type` động; xem mục cuối. Mẫu thử/route/biểu tượng có tên nhưng không tìm thấy producer tự động được tách riêng, không cộng vào số 49.

| Nhóm | Số mã có producer |
| --- | --- |
| Check-in và cảnh báo sức khỏe | 11 |
| Nhắc thuốc và lịch thuốc | 8 |
| Kết nối người thân | 5 |
| Xu, quà và mốc duy trì thói quen | 8 |
| Tổng kết, bản tin và nhắc sử dụng app | 5 |
| Gói chăm sóc và thanh toán | 5 |
| Chuyên gia và IVR | 4 |
| Nhắc ghi nhật ký đang tạm dừng mặc định | 3 |
| **Tổng** | **49** |

Trong bảng, **Có*** ở cột Ngoài app nghĩa là có đường gửi nhưng còn phụ thuộc quyền OS, token, cấu hình, gói, lịch và policy. Chuông và push thường là hai kênh của **cùng một sự kiện**, không cộng thành hai loại.

## 1. Check-in và cảnh báo sức khỏe

| Type / ý nghĩa | Trong chuông | Ngoài app | Khi nào / ai nhận | Nội dung / khi bấm |
| --- | --- | --- | --- | --- |
| `morning_checkin`<br>**Nhắc check-in buổi sáng** | Có | Có* | Quét 07:00–07:59 VN. Người đã onboarding, bật nhắc, có token và chưa check-in hôm đó; mỗi ngày tối đa một lượt ở nhánh này. | Nhắc hỏi thăm sức khỏe buổi sáng, cá nhân hóa xưng hô.<br>**Bấm:** /checkin |
| `checkin_followup`<br>**Hỏi thăm lại / tiếp tục check-in** | Có | Có* | Phiên đến next_checkin_at, chưa giải quyết; gửi chính người dùng. Có biến thể đang làm dở, sau kết luận và theo dõi người đã báo ổn. | Nội dung theo trạng thái thực của phiên; không hỏi như chưa làm xong nếu đã có kết luận.<br>**Bấm:** /checkin?checkin_id=…&mode=followup |
| `checkin_followup_urgent`<br>**Nhắc phản hồi phiên cần chú ý** | Có | Có* | Các lượt bỏ lỡ tiếp theo của phiên cần theo dõi, ngoài nhánh monitoring/fine thông thường; gửi người check-in. | Nhắc chưa nhận phản hồi hoặc hỏi thăm sau kết luận. Tên urgent không tự chứng minh tình trạng cấp cứu.<br>**Bấm:** Mở đúng phiên check-in |
| `health_alert`<br>**Cảnh báo sức khỏe** | Có | Có* | Các nguồn: kết quả check-in; log đường huyết/huyết áp đáng chú ý; health monitoring; context alert; API người dùng gửi cho người thân. Tùy nguồn gửi chính người dùng và/hoặc người thân đủ quyền. | Chỉ số bất thường, sức khỏe cần được kiểm tra hoặc nội dung sự kiện. Các nguồn cùng type được gộp tại đây.<br>**Bấm:** Glucose → ghi đường huyết; blood_pressure → ghi huyết áp; needsDoctor phù hợp → tư vấn; còn lại → check-in |
| `caregiver_alert`<br>**Thông báo người chăm sóc / gia đình** | Có | Có* | Check-in cần theo dõi hoặc không phản hồi; wellness không phản hồi/bất thường/không khỏe/yêu cầu giúp; kịch bản cũ; nhánh reengagement gia đình. Có một biến thể gửi chính người check-in để báo đã thông tin cho gia đình. | Cần kiểm tra sức khỏe; người thân cần hỗ trợ; hoặc đã báo gia đình. Phân biệt bằng source, templateId, alertType và mã phiên.<br>**Bấm:** Trang chủ, lấy cảnh báo hiện tại |
| `emergency`<br>**Cảnh báo cấp bách / SOS** | Có | Có* | Người dùng kích hoạt SOS hoặc luồng đánh giá phát sinh tình huống cấp bách. Gửi người thân đủ điều kiện nhận cảnh báo. | Cảnh báo cần hỗ trợ, có mã người bệnh/phiên/cảnh báo theo sự kiện.<br>**Bấm:** Trang chủ, lấy cảnh báo hiện tại |
| `caregiver_confirmed`<br>**Người thân đã xác nhận** | Có | Có* | Người thân chọn đã biết / đang đến / đã gọi; gửi ngược cho người check-in. | Có tên người thân và hành động đã xác nhận.<br>**Bấm:** Trang chủ |
| `checkin_inactivity_notice`<br>**Thông tin vắng check-in 7 ngày** | Có | Có* | Người đã có kết nối vắng check-in đủ 7 ngày. Một thông báo cho mỗi người thân đủ quyền trong mỗi đợt vắng mặt. | Thông tin cho gia đình về việc chưa có check-in; các nhắc thường cho đợt vắng này được tạm dừng.<br>**Bấm:** Tab người thân |
| `reengagement`<br>**Nhắc quay lại check-in** | Có | Có* | Job 09:00–09:04 VN. Người từng check-in nhưng vắng: 1–2 ngày nhắc nhẹ, 3–4 ngày quan tâm hơn, 5–7 ngày nhắc theo dõi. Tối đa một lượt cùng loại/ngày. | Biến thể theo số ngày vắng, triệu chứng và bệnh nền còn phù hợp.<br>**Bấm:** Chưa có route riêng, dùng xử lý mặc định |
| `checkin_call`<br>**Cuộc gọi hỏi thăm / hỗ trợ** | Có | Có* | Lịch cuộc gọi được bật và đủ quyền gói; hoặc tín hiệu sớm khẩn. Gửi người dùng/người thân theo trạng thái cuộc gọi. | Một type với các kind INCOMING_CALL, FALLBACK, URGENT_REPEAT; không đếm mỗi kind thành loại riêng.<br>**Bấm:** /checkin-call/[episodeId] |
| `early_signal`<br>**Tín hiệu sớm** | Có | Có* | Có cờ đỏ; hoặc gói automaticEarlySignals và đánh giá xấu đi/tổng hợp tuần. Người nhận là người thân đủ quyền hoặc chủ hộ theo nhánh được phép. | Có tiêu đề sự kiện/tuần, mức monitor/see_doctor/urgent và tóm tắt. Không phải mọi lần mở trang tín hiệu đều gửi.<br>**Bấm:** /early-signal/[userId], thiếu mã về cây sức khỏe |

## 2. Nhắc thuốc và lịch thuốc

| Type / ý nghĩa | Trong chuông | Ngoài app | Khi nào / ai nhận | Nội dung / khi bấm |
| --- | --- | --- | --- | --- |
| `medication_call`<br>**Cuộc gọi nhắc thuốc / xin đồng ý lịch** | Không có bản ghi riêng cùng type | Có*, cuộc gọi native | Cữ đến giờ và lịch đã được đồng ý; hoặc lời mời người thân cài lịch đang pending. Cần config native call và MED_CALL_ENABLED=true. | “Asinu · Nhắc thuốc” hoặc “Asinu · Lịch nhắc thuốc”. Đây là payload gọi native, không tự có dòng hộp thư cùng type.<br>**Bấm:** /medication/call/[doseId] hoặc /medication/consent |
| `med_reminder`<br>**Push nhắc đến giờ uống thuốc** | Có | Có* | Attempt dùng push hoặc không gửi native call được; gửi người uống. | “Đến giờ uống thuốc”. “Đến giờ uống thuốc buổi {buổi}. Mở Asinu để trả lời.”<br>**Bấm:** Mở đúng cữ; có nút Đã uống / Bỏ qua / Hết thuốc |
| `med_consent`<br>**Lời mời xác nhận lịch thuốc** | Có | Có* | Người thân tạo/yêu cầu xác nhận lịch; gửi người uống. | “Người thân vừa cài lịch nhắc thuốc. Mở Asinu để đồng ý hoặc từ chối.”<br>**Bấm:** /medication/consent kèm mã lịch |
| `med_schedule_changed`<br>**Lịch thuốc thay đổi / đã có phản hồi** | Có | Có* | Sự kiện sửa lịch hoặc người nhận đồng ý/từ chối; gửi người liên quan theo outbox. | Ba biến thể: “Người thân đã đồng ý nhận nhắc thuốc.”; “Người thân chưa muốn nhận cuộc gọi nhắc thuốc.”; “Lịch nhắc thuốc vừa được thay đổi. Mở Asinu để xem lại.”<br>**Bấm:** /medication |
| `med_consent_pending`<br>**Lịch thuốc chưa được xác nhận** | Có | Có* | Lịch pending sau 48 giờ, chưa nhắc người tạo và kết nối còn hiệu lực; gửi người tạo lịch. | “Người thân chưa xác nhận lịch nhắc thuốc. Lịch vẫn chưa chạy.”<br>**Bấm:** /medication |
| `med_result`<br>**Kết quả một cữ thuốc** | Có | Có* | Cữ chuyển trạng thái, gửi người thân còn kết nối và được phép nhận kết quả. | TAKEN: đã uống; SKIPPED: bỏ qua; OUT_OF_MEDS: hết thuốc, có số lần lặp trong 7 ngày; UNCONFIRMED: chưa xác nhận; SKIPPED_NO_DEVICE: không liên lạc được thiết bị.<br>**Bấm:** /medication |
| `med_checkin_followup`<br>**Mời kể thêm sức khỏe sau cuộc gọi thuốc** | Có | Có* | Người uống phản hồi sức khỏe không phải fine và cần kể thêm. | “Bác mở app kể thêm cho cháu nhé.”<br>**Bấm:** Payload dự định mở check-in; router FE hiện ưu tiên med_* về /medication |
| `weekly_v21`<br>**Báo cáo thuốc và xu tuần** | Có | Có* | Thứ Hai 08:00, gửi người thân được phép. | “Tuần qua người thân đã xác nhận {taken}/{total} cữ thuốc và nhận được {coins} xu.” Có thể thêm số cữ đã bỏ qua.<br>**Bấm:** Payload trỏ nhắc thuốc; FE chưa có nhánh route riêng cho type này |

## 3. Kết nối người thân

| Type / ý nghĩa | Trong chuông | Ngoài app | Khi nào / ai nhận | Nội dung / khi bấm |
| --- | --- | --- | --- | --- |
| `care_circle_invitation`<br>**Có lời mời kết nối** | Có | Có* | Gửi người được mời khi tạo lời mời. | Có tên người mời; vẫn lưu trong chuông dù chưa có push token.<br>**Bấm:** /care-circle |
| `care_circle_accepted`<br>**Lời mời đã được chấp nhận** | Có | Có* | Gửi người đã mời khi bên kia chấp nhận. | Thông tin đã kết nối, có tên người chấp nhận.<br>**Bấm:** /care-circle |
| `care_circle_rejected`<br>**Lời mời bị từ chối** | Có | Có* | Gửi người đã mời khi bên kia từ chối. | Thông tin phản hồi lời mời.<br>**Bấm:** /care-circle |
| `care_circle_removed`<br>**Kết nối đã bị xóa** | Có | Có* | Một bên xóa kết nối, thông báo cho bên còn lại. | Thông tin ngừng kết nối.<br>**Bấm:** /care-circle |
| `care_circle_permission_changed`<br>**Quyền kết nối thay đổi** | Có | Có* | Quyền chia sẻ/nhận cảnh báo thay đổi, gửi bên liên quan. | Có thông tin thay đổi quyền.<br>**Bấm:** /care-circle |

## 4. Xu, quà và mốc duy trì thói quen

| Type / ý nghĩa | Trong chuông | Ngoài app | Khi nào / ai nhận | Nội dung / khi bấm |
| --- | --- | --- | --- | --- |
| `coin_card`<br>**Nhận thiệp đổi từ xu** | Có | Có* | Đổi xu gửi thiệp tới người nhận còn kết nối; dùng mẫu thiệp đã duyệt. | Tiêu đề/nội dung động từ mẫu thiệp trong DB.<br>**Bấm:** /coins/card/[cardId], thiếu mã hợp lệ về /coins |
| `coin_refund`<br>**Đã hoàn xu** | Có | Có* | Quà không giao được, bị hủy hoặc quá hạn và hệ thống hoàn xu. | “Chưa gửi được quà. Asinu đã hoàn xu cho bạn.”<br>**Bấm:** /coins |
| `coin_expiring`<br>**Xu sắp hết hạn** | Có | Có* | Job xu tìm số xu sẽ hết hạn trong 7 ngày. | “Bạn có {coins} xu sẽ hết hạn trong 7 ngày tới.”<br>**Bấm:** /coins |
| `gift_opened`<br>**Người thân vừa mở quà** | Có | Có* | Outbox sau mở lộc/quà, gửi người thân có quyền. Sự kiện quá 24 giờ không tiếp tục giao ở nhánh này. | “Niềm vui nhỏ hôm nay”. Có thể là lời chúc / ca dao, tục ngữ / mẹo sức khỏe, kèm phiếu bốc thăm nếu phù hợp.<br>**Bấm:** Hóa đơn quà nếu có mã hợp lệ, nếu không lịch sử quà |
| `gift_draw_result`<br>**Kết quả trúng thưởng** | Có | Có* | Kết quả đã công bố; config quà/bốc thăm bật; outbox giao kết quả trong 7 ngày cho người nhận theo phiếu/hộ. | “Gia đình bạn đã trúng thưởng”. “Phiếu {số} đã trúng {quà}. Mở Asinu để xem kết quả công khai.”<br>**Bấm:** /checkin-rewards/results?period=… |
| `streak_7`<br>**Chuỗi nhật ký 7 ngày** | Có | Có* | Đạt đúng mốc 7 ngày, quét giờ sáng khớp cấu hình. Nhánh cùng loại chống gửi lại trong 25 ngày. | Chúc mừng duy trì ghi nhật ký.<br>**Bấm:** /(tabs)/missions |
| `streak_14`<br>**Chuỗi nhật ký 14 ngày** | Có | Có* | Tương tự mốc 7 ngày, tại mốc 14. | Chúc mừng duy trì ghi nhật ký.<br>**Bấm:** /(tabs)/missions |
| `streak_30`<br>**Chuỗi nhật ký 30 ngày** | Có | Có* | Tương tự mốc 7 ngày, tại mốc 30. | Chúc mừng duy trì ghi nhật ký.<br>**Bấm:** /(tabs)/missions |

## 5. Tổng kết, bản tin và nhắc sử dụng app

| Type / ý nghĩa | Trong chuông | Ngoài app | Khi nào / ai nhận | Nội dung / khi bấm |
| --- | --- | --- | --- | --- |
| `weekly_recap`<br>**Tổng kết số ngày ghi nhật ký** | Có | Có* | Chủ nhật 20:00–20:04 VN; tổng hợp 7 ngày, chống cùng loại trong 6 ngày. | Bốn biến thể: đủ 7 ngày, 5–6 ngày, 3–4 ngày, dưới 3 ngày.<br>**Bấm:** /(tabs)/missions |
| `weekly_wellness_summary`<br>**Tổng kết hoạt động sức khỏe tuần** | Có | Có* | Nhánh lifecycle vào Chủ nhật 07:00; có token và ít nhất một log trong 7 ngày. | Có tên và số log tuần. Đây là loại khác với weekly_recap và weekly_v21.<br>**Bấm:** Trang chủ |
| `health_feed`<br>**Bản tin sức khỏe phù hợp** | Có | Có* | ENABLE_HEALTH_FEED=true, bản tin cá nhân bật và flow alert/family/onboarding đủ điều kiện push. | Title/body từ bài hoặc catalog. Bài xuất hiện trong feed không đồng nghĩa đã gửi thông báo.<br>**Bấm:** /feed/[id], thiếu contentId về /feed |
| `profile_incomplete`<br>**Nhắc hoàn thiện hồ sơ** | Có | Có* | Khoảng 3–4 ngày sau đăng ký, còn thiếu thông tin và chưa từng gửi cùng loại. | Nhắc cập nhật hồ sơ.<br>**Bấm:** Onboarding |
| `engagement`<br>**Nhắc quay lại theo ngữ cảnh** | Có | Có* | Endpoint cron engagement được gọi; người bật nhắc, có token, vắng 24 giờ–30 ngày và ngoài cooldown 48 giờ. Không thấy lịch gọi riêng trong scheduler trung tâm. | Body cá nhân hóa, không có một câu cố định cho mọi tài khoản.<br>**Bấm:** Chưa có route riêng, dùng xử lý mặc định |

## 6. Gói chăm sóc và thanh toán

| Type / ý nghĩa | Trong chuông | Ngoài app | Khi nào / ai nhận | Nội dung / khi bấm |
| --- | --- | --- | --- | --- |
| `subscription_activated`<br>**Gói đã được kích hoạt** | Có | Có* | Nghiệp vụ thanh toán/cập nhật gói kích hoạt thành công; gửi chủ thể gói. | Có tên gói.<br>**Bấm:** /subscription |
| `subscription_expiring_soon`<br>**Gói sắp hết hạn** | Có | Có* | Gói trả phí còn hạn nhưng sẽ hết trong 3 ngày; job lifecycle; nhánh cùng loại giới hạn mỗi 24 giờ. | Có số ngày còn lại.<br>**Bấm:** /subscription |
| `subscription_expired`<br>**Gói đã hết hạn** | Có | Có* | Kỳ gói trả phí hết hạn trong 24 giờ vừa qua, chưa có thông báo cho kỳ này. | Thông tin gói hết hạn.<br>**Bấm:** /subscription |
| `wallet_topup_success`<br>**Nạp ví thành công** | Có | Có* | Giao dịch nạp ví được xác nhận thành công. | Có số tiền theo giao dịch.<br>**Bấm:** /wallet |
| `payment_failed`<br>**Thanh toán thất bại** | Có | Có* | Giao dịch chuyển sang trạng thái thất bại theo luồng thanh toán. | Thông tin thanh toán không thành công.<br>**Bấm:** /wallet |

## 7. Chuyên gia và IVR

| Type / ý nghĩa | Trong chuông | Ngoài app | Khi nào / ai nhận | Nội dung / khi bấm |
| --- | --- | --- | --- | --- |
| `doctor_message`<br>**Tin nhắn mới từ chuyên gia** | Có | Có* | Có tin nhắn mới hợp lệ trong task/tenant tư vấn; gửi đúng người bệnh của task. | Chuông có nội dung/preview tương ứng văn bản, giọng nói hoặc tệp. Push dùng body khóa màn hình riêng, không mặc định gửi nguyên tin nhắn nhạy cảm.<br>**Bấm:** /doctor-consultation/[taskId], thiếu task về danh sách |
| `doctor_ivr_session`<br>**Bộ câu hỏi của chuyên gia** | Có | Có* | Phiên phỏng vấn được gửi / đến remind_at và còn hạn; cần DOCTOR_IVR_ENABLED=true. | Có tên chuyên gia, số câu và thời lượng.<br>**Bấm:** /doctor-interview/[sessionId] nếu build hỗ trợ IVR |
| `doctor_ivr_reply`<br>**Phản hồi phiên phỏng vấn** | Có | Có* | Chuyên gia đã trả lời phiên; worker kiểm tra để thông báo. | Thông tin đã có phản hồi.<br>**Bấm:** Mở phiên phỏng vấn nếu build hỗ trợ IVR |
| `doctor_ivr_call`<br>**Cuộc gọi phỏng vấn chuyên gia** | Không có bản ghi riêng cùng type | Có*, cuộc gọi native | Attempt đến hạn, thiết bị và quyền gọi phù hợp; cần cả DOCTOR_IVR_ENABLED=true và DOCTOR_IVR_CALL_ENABLED=true. | Payload gọi native; không tự tạo một dòng hộp thư cùng type.<br>**Bấm:** Màn cuộc gọi IVR |

## 8. Nhắc ghi nhật ký đang tạm dừng mặc định

| Type / ý nghĩa | Trong chuông | Ngoài app | Khi nào / ai nhận | Nội dung / khi bấm |
| --- | --- | --- | --- | --- |
| `reminder_morning_summary`<br>**Tổng hợp việc ghi buổi sáng** | Có | Có* | Chỉ chạy khi HEALTH_METRIC_REMINDERS_ENABLED=true, đã onboarding, bật nhắc, khớp giờ. Fallback 08:00. | Tổng hợp đường huyết/huyết áp/nhật ký hoặc thuốc cũ còn thiếu; có nội dung theo ngữ cảnh.<br>**Bấm:** Theo firstMissing: ghi chỉ số tương ứng / check-in / trang chủ |
| `reminder_afternoon`<br>**Nhắc ghi buổi chiều** | Có | Có* | Cùng flag và quyền, khớp giờ chiều; fallback 14:00. | Việc còn thiếu và ngữ cảnh chiều.<br>**Bấm:** Theo target/missing type trong payload |
| `reminder_evening_summary`<br>**Tổng hợp việc ghi buổi tối** | Có | Có* | Cùng flag và quyền, khớp giờ tối; fallback 21:00. | Việc ghi còn thiếu buổi tối; có nhánh nhật ký/thuốc cũ.<br>**Bấm:** Theo target/missing type trong payload |

## 9. Các tình huống khác nhau bên trong cùng một type

### 9.1. `checkin_followup` và `checkin_followup_urgent`

- Phiên đang làm dở: nhắc mở lại tiến độ.
- Phiên đã có kết luận: hỏi thăm lại bằng bộ câu sau kết luận.
- Người đã báo ổn, trạng thái monitoring: nhắc theo dõi bình thường, không tự coi việc chưa phản hồi là cấp cứu.
- Bỏ lỡ các lượt tiếp theo: có thể dùng followup_urgent theo trạng thái phiên. Policy vẫn kiểm tra tình trạng hiện tại trước khi gửi.

Mốc hẹn mặc định: monitoring tới mốc 21:00; high_alert lần đầu 1 giờ, tiếp theo 2 giờ; follow_up lần đầu 3 giờ, tiếp theo 4 giờ. Nhánh cho phép có thể dùng followUpHours của AI. Khi bỏ lỡ, hẹn tiếp 2 giờ nếu high_alert, ngoài ra 4 giờ; bộ đếm không phản hồi đạt 4 thì dừng nhắc của phiên theo code. Ngày phiên check-in đổi lúc 05:00 VN.

### 9.2. `caregiver_alert` và `emergency`

`caregiver_alert` có nhiều producer: check-in, script-session cũ, wellness, nhánh gia đình của reengagement, và thông báo cho chính người dùng rằng đã báo gia đình. Những biến thể này không phải nhiều type riêng.

- Cảnh báo chưa xác nhận: quét gửi lại mỗi 30 phút, tối đa 4 lần gửi lại theo bộ đếm, ngoài lần đầu.
- Người thân đã chọn đang đến/đã gọi: nhánh báo gia đình thông thường không tiếp tục nhắc, trừ nâng mức cảnh báo.
- Chỉ xác nhận đã xem: có thể hỏi lại sau ít nhất 30 phút nếu tình trạng vẫn nguy theo nhánh xử lý.
- Reengagement gia đình không được coi là cấp cứu để bỏ qua giờ yên lặng. Người có kết nối được pause nhắc thường từ ngày 7 nên nhánh reengagement ngày 8 thường bị chặn trước; thay bằng notice một lần cho đợt vắng.

`health_alert` cũng có nhiều nguồn: chỉ số glucose cao/thấp, BP cần kiểm tra, theo dõi xu hướng, thiếu dữ liệu, kết quả check-in, context alert và yêu cầu gửi cảnh báo từ người dùng. Nhánh log mobile chống cùng loại trong 10 phút; nhánh context alert có kiểm tra 12 giờ. Đây là giới hạn theo từng nhánh, không phải một mốc chung cho mọi cảnh báo.

### 9.3. `checkin_call`

| kind / tình huống | Ý nghĩa |
| --- | --- |
| INCOMING_CALL | Gọi người dùng hoặc người thân theo trạng thái episode |
| FALLBACK | Thông báo dự phòng / chờ xác nhận sau bước gọi |
| URGENT_REPEAT | Lặp lại liên hệ khẩn theo state machine |
| EARLY_SIGNAL (trigger_source) | Cuộc gọi bắt nguồn từ tín hiệu sớm; vẫn dùng type checkin_call |

Mặc định lịch gọi tắt. Cấu hình mặc định có giờ 08:00 và grace 6 giờ, tương ứng đến hạn khoảng 14:00 nếu được bật và đủ quyền, không phải cứ 08:00 là đổ chuông. Thời gian đổ chuông mặc định 60 giây. Nhánh urgent có cửa sổ 30 phút và mốc xử lý 60 giây. Nếu người bệnh đang hiện diện trong check-in, nhánh tín hiệu sớm có thể liên hệ gia đình thay vì gọi ngược người đó giữa màn kết luận.

Mỗi delivery lưu một dòng chuông ở lần gửi đầu; retry vận chuyển không phải một loại thông báo mới. Remote end/cancel là tín hiệu điều khiển tắt cuộc gọi, không đếm vào danh mục nội dung thông báo.

### 9.4. `med_result`

| Trạng thái | Nội dung tiếng Việt |
| --- | --- |
| TAKEN | Người thân đã xác nhận uống cữ thuốc này. |
| SKIPPED | Người thân đã chọn bỏ qua cữ thuốc này. |
| OUT_OF_MEDS | Người thân báo đã hết thuốc. Nếu lặp: Người thân vẫn báo hết thuốc (lần {n} trong 7 ngày). |
| UNCONFIRMED | Cữ thuốc này chưa được xác nhận. |
| SKIPPED_NO_DEVICE | Asinu không liên lạc được với máy của người thân. |

Nhắc thuốc v21 cần feature/rollout phù hợp, lịch active, consent phù hợp và reminders_enabled. Native call cần thêm config native_call_enabled và MED_CALL_ENABLED=true. Cờ gọi tắt không có nghĩa push nhắc thuốc cũng tắt.

Attempt chờ khoảng 60 giây; nếu chưa trả lời, lượt tiếp được hẹn sau 15 phút từ khi attempt hết hạn, tối đa hai attempt theo bộ đếm. Vì vậy 18:30 và khoảng 18:46 có thể là hai lượt của cùng một cữ. Native call thuốc dùng cửa sổ 07:00–trước 21:00 theo timezone; cữ quá hạn 2 giờ không tiếp tục được gọi như mới đến giờ. Có gom cữ gần nhau theo điều kiện trong cửa sổ 30 phút.

### 9.5. Ba báo cáo tuần là ba loại riêng

- weekly_recap: số ngày ghi nhật ký.
- weekly_wellness_summary: số log/hoạt động sức khỏe.
- weekly_v21: cữ thuốc và xu gửi người thân.

Ngoài ra early_signal có biến thể tổng hợp tuần. Những loại khác nhau này không tự dedup lẫn nhau chỉ vì đều gửi nội dung tuần.

## 10. Lịch gửi và worker

Timezone scheduler trung tâm: **Asia/Ho_Chi_Minh**. Tần suất worker không phải tần suất thông báo cho mỗi người.

| Luồng | Lịch / chu kỳ | Điều kiện chính |
| --- | --- | --- |
| Check-in sáng | Quét trong giờ 07 | Chưa có phiên/ngày và chưa có thông báo sáng cùng ngày |
| Follow-up/cảnh báo chưa xác nhận | Quét mỗi phút | Chỉ lấy phiên/cảnh báo đến hạn |
| Reengagement | 09:00–09:04 | Giới hạn theo ngày, số ngày vắng và trạng thái |
| Streak | Giờ sáng cấu hình, fallback 08:00 | Đạt đúng mốc, đủ cooldown |
| Weekly recap | Chủ nhật 20:00–20:04 | Chưa có cùng loại trong cửa sổ chống trùng |
| Lifecycle | 07:00 mỗi ngày | Gói sắp hết/hết hạn, hồ sơ thiếu; Chủ nhật thêm weekly_wellness_summary |
| Cuộc gọi check-in | Worker mỗi 15 giây | Episode/attempt đến hạn, đủ quyền và cấu hình |
| Notice vắng 7 ngày | Mỗi phút | Một lần/người nhận/đợt vắng |
| Thuốc, consent, message outbox v21 | Mỗi 15 giây | Lịch/cữ/sự kiện thực tế đến hạn |
| Bảo trì thuốc/xu | 00:05 mỗi ngày | Các sự kiện ngày đủ điều kiện |
| Weekly v21 | Thứ Hai 08:00 | Người thân được nhận báo cáo |
| Giao quà/kết quả bốc thăm | Mỗi phút | Quà/kết quả đã phát sinh, config bật |
| Dựng bản tin | Mỗi 6 giờ, có thể dựng lúc đọc feed | Không phải lần nào cũng push |
| Giao thông báo bản tin | Mỗi phút | Giờ nhận, quyền, cooldown và cap phù hợp |
| Tín hiệu sớm tuần | Thứ Hai 08:00 | Quyền gói và đánh giá phù hợp |
| Retry push chung | Mỗi phút | Job pending/retry còn hiệu lực |
| IVR | Worker riêng từ server.js | Chỉ khi cờ IVR và phiên/attempt phù hợp |
| Engagement | Endpoint cron được gọi | Chưa thấy lịch riêng trong scheduler trung tâm |
| Daily health monitor | Endpoint cron được gọi | Chưa thấy lịch daily riêng trong scheduler trung tâm |

Comment weekly_wellness_summary ghi Chủ nhật 19:00, nhưng caller tự động hiện ở job lifecycle 07:00. Bảng trên dùng giờ caller thực thi.

## 11. Giới hạn, chống trùng và quyền nhận

- **Cap thông báo thường:** mặc định 3/ngày, cấu hình NOTIFICATION_DAILY_CAP; chỉ áp tập routine trong policy, không phải mọi cảnh báo/cuộc gọi.
- **Khoảng cách thường:** 5 phút; reminder theo lịch được ưu tiên trước engagement/feed gần giờ đó.
- **Cooldown cơ sở orchestrator:** critical 1 phút, high 30 phút, medium 60 phút, low 120 phút; producer có thể override.
- **Dedup:** theo tài khoản nhận, type và event identity; event giống nhau còn outbox chưa giao/hết hạn được tái sử dụng. Một sự kiện có chuông và push vẫn là cùng sự kiện.
- **Retry chung:** tối đa 5 attempt theo worker, lease 2 phút, backoff tăng từ 1, 2, 4, 8… phút. Cuộc gọi/native thuốc có worker/policy riêng.
- **Giờ yên lặng:** mặc định 22:00–trước 06:00, timezone người dùng hợp lệ, fallback VN; reminder đêm được người dùng đặt rõ và khớp slot có ngoại lệ.
- **Cảnh báo khẩn:** có đường miễn giờ yên lặng theo priority/type/cờ sự kiện. Followup/followup_urgent chỉ được miễn khi requiresImmediate hoặc alertType emergency, không chỉ vì tên urgent/priority cũ.
- **Trạng thái hiện tại:** trước khi giao, backend kiểm tra phiên check-in/revision/phase còn phù hợp, lịch thuốc/cữ còn active, người thân còn kết nối/quyền và quà còn hợp lệ. Reminder đã cũ có thể bị hủy thay vì gửi tiếp.
- **Quyền nhận:** nhắc thường cần reminders_enabled; bản tin thêm health_feed_enabled; người thân thường cần accepted + can_receive_alerts, tín hiệu sớm có thêm nhánh chủ hộ.
- **Thiết bị:** cần quyền OS và token/kênh phù hợp. Lưu trong chuông thành công không đồng nghĩa push đã hiện hoặc người nhận đã đọc.
- **Bản tin:** cửa sổ 08:00–trước 21:00 theo timezone, cooldown người dùng 24 giờ và mẫu 72 giờ. Có nhánh giữ bản ghi trong chuông nhưng bỏ/hoãn push do quyền/giới hạn.

## 12. Hiển thị ngoài app và hành động khi bấm

| Kênh | Cách hiển thị / hành động |
| --- | --- |
| Push Expo | Banner, màn hình khóa, trung tâm thông báo; thường đi cùng bản ghi chuông |
| FCM Android | Push thường hoặc data cho native call/full-screen/CallStyle |
| PushKit/APNs iOS | CallKit cho cuộc gọi; không phải một cuộc gọi PSTN tới SIM |
| MEDICATION_DOSE | Đã uống / Bỏ qua / Hết thuốc; mở app và kiểm tra phiên đăng nhập để xử lý đúng cữ |
| health_alert category | Đã xem / Đang đến / Gọi, xử lý theo payload cảnh báo |
| doctor_message category | Trả lời nhanh văn bản cho đúng task/tenant khi tính năng hỗ trợ |

Các nhóm âm thanh/channel hiện tại: reminder, alert, care-circle, doctor-consultation, checkin, milestone, incoming, missed, billing; medication fallback Android có channel riêng asinu_medication_reminder_v1. Đây là **nhóm trình bày**, không phải các loại nội dung cộng thêm.

Khi app đang chuẩn bị/hiển thị kết luận check-in, handler Expo chặn banner/sound foreground theo cơ chế ưu tiên hiện tại nhưng vẫn cho vào danh sách OS. Quy tắc này không đồng nghĩa backend ngừng lưu vào chuông.

Trong source đã rà, hai helper scheduleNotificationAsync là immediate/re-emit và chưa thấy caller hiện tại; không tìm thấy lịch nhắc hằng ngày cài bằng helper này. Nhắc thuốc khi chạy development với backend local vẫn có thể là backend gửi push/native call.

## 13. Có tên trong code nhưng không tính là producer tự động đang dùng

| Tên / nhóm | Kết quả |
| --- | --- |
| reminder_glucose, reminder_bp, reminder_log_morning, reminder_log_evening, reminder_morning | Có template/test/router/policy; không thấy producer cron riêng trực tiếp từng type như hệ thống mới. Tập metric bị ẩn/tắt khi HEALTH_METRIC_REMINDERS_ENABLED không bật |
| reminder_medication, reminder_medication_morning, reminder_medication_evening | Tên cũ trong tester/template/router tới /logs/medication; thuốc v21 dùng medication_call/med_reminder và med_* |
| reminder_water | Có tester và tên trong policy; chưa thấy producer nhắc nước định kỳ riêng |
| evening_checkin | Có policy/tester; monitoring hỏi lại 21:00 hiện dùng follow-up, không chứng minh có producer evening_checkin riêng |
| streak_start, streak_milestone, milestone | Có tester/router/priority; producer streak thật dùng streak_7/14/30 |
| wallet_low_balance | Có mẫu/route/xử lý nhận; chưa thấy producer tự động |
| alert, message | Có tên tương thích/interface/mapping; chưa thấy producer thường độc lập dưới đúng type |
| MISSED_CALL | Có classifier cho payload cũ, chưa thấy INSERT delivery cùng kind; FALLBACK có producer |
| Bộ thử NOTIF_MAP | 28 type thử, route mobile test chỉ đăng ký ngoài production; không cộng toàn bộ mẫu thử thành loại đang tự gửi |

Ba loại reminder tổng hợp ở mục 8 **có producer** nhưng bị chặn mặc định bởi flag metric; vì thế vẫn có trong danh mục 49 kèm trạng thái tạm dừng. Tư vấn chuyên gia bật ở FE hiện tại; IVR/interview cũ chỉ mở ở build development theo appEnv, còn backend có cờ riêng. Không mặc định rằng cấu hình backend và khả năng mở màn của mọi build giống nhau.

## 14. Các điểm cần phân biệt khi kiểm tra trên máy

1. **med_checkin_followup:** payload định mở check-in, router FE ưu tiên med_* về /medication.
2. **weekly_v21:** chưa có nhánh route riêng; xử lý push mặc định của SessionProvider về trang chủ. Không suy rằng mọi nơi đọc chuông có cùng fallback.
3. **doctor_message:** chuông và push khóa màn hình có thể có body khác nhau để giữ riêng tư.
4. **Một type, nhiều tình huống:** đặc biệt caregiver_alert, health_alert, med_result, checkin_call. Đối chiếu source/templateId/event/attempt ID khi nghi gửi trùng.
5. **API tạo chuông thủ công:** POST /api/notifications lưu cho chính tài khoản xác thực, type/title/message động, không gửi push từ handler này. Không thể đếm hữu hạn mọi type tùy biến.
6. **Chỉ thấy tên chưa đủ kết luận đang gửi:** route, biểu tượng, template, sound map và tester không thay thế bằng chứng producer.
7. **Không tìm thấy kênh SMS/email notification người dùng trong hai repo đã rà.** Không khẳng định về tác nhân ngoài repo.

## 15. Nguồn code đối chiếu

| Nguồn | Nội dung |
| --- | --- |
| [BE src/services/checkin/checkin.service.js](../../backend.asinu/src/services/checkin/checkin.service.js) | Check-in, follow-up, cảnh báo và xác nhận người thân |
| [BE src/services/checkin/script-session.service.js](../../backend.asinu/src/services/checkin/script-session.service.js) | Báo người thân từ kịch bản tương thích |
| [BE src/services/checkin/checkin-inactivity.service.js](../../backend.asinu/src/services/checkin/checkin-inactivity.service.js) | Notice vắng 7 ngày |
| [BE src/services/checkin-call/checkin-call.service.js](../../backend.asinu/src/services/checkin-call/checkin-call.service.js) | Delivery cuộc gọi, INSERT notifications, FCM/APNs/Expo |
| [BE src/services/v21/medication-calls.service.js](../../backend.asinu/src/services/v21/medication-calls.service.js) | Native thuốc, med_reminder và kết quả cữ |
| [BE src/services/v21/medication.service.js](../../backend.asinu/src/services/v21/medication.service.js) | Consent và thay đổi lịch |
| [BE src/services/v21/maintenance.service.js](../../backend.asinu/src/services/v21/maintenance.service.js) | Consent pending 48 giờ và bảo trì |
| [BE src/services/v21/messages.service.js](../../backend.asinu/src/services/v21/messages.service.js) | Message outbox thuốc/xu và báo cáo tuần |
| [BE src/services/v21/coins.service.js](../../backend.asinu/src/services/v21/coins.service.js) | Thiệp, hoàn xu, xu sắp hết hạn |
| [BE src/services/care-circle/careCircle.service.js](../../backend.asinu/src/services/care-circle/careCircle.service.js) | Năm sự kiện kết nối |
| [BE src/services/early-signal/early-signal.service.js](../../backend.asinu/src/services/early-signal/early-signal.service.js) | Tín hiệu sớm và người nhận |
| [BE src/services/wellness/wellness.monitoring.service.js](../../backend.asinu/src/services/wellness/wellness.monitoring.service.js) | Cảnh báo caregiver từ wellness |
| [BE src/services/profile/mobile.service.js](../../backend.asinu/src/services/profile/mobile.service.js) | Cảnh báo chỉ số từ nhật ký |
| [BE src/services/health/health.monitoring.service.js](../../backend.asinu/src/services/health/health.monitoring.service.js) | Theo dõi chỉ số và nhắc thiếu dữ liệu |
| [BE src/controllers/health.controller.js](../../backend.asinu/src/controllers/health.controller.js) | Người dùng yêu cầu báo người thân |
| [BE src/services/checkin-gifts/gift.service.js](../../backend.asinu/src/services/checkin-gifts/gift.service.js) | gift_opened |
| [BE src/services/checkin-gifts/draw.service.js](../../backend.asinu/src/services/checkin-gifts/draw.service.js) | gift_draw_result |
| [BE src/services/notification/basic.notification.service.js](../../backend.asinu/src/services/notification/basic.notification.service.js) | Reminder, streak, recap, context alert |
| [BE src/services/notification/reengagement.service.js](../../backend.asinu/src/services/notification/reengagement.service.js) | Nhắc quay lại và nhánh gia đình |
| [BE src/services/notification/engagement.notification.service.js](../../backend.asinu/src/services/notification/engagement.notification.service.js) | Engagement từ endpoint cron |
| [BE src/services/notification/lifecycle.notification.service.js](../../backend.asinu/src/services/notification/lifecycle.notification.service.js) | Gói hết hạn, hồ sơ và weekly wellness |
| [BE src/services/health_feed/service.js](../../backend.asinu/src/services/health_feed/service.js) | Bản tin, INSERT notifications và pending push |
| [BE src/services/payment/payment.service.js](../../backend.asinu/src/services/payment/payment.service.js) | Nạp ví/thanh toán lỗi |
| [BE src/services/payment/subscription.service.js](../../backend.asinu/src/services/payment/subscription.service.js) | Kích hoạt gói |
| [BE src/services/integrations/doctor-messaging.service.js](../../backend.asinu/src/services/integrations/doctor-messaging.service.js) | doctor_message và body khóa màn hình |
| [BE src/services/doctor-ivr/ivr.worker.js](../../backend.asinu/src/services/doctor-ivr/ivr.worker.js) | Thông báo phiên/phản hồi IVR |
| [BE src/services/doctor-ivr/ivr.calls.js](../../backend.asinu/src/services/doctor-ivr/ivr.calls.js) | Payload cuộc gọi IVR |
| [BE src/services/notification/notification-dispatch.service.js](../../backend.asinu/src/services/notification/notification-dispatch.service.js) | Reservation, dedup, retry, quyền và stale delivery |
| [BE src/services/notification/notification.policy.js](../../backend.asinu/src/services/notification/notification.policy.js) | Routine cap, opt-in và spacing |
| [BE src/services/notification/notification-quiet-hours.policy.js](../../backend.asinu/src/services/notification/notification-quiet-hours.policy.js) | Giờ yên lặng và ngoại lệ |
| [BE src/services/notification/checkin-reminder.policy.js](../../backend.asinu/src/services/notification/checkin-reminder.policy.js) | Copy theo trạng thái và loại reminder cũ |
| [BE src/services/notification/health-metric-reminders.policy.js](../../backend.asinu/src/services/notification/health-metric-reminders.policy.js) | Tạm dừng/ẩn nhóm metric |
| [BE src/services/notification/notification.service.js](../../backend.asinu/src/services/notification/notification.service.js) | Hộp thư và quyền đọc/xóa theo tài khoản |
| [BE src/scheduler/index.js](../../backend.asinu/src/scheduler/index.js) | Lịch worker/cron |
| [BE src/constants/index.js](../../backend.asinu/src/constants/index.js) | Bộ thử, không phải danh mục producer tự động |
| [FE src/lib/notifications.ts](../src/lib/notifications.ts) | Route, category, foreground handler và channel |
| [FE src/providers/SessionProvider.tsx](../src/providers/SessionProvider.tsx) | Nhận/bấm push và xử lý action |
| [FE src/components/NotificationsPage.tsx](../src/components/NotificationsPage.tsx) | Danh sách chuông và thao tác đọc/xóa |
| [FE src/stores/notification.store.ts](../src/stores/notification.store.ts) | Unread, phân trang và trạng thái hộp thư |
| [FE src/config/notification-sounds.json](../src/config/notification-sounds.json) | Nhóm âm thanh |
| [FE native/checkin-call/android/com/asinu/lite/notifications/MedicationReminderNotification.kt](../native/checkin-call/android/com/asinu/lite/notifications/MedicationReminderNotification.kt) | Thông báo thuốc native Android |
| [FE ios/Asinu/VoipCallManager.swift](../ios/Asinu/VoipCallManager.swift) | CallKit/PushKit iOS |

## Phụ lục. Mẫu nội dung tiếng Việt của các loại trong danh mục

Nguồn backend `src/i18n/locales/vi.json`. Chỉ ghi các mẫu tìm thấy cho type ở trên; nội dung có {{…}} sẽ được thay theo sự kiện/người nhận. Nội dung thuốc/xu/quà viết trực tiếp trong service đã ghi trong bảng chính. Mảnh ghép/câu biến thể không được đếm thành type mới.

| Type | Khóa nội dung | Mẫu tiếng Việt |
| --- | --- | --- |
| `morning_checkin` | `checkin.morning_title` | ☀️ Cập nhật sức khỏe buổi sáng |
| `morning_checkin` | `checkin.morning_body` | {{CallName}} ơi, hôm nay chưa có dữ liệu sức khỏe. Cập nhật nhanh để Asinu theo dõi tiếp nhé. |
| `checkin_followup` | `checkin.followup_title` | Cập nhật check-in |
| `checkin_followup` | `checkin.followup_normal` | {{CallName}} ơi, phần check-in đang trả lời vẫn chưa xong. Khi thuận tiện, mở Asinu trả lời tiếp nhé. |
| `checkin_followup` | `checkin.followup_high_alert` | {{CallName}} ơi, phần check-in cần theo dõi vẫn chưa xong. Hãy mở Asinu cập nhật tình trạng hiện tại nhé. |
| `checkin_followup` | `checkin.followup_monitoring` | Lần check-in trước bạn thấy khỏe. Khi thuận tiện, bạn cho Asinu biết hiện giờ bạn thấy thế nào nhé. |
| `checkin_followup` | `checkin.followup_after_result_title` | Asinu hỏi thăm lại |
| `checkin_followup` | `checkin.followup_after_result` | {{CallName}} ơi, Asinu đã ghi nhận lần check-in trước. Bây giờ {{honorific}} cảm thấy thế nào rồi? Mở Asinu cập nhật nhé. |
| `checkin_followup` | `checkin.followup_after_result_high` | {{CallName}} ơi, lần check-in trước đã được ghi nhận và cần tiếp tục theo dõi. Bây giờ {{honorific}} cảm thấy thế nào? Mở Asinu cập nhật nhé. |
| `checkin_followup_urgent` | `checkin.no_response_title` | Chưa nhận được cập nhật |
| `checkin_followup_urgent` | `checkin.no_response_body` | {{CallName}} ơi, phần check-in đang trả lời vẫn chưa xong. Mở Asinu tiếp tục khi thuận tiện nhé. |
| `health_alert` | `notification.health_alert_title` | Cần chú ý sức khỏe |
| `health_alert` | `push.health_alert_glucose_high_title` | Đường huyết rất cao |
| `health_alert` | `push.health_alert_glucose_low_title` | Đường huyết rất thấp |
| `health_alert` | `push.health_alert_glucose_body` | Chỉ số đường huyết vừa ghi nhận: {{value}} mg/dL. |
| `health_alert` | `push.health_alert_bp_title` | Huyết áp ở mức nguy hiểm |
| `health_alert` | `push.health_alert_bp_body` | Chỉ số huyết áp vừa ghi nhận: {{systolic}}/{{diastolic}} mmHg. |
| `health_alert` | `push.health_alert_family_title` | {{name}}: {{alert}} |
| `caregiver_alert` | `checkin.health_check_needed_title` | Cần kiểm tra sức khỏe |
| `caregiver_alert` | `checkin.no_response_family_body` | {{name}} chưa phản hồi sau khi báo không khỏe. Vui lòng liên hệ kiểm tra. |
| `caregiver_alert` | `checkin.family_notified_title` | Đã báo người thân |
| `caregiver_alert` | `checkin.family_notified_body` | Người thân đã nhận thông tin về tình trạng của bạn. |
| `caregiver_alert` | `wellness.consecutive_no_response` | {{count}} lần liên tiếp không có phản hồi. |
| `caregiver_alert` | `wellness.unusual_activity` | Mấy hôm nay sinh hoạt khác thường, cần theo dõi. |
| `caregiver_alert` | `wellness.feeling_unwell` | Mấy ngày gần đây thường xuyên cảm thấy không ổn. |
| `caregiver_alert` | `notification.reengagement.care_circle_alert` | {{patientName}} đã {{days}} ngày chưa check-in báo tình trạng sức khỏe. Vui lòng liên hệ để hỏi thăm. |
| `emergency` | `checkin.emergency_title` | Cần hỗ trợ khẩn cấp |
| `emergency` | `checkin.emergency_family_body` | {{name}} cần hỗ trợ khẩn cấp. Vui lòng kiểm tra ngay. |
| `caregiver_confirmed` | `checkin.caregiver_confirmed_body` | {{name}} đã nhận thông báo và {{action}}. |
| `checkin_inactivity_notice` | `notification.checkin_inactivity.title` | Tạm dừng nhắc check-in |
| `checkin_inactivity_notice` | `notification.checkin_inactivity.body` | {{patientName}} đã 7 ngày không check-in. Asinu tạm dừng thông báo nhắc và cuộc gọi check-in cho người này. Khi check-in trở lại, lịch nhắc sẽ tiếp tục. |
| `reengagement` | `notification.reengagement.user_title` | Nhắc check-in sức khỏe |
| `reengagement` | `notification.reengagement.d2_gentle` | {{CallName}} ơi, đã {{days}} ngày chưa check-in báo tình trạng sức khỏe. Hãy check-in để ghi nhận tình trạng hiện tại. |
| `reengagement` | `notification.reengagement.d2_gentle_symptom` | {{CallName}} ơi, {{symptom}} lần trước còn không? Hãy check-in báo tình trạng hôm nay để Asinu theo dõi tiếp. |
| `reengagement` | `notification.reengagement.d4_concerned` | {{CallName}} ơi, đã {{days}} ngày chưa check-in báo tình trạng sức khỏe. Hãy check-in khi thuận tiện. |
| `reengagement` | `notification.reengagement.d4_concerned_symptom` | {{CallName}} ơi, đã {{days}} ngày chưa check-in báo tình trạng sức khỏe. Nếu {{symptom}} vẫn còn, hãy ghi lại trong check-in; nếu nặng hơn, nên liên hệ cơ sở y tế. |
| `reengagement` | `notification.reengagement.d4_concerned_severe` | {{CallName}} ơi, lần check-in trước {{honorific}} ghi nhận triệu chứng nặng. Nếu chưa đỡ, nên liên hệ cơ sở y tế. |
| `reengagement` | `notification.reengagement.d7_worried` | {{CallName}} ơi, đã {{days}} ngày chưa check-in báo tình trạng sức khỏe. Hãy check-in để ghi nhận tình trạng hôm nay. |
| `reengagement` | `notification.reengagement.d7_worried_symptom` | {{CallName}} ơi, đã {{days}} ngày từ lần check-in gần nhất. Nếu {{symptom}} còn kéo dài, nên liên hệ cơ sở y tế. |
| `reengagement` | `notification.reengagement.d8_urgent` | {{CallName}} ơi, đã {{days}} ngày chưa check-in báo tình trạng sức khỏe. Nếu đang không ổn, hãy liên hệ người thân hoặc cơ sở y tế. |
| `reengagement` | `notification.reengagement.condition` | {{CallName}} ơi, đã {{days}} ngày chưa check-in báo tình trạng sức khỏe. Khi thuận tiện, hãy check-in để Asinu tiếp tục theo dõi {{condition}}. |
| `checkin_call` | `checkinCall.push.call_title` | Cuộc gọi Asinu |
| `checkin_call` | `checkinCall.push.urgent_title` | Cảnh báo Asinu |
| `checkin_call` | `checkinCall.push.incoming_body` | Asinu đang gọi, vui lòng mở ứng dụng. |
| `checkin_call` | `checkinCall.push.confirm_body` | Asinu cần bạn xác nhận cảnh báo chăm sóc. |
| `early_signal` | `push.early_signal_title` | Tín hiệu sớm: {{name}} |
| `early_signal` | `push.early_signal_weekly_title` | Tín hiệu sớm tuần này: {{name}} |
| `early_signal` | `push.early_signal_body` | {{summary}} Mức độ: {{level}}. |
| `care_circle_invitation` | `push.invitation_title` | Lời mời Care Circle |
| `care_circle_invitation` | `push.invitation_body` | {{name}} muốn kết nối với bạn trong Care Circle. |
| `care_circle_accepted` | `push.accepted_title` | Đã kết nối Care Circle |
| `care_circle_accepted` | `push.accepted_body` | {{name}} đã chấp nhận lời mời kết nối. |
| `care_circle_rejected` | `push.rejected_title` | Lời mời bị từ chối |
| `care_circle_rejected` | `push.rejected_body` | {{name}} đã từ chối lời mời kết nối. |
| `care_circle_removed` | `push.removed_title` | Kết nối đã bị hủy |
| `care_circle_removed` | `push.removed_body` | {{name}} đã hủy kết nối Care Circle. |
| `care_circle_permission_changed` | `push.permission_changed_title` | Quyền Care Circle thay đổi |
| `care_circle_permission_changed` | `push.permission_changed_body` | {{name}} đã cập nhật quyền truy cập của bạn. |
| `streak_7` | `push.streak_7_title` | Ghi log: 7 ngày |
| `streak_7` | `push.streak_7_body` | Bạn đã ghi log sức khỏe 7 ngày liên tiếp. Tiếp tục duy trì thói quen này. |
| `streak_14` | `push.streak_14_title` | Ghi log: 14 ngày |
| `streak_14` | `push.streak_14_body` | Bạn đã ghi log sức khỏe 14 ngày liên tiếp. Tiếp tục cập nhật đều đặn. |
| `streak_30` | `push.streak_30_title` | Ghi log: 30 ngày |
| `streak_30` | `push.streak_30_body` | Bạn đã ghi log sức khỏe 30 ngày liên tiếp. Tiếp tục duy trì lịch theo dõi. |
| `weekly_recap` | `push.weekly_recap_title` | Tổng kết sức khỏe tuần |
| `weekly_recap` | `push.weekly_recap_body_7` | Bạn đã ghi log đủ 7/7 ngày. Dữ liệu tuần này đã đầy đủ. |
| `weekly_recap` | `push.weekly_recap_body_good` | Bạn đã ghi log {{days}}/7 ngày. Thêm vài lần cập nhật để theo dõi đều hơn tuần tới. |
| `weekly_recap` | `push.weekly_recap_body_ok` | Bạn đã ghi log {{days}}/7 ngày. Cập nhật đều hơn sẽ giúp theo dõi xu hướng rõ hơn. |
| `weekly_recap` | `push.weekly_recap_body_low` | Tuần này có {{days}}/7 ngày được ghi nhận. Bạn có thể bắt đầu cập nhật từ hôm nay. |
| `weekly_wellness_summary` | `push.weekly_wellness_title` | Báo cáo sức khỏe tuần |
| `weekly_wellness_summary` | `push.weekly_wellness_body` | Tuần này bạn đã ghi log {{count}} lần. Mở báo cáo để xem chi tiết. |
| `health_feed` | `health_feed.push_fallback_title` | Bản tin sức khỏe mới |
| `health_feed` | `health_feed.push_fallback_body` | Bạn có một bản tin sức khỏe mới trong Asinu. |
| `profile_incomplete` | `push.profile_incomplete_title` | Hoàn thiện hồ sơ |
| `profile_incomplete` | `push.profile_incomplete_body` | Hồ sơ còn thiếu thông tin. Cập nhật để nhận theo dõi phù hợp hơn. |
| `subscription_activated` | `push.subscription_activated_title` | An Tâm đã được kích hoạt |
| `subscription_activated` | `push.subscription_activated_body` | Gói An Tâm có hiệu lực đến {{date}}. |
| `subscription_expiring_soon` | `push.subscription_expiring_title` | An Tâm sắp hết hạn |
| `subscription_expiring_soon` | `push.subscription_expiring_body` | Gói An Tâm còn {{days}} ngày. Gia hạn để tiếp tục sử dụng đầy đủ tính năng. |
| `subscription_expired` | `push.subscription_expired_title` | An Tâm đã hết hạn |
| `subscription_expired` | `push.subscription_expired_body` | Gói An Tâm đã hết hạn. Tài khoản hiện ở gói miễn phí. |
| `wallet_topup_success` | `push.wallet_topup_title` | Nạp tiền thành công |
| `wallet_topup_success` | `push.wallet_topup_body` | {{amount}}đ đã được cộng vào ví. Số dư hiện tại: {{balance}}đ. |
| `payment_failed` | `push.payment_failed_title` | Thanh toán chưa hoàn tất |
| `payment_failed` | `push.payment_failed_body` | Giao dịch {{amount}}đ chưa thành công. Kiểm tra lại phương thức thanh toán. |
| `doctor_message` | `push.doctor_message_title` | Tin nhắn mới từ bác sĩ |
| `doctor_message` | `push.doctor_lockscreen_named` | Bác sĩ {{name}} đã gửi tin nhắn trong cuộc tư vấn của bạn. |
| `doctor_message` | `push.doctor_lockscreen_generic` | Bác sĩ đã gửi tin nhắn trong cuộc tư vấn của bạn. |
| `doctor_message` | `push.doctor_voice_preview` | Đã gửi một tin nhắn thoại. |
| `doctor_message` | `push.doctor_attachment_preview` | Đã gửi một tệp đính kèm. |
| `doctor_message` | `push.doctor_message_preview` | Bác sĩ {{name}}: {{preview}} |
| `doctor_ivr_session` | `notification.doctor_ivr_request_title` | Bác sĩ cần hỏi thêm |
| `doctor_ivr_session` | `notification.doctor_ivr_request_count_body` | Bác sĩ {{doctorName}} cần hỏi anh/chị {{count}} câu, khoảng {{minutes}} phút. |
| `doctor_ivr_reply` | `notification.doctor_ivr_reply_title` | Bác sĩ đã trả lời |
| `doctor_ivr_reply` | `notification.doctor_ivr_reply_body` | Bạn có thể đọc hoặc nghe kết quả tư vấn trên Asinu. |
| `doctor_ivr_call` | `notification.doctor_ivr_call_title` | Bác sĩ {{doctorName}} cần hỏi thêm |
| `doctor_ivr_call` | `notification.doctor_ivr_call_body` | Nghe câu hỏi và chọn câu trả lời. |
| `reminder_morning_summary` | `push.reminder_log_morning_title` | Cập nhật sức khỏe buổi sáng |
| `reminder_morning_summary` | `notification.morning.still_to_do` |  Còn thiếu: {{tasks}}. |
| `reminder_morning_summary` | `notification.morning.fallback_no_data` | {{CallName}} ơi, hôm nay còn cần ghi nhận: {{tasks}}. Hãy cập nhật tình trạng hiện tại để Asinu theo dõi tiếp. |
| `reminder_evening_summary` | `push.reminder_log_evening_title` | Cập nhật sức khỏe buổi tối |

Tài liệu là kiểm kê source local tại thời điểm rà soát. Không gửi thử thông báo, không đọc lịch sử tài khoản, không sửa logic gửi, không commit/push/deploy khi chỉnh phạm vi tài liệu này.
