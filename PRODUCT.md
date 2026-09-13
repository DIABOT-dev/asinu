# Product

## Register

product

## Users

Người dùng ASINU theo dõi sức khỏe cá nhân hằng ngày, ghi nhận chỉ số và triệu chứng, kết nối người thân trong Care Circle và gửi yêu cầu tư vấn tức thời tới phòng khám. Họ có thể không quen thuật ngữ y tế hoặc kỹ thuật, vì vậy mọi trạng thái và hướng dẫn phải ngắn gọn, dễ hiểu và không tạo cảm giác đang được chẩn đoán tự động.

## Product Purpose

ASINU là ứng dụng sức khỏe cá nhân trên iOS và Android, giúp người dùng duy trì một timeline sức khỏe liên tục từ hồ sơ khai báo, check-in, chỉ số sức khỏe và các cuộc tư vấn. Với tư vấn bác sĩ, sản phẩm chỉ hỗ trợ tư vấn ngay: người dùng chọn phòng khám, chuyên khoa và bác sĩ hoặc để hệ thống phân công, sau đó theo dõi trạng thái hàng đợi và trao đổi trong một luồng thống nhất. Sản phẩm không cung cấp đặt lịch.

## Brand Personality

Ấm áp, tin cậy, điềm tĩnh và rõ ràng. Giao diện cần tạo cảm giác được đồng hành nhưng không dùng ngôn ngữ gây hoang mang, khẳng định quá mức hoặc khiến người dùng hiểu AI thay thế bác sĩ.

## Anti-references

- Không hiển thị UUID, tenant ID, secret hoặc thuật ngữ hạ tầng cho người dùng.
- Không dùng dữ liệu giả, bác sĩ giả hoặc trạng thái không có API tương ứng.
- Không trộn tư vấn ngay với đặt lịch, khung giờ hoặc no-show.
- Không ẩn cảnh báo cấp cứu trong nội dung dài hoặc chỉ truyền đạt mức nguy hiểm bằng màu sắc.
- Không dùng ảnh trang trí từ mạng làm chậm màn hình nghiệp vụ chính khi icon và thành phần sẵn có đã đủ diễn đạt.
- Không cho phép AI tự gửi nội dung y tế tới bệnh nhân dưới danh nghĩa bác sĩ.

## Design Principles

1. Một hành trình liên tục: chọn nơi tư vấn, sàng lọc, xác nhận, chờ bác sĩ, hội thoại và tóm tắt sau ca nằm trong cùng một ngữ cảnh.
2. Trạng thái phải giải thích được: người dùng luôn biết ca đang chờ, đã phân công, đang xử lý, chờ phản hồi hay đã hoàn tất.
3. Dữ liệu thật dẫn dắt UI: mọi lựa chọn phòng khám, chuyên khoa, bác sĩ, ETA, tệp và trạng thái đều lấy từ backend.
4. An toàn trước tiện lợi: dấu hiệu nguy hiểm phải dẫn tới hướng dẫn gọi 115 hoặc đến cơ sở cấp cứu; tư vấn từ xa không được mô tả như phương án cấp cứu.
5. Riêng tư theo ngữ cảnh: chỉ chia sẻ dữ liệu sức khỏe trong phạm vi consent của ca và không lộ định danh kỹ thuật trên giao diện.
6. Tương thích hệ thống hiện có: tái sử dụng typography, spacing, màu chủ đạo teal và thành phần React Native đang dùng trong app.

## Accessibility & Inclusion

Hướng tới WCAG 2.1 AA trong giới hạn React Native: vùng chạm tối thiểu 44 x 44, nhãn trợ năng cho nút/icon, focus và trạng thái chọn rõ, tương phản đủ, không truyền đạt thông tin chỉ bằng màu và nội dung vẫn đọc được khi tăng cỡ chữ hoặc trên màn hình nhỏ.
