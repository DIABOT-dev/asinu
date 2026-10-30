# SRS V2.1 — Nội dung thực sự cần chốt

**Ngày rà soát:** 29/10/2026

**Tài liệu đối chiếu:** SRS V2.1 — Nhắc thuốc qua tổng đài & Nhiệm vụ nhận xu, đổi quà.

**Thay thế:** Danh sách 10 câu hỏi trước đó.

SRS đã mô tả khá đầy đủ luồng, ngoại lệ và tiêu chí nghiệm thu. Danh sách trước đã hỏi thừa một số nội dung tài liệu có sẵn và đưa cả lựa chọn kỹ thuật thành câu hỏi nghiệp vụ. Không cần yêu cầu xác nhận lại toàn bộ danh sách đó.

## Quyết định ĐÃ CHỐT — 29/10/2026

**“Lát nữa” ở lần nhắc cuối được ghi nhận là bỏ cữ để tổng hợp tuân thủ; báo cáo hiển thị “uống không đều”.**

**Quyết định nguyên văn của người dùng:**

> Lát nữa nên để skip đi. Mình sẽ ghi nhận báo cáo là uống ko đều sau cho đỡ rối.

- Lần nhắc đầu chọn “Lát nữa” vẫn ghi nhận `LATER` và nhắc lại sau 30 phút theo FR-A4.
- Ở lần nhắc cuối (lần thứ hai), nếu bố mẹ vẫn chọn “Lát nữa” và chưa xác nhận uống, ghi nhận kết quả nghiệp vụ là **bỏ cữ** để tổng hợp tuân thủ, ánh xạ `medication_adherence.status = skipped`; nhãn báo cáo là **“uống không đều”**.
- Giữ tối đa hai cuộc gọi/cữ theo FR-A4, không gọi lần ba.
- Đây là kết quả nghiệp vụ bỏ cữ và ánh xạ báo cáo `skipped`; không tự bổ sung enum `SKIPPED` vào `med_dose_events` vì SRS hiện chưa quy định enum này.
- Giữ nút “Lát nữa” và quy tắc nhận xu khi bấm bất kỳ nút nào, chỉ một lần/cữ theo SRS; quyết định này không thay đổi quyền lợi nhận xu.

Ví dụ: ngày có hai cữ thuốc; cữ sáng đã xác nhận uống, cữ tối chọn “Lát nữa” ở cả hai lần nhắc và sau đó không phản hồi thêm. Cữ tối được ghi nhận bỏ cữ để tổng hợp tuân thủ, kết quả báo cáo là `skipped` với nhãn “uống không đều”.

**Không còn câu hỏi bổ sung từ đợt rà soát này.** Mục Founder cần chốt của SRS gốc vẫn giữ nguyên như dưới đây.

## Các quyết định Founder đã được liệt kê trong SRS

Giữ nguyên mục **“Việc Founder cần chốt trước khi code”** của tài liệu gốc. Các giá trị còn ghi “đề xuất” như phạm vi Free, khung giờ gọi, bảng xu/giá quà/hạn xu cần xác nhận tại chính mục đó; không tạo thêm một danh sách câu hỏi trùng lặp.

## Các nội dung không cần hỏi lại

| Nội dung | Căn cứ và cách xử lý |
| --- | --- |
| Cuộc gọi trên máy thật khi khóa màn hình | US-A2 và AC-A1 đã nêu mục tiêu. Dev phải thử trên thiết bị thật và báo kết quả; nếu không đạt mới trình bày giới hạn và phương án điều chỉnh. |
| Khoảng gọi lại | FR-A4 đã nêu 30 phút sau LATER, 15 phút khi không nghe; EA3 nêu dời khi có cuộc gọi khác. Xác nhận các đề xuất ở mục Founder, không hỏi lại như một yêu cầu mới. |
| Cữ hỏi check-in | FR-A5 ghi cữ đầu tiên trong ngày, bấm 1 và chưa check-in. Triển khai theo điều kiện này; không tự đổi thành cữ đầu tiên được trả lời. |
| Người nhà cài/sửa lịch | A1b và EA19 đã cho phép nhiều con cài; lịch mới cần bố mẹ đồng ý, sửa lịch ACTIVE không xin lại nhưng phải thông báo và ghi audit. Không tự phát sinh thêm vai trò quản trị thuốc. |
| Phạm vi kết quả theo cữ | SRS quy định trạng thái ở cấp cữ. V2.1 không yêu cầu thêm màn xác nhận riêng từng viên/món; nội dung báo cáo phải phản ánh đúng mức thông tin đã thu thập. |
| Báo cáo dùng thuốc | FR-A7, FR-A9 và AC-A5 đã nêu yêu cầu. Dev đồng bộ log và số cữ; không suy diễn một cữ đã uống thành cả ngày đã uống đủ. |
| Cấu trúc phiếu đổi bằng xu | Dev bổ sung nguồn/liên kết lần đổi phù hợp schema hiện tại, giữ luật xu theo tài khoản, giới hạn 3 phiếu/tháng/người và kỳ quay theo SRS. Không cần hỏi Founder cách sửa bảng dữ liệu. |
| Đọc ảnh và đơn viết tay | A1b, EA14–EA16 đã quy định chỉ chép thông tin có trên ảnh, không đọc/lưu/phát liều và chuyển sang chip khi cần. Chạy bài thử 20 ảnh rồi nộp Founder duyệt theo yêu cầu sẵn có. |
| Chống trùng, khóa số dư, phân bổ xu và hoàn xu | Đây là phần thiết kế kỹ thuật để đáp ứng luật đã chốt. Không cần hỏi Founder về khóa dòng, unique key, outbox hoặc cách tổ chức ledger. |
| API, migration, mã hóa và hủy cuộc gọi check-in | Dev ánh xạ vào cấu trúc hiện tại; dùng service check-in sẵn có để hủy cuộc gọi, không lưu cữ thuốc vào bảng của An Tâm. |

Các trường hợp biên còn lại được ghi thành quyết định triển khai và ca kiểm thử. Chỉ hỏi thêm khi phát hiện mâu thuẫn không thể giải quyết theo SRS hoặc cần thay đổi phạm vi sản phẩm.
