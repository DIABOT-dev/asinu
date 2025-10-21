// /src/app/terms/page.tsx
import BackHomeBar from "@/components/BackHomeBar";
import LegalContainer from "@/components/LegalContainer";

export default function PrivacyPage() {
  return (
    <>
      <BackHomeBar title="Privacy Policy / Chính sách bảo mật" />
      <LegalContainer>
        <article className="prose prose-sm max-w-none dark:prose-invert">
          <h2>1. Acceptance / Chấp nhận</h2>
          <p>By using DIABOT, you agree to these Terms. / Bằng việc sử dụng DIABOT, bạn đồng ý với Điều khoản này.</p>

          <h2>2. Services / Dịch vụ</h2>
          <ul>
            <li>Free: log sức khỏe, biểu đồ, nhắc nhở.</li>
            <li>Premium: gợi ý cá nhân hóa, phân tích nâng cao, voice chat (khi bật).</li>
            <li>Thông tin hiển thị chỉ mang tính tham khảo, không thay thế tư vấn y tế.</li>
          </ul>

          <h2>3. User Obligations / Trách nhiệm Người dùng</h2>
          <ul>
            <li>Cung cấp thông tin chính xác; bảo mật tài khoản.</li>
            <li>Không sử dụng app vào mục đích vi phạm pháp luật.</li>

          <h2>3a. Phone Number as Username / Sử dụng số điện thoại làm tên đăng nhập</h2>
<p>
  <strong>EN:</strong> DIABOT may require users to register and log in with their
  phone number. Your phone number may serve as your primary username for account
  identification and login purposes.
</p>
<p>
  <strong>VI:</strong> DIABOT có thể yêu cầu người dùng đăng ký và đăng nhập bằng
  số điện thoại. Số điện thoại của bạn có thể được sử dụng làm tên đăng nhập
  chính để nhận diện và truy cập tài khoản.
</p>

          </ul>

          <h2>4. Provider Obligations / Trách nhiệm của ANORA</h2>
          <ul>
            <li>Bảo mật dữ liệu theo Chính sách bảo mật.</li>
            <li>Duy trì & cải thiện dịch vụ; có quyền tạm ngừng khi phát hiện vi phạm.</li>
          </ul>

          <h2>5. Intellectual Property / Sở hữu trí tuệ</h2>
          <p>Logo, thương hiệu, nội dung, mã nguồn thuộc ANORA; không sao chép khai thác trái phép.</p>

          <h2>6. Medical Disclaimer / Miễn trừ y tế</h2>
          <p>ANORA không chẩn đoán/điều trị/kê đơn; chỉ hỗ trợ quản lý lối sống. Hãy tham khảo bác sĩ khi cần.</p>

          <h2>7. Limitation of Liability / Giới hạn trách nhiệm</h2>
          <p>ANORA không chịu trách nhiệm cho thiệt hại gián tiếp/hệ quả; tổng trách nhiệm không vượt quá phí bạn đã trả trong 12 tháng gần nhất.</p>

          <h2>8. Subscription & Payments / Thanh toán</h2>
          <p><strong>Chỉ áp dụng khi Premium được kích hoạt.</strong> Dùng thử 7 ngày (khi triển khai). Sau đó 200.000đ/tháng hoặc 2.000.000đ/năm (tự gia hạn). Thanh toán qua Google Play/App Store; hoàn phí theo chính sách của họ.</p>

          <h2>9. Amendments / Sửa đổi</h2>
          <p>ANORA có thể cập nhật Điều khoản; thông báo trong app/website. Tiếp tục sử dụng là chấp nhận phiên bản mới.</p>

          <h2>10. Governing Law & Disputes / Luật áp dụng & Tranh chấp</h2>
          <p>Luật Việt Nam; ưu tiên thương lượng, nếu không thành thì tòa án có thẩm quyền tại Hà Nội.</p>

          <h2>11. Contact / Liên hệ</h2>
          <p>support@anora.top • +84 898 888 917</p>
        </article>
      </LegalContainer>
      <div className="h-[84px] sm:h-0" aria-hidden /> 
    </>
  );
}
