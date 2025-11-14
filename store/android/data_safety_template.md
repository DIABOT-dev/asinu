# Google Play Data Safety – Template

| Hạng mục dữ liệu | Có thu thập? | Mục đích chính | Chia sẻ bên thứ ba | Ghi chú |
|------------------|--------------|----------------|--------------------|--------|
| Email / Contact info | TODO | Đăng nhập, hỗ trợ người dùng | TODO | Mã hóa ở trạng thái nghỉ & truyền |
| Health logs (hydration, BG, BP, weight) | TODO | Tính năng chính, nhắc nhở | TODO | Được bảo vệ trong database Postgres |
| Device IDs / App info | TODO | Analytics, phát hiện lỗi | TODO | Không dùng cho quảng cáo |
| Usage analytics | TODO | Hiểu luồng tính năng | TODO | Ẩn danh, tổng hợp |

## Chính sách lưu trữ & mã hóa
- ✅ Dữ liệu truyền qua HTTPS.
- ✅ Mã hóa Postgres cấp hạ tầng (managed DB). Có thể bổ sung mô tả cụ thể theo môi trường triển khai.

## Yêu cầu xóa dữ liệu
- Người dùng có thể yêu cầu xóa tài khoản qua email support@asinu.health.
- TODO: link đến trang form nếu có.

## Mục bổ sung cần hoàn thiện
- [ ] Liệt kê rõ các SDK của bên thứ ba nếu tích hợp.
- [ ] Mô tả chính sách chia sẻ dữ liệu cá nhân hóa (nếu có).
- [ ] Kiểm tra lại với đội pháp lý trước khi submit.
