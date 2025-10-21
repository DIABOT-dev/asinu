// /src/app/about/page.tsx
import BackHomeBar from "@/components/BackHomeBar";
import LegalContainer from "@/components/LegalContainer";

export default function AboutPage() {
  return (
    <>
      <BackHomeBar title="About DIABOT / Giới thiệu DIABOT" />
      <LegalContainer>
        <article className="prose prose-sm max-w-none dark:prose-invert">
          <h2>DIABOT – Trợ lý sức khỏe thông minh cho người tiểu đường</h2>
          <p>
            DIABOT được phát triển như một người bạn đồng hành, giúp bạn{" "}
            <strong>theo dõi chỉ số sức khỏe, quản lý thói quen ăn uống, và
            nhận nhắc nhở an toàn mỗi ngày</strong>. Với DIABOT, việc chăm sóc
            sức khỏe không còn khô khan mà trở nên nhẹ nhàng, dễ dàng và gắn bó
            như một phần trong cuộc sống hàng ngày.
          </p>

          <h3>Tầm nhìn &amp; Sứ mệnh</h3>
          <ul>
            <li>
              <strong>Sứ mệnh:</strong> Hỗ trợ hàng triệu người quản lý tiểu
              đường và bệnh chuyển hóa một cách khoa học, tiết kiệm, hiệu quả.
            </li>
            <li>
              <strong>Tầm nhìn:</strong> Trở thành nền tảng{" "}
              <em>AI Health Companion</em> hàng đầu, kết nối bệnh nhân – người
              thân – bác sĩ, mang lại hệ sinh thái chăm sóc sức khỏe toàn diện.
            </li>
          </ul>

          <h3>Các tính năng chính</h3>
          <ul>
            <li>
              <strong>Ghi log sức khỏe:</strong> Đường huyết, cân nặng, huyết
              áp, nước, bữa ăn, insulin.
            </li>
            <li>
              <strong>Biểu đồ &amp; Báo cáo:</strong> Theo ngày, tuần, tháng để
              nắm bắt xu hướng.
            </li>
            <li>
              <strong>Nhắc nhở thông minh:</strong> Uống nước, đo chỉ số, cân
              nặng, dùng thuốc (sau này).
            </li>
            <li>
              <strong>AI Companion:</strong> Gợi ý thực đơn, giải thích chỉ số,
              voice chat tiếng Việt (Premium).
            </li>
            <li>
              <strong>Xuất dữ liệu:</strong> PDF/CSV để chia sẻ với người thân
              hoặc bác sĩ.
            </li>
            <li>
              <strong>Gia đình &amp; Cộng đồng:</strong> (sau này) – người thân
              nhận cảnh báo, bác sĩ kết nối từ xa.
            </li>
          </ul>

          <h3>Cam kết của DIABOT</h3>
          <ul>
            <li>
              <strong>An toàn:</strong> Không chẩn đoán, không kê đơn; luôn nhắc
              tham khảo bác sĩ.
            </li>
            <li>
              <strong>Bảo mật:</strong> Dữ liệu lưu trữ an toàn, chỉ bạn có
              quyền truy cập.
            </li>
            <li>
              <strong>Đồng hành lâu dài:</strong> Tính năng được phát triển dựa
              trên phản hồi thực tế từ cộng đồng.
            </li>
          </ul>

          <h3>Vì sao chọn DIABOT?</h3>
          <ul>
            <li>
              <strong>Đơn giản:</strong> Giao diện thân thiện, dễ dùng cho mọi
              người.
            </li>
            <li>
              <strong>Cá nhân hóa:</strong> AI học từ thói quen và chỉ số của
              bạn.
            </li>
            <li>
              <strong>Tiết kiệm:</strong> Giải pháp quản lý sức khỏe ngay trong
              tầm tay.
            </li>
            <li>
              <strong>Gắn kết:</strong> Kết nối bạn – gia đình – chuyên gia.
            </li>
          </ul>

          <h3>Liên hệ</h3>
          <p>
            <strong>Website:</strong>{" "}
            <a href="https://anora.top" className="underline">
              anora.top
            </a>
            <br />
            <strong>Email:</strong>{" "}
            <a href="mailto:support@anora.top" className="underline">
              support@anora.top
            </a>
            <br />
            <strong>Điện thoại:</strong> +84 898 888 917
            <br />
            <strong>Địa chỉ:</strong> 12 A, ngách 1/16, Ngõ 1 Thúy Lĩnh, Phường
            Lĩnh Nam, Hà Nội, Việt Nam
          </p>
        </article>
      </LegalContainer>
    </>
  );
}
