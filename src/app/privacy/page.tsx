// /src/app/privacy/page.tsx
import BackHomeBar from "@/components/BackHomeBar";
import LegalContainer from "@/components/LegalContainer";

export default function PrivacyPage() {
  const lastUpdated = "02/10/2025";

  return (
    <>
      <BackHomeBar title="Privacy Policy / Chính sách bảo mật" />
      <LegalContainer>
        <header className="mb-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold">Privacy Policy / Chính sách bảo mật</h2>
            <p className="text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
          </div>
        </header>

        <article className="prose prose-sm max-w-none dark:prose-invert">
          <h3>I. Scope &amp; Purpose / Phạm vi &amp; Mục đích</h3>
          <p><strong>EN:</strong> ANORA collects and processes data to: (i) log health metrics (blood glucose, weight, blood pressure, meals, water, insulin), (ii) display charts/reports, (iii) send safe reminders, (iv) provide AI-based suggestions (when enabled). The MVP has no in-app payments; subscription clauses apply only when Premium is activated later.</p>
          <p><strong>VI:</strong> ANORA thu thập & xử lý dữ liệu để: (i) ghi log sức khỏe (đường huyết, cân nặng, huyết áp, bữa ăn, nước, insulin), (ii) hiển thị biểu đồ/báo cáo, (iii) gửi nhắc nhở an toàn, (iv) cung cấp gợi ý AI (khi bật). Bản MVP chưa có thanh toán; điều khoản thanh toán chỉ áp dụng khi bật Premium sau này.</p>

          <h3>II. Data We Collect / Dữ liệu thu thập</h3>
          <ul>
            <li><strong>Account:</strong> email/ID, tên hiển thị (nếu có).</li>
            <li><strong>User-provided Health Data:</strong> BG, BP, weight, water, meals (text/images nếu tải), insulin.</li>
            <li><strong>Device & App Events:</strong> phiên bản app, loại thiết bị, crash/perf logs.</li>
            <li><strong>Payments (future):</strong> trạng thái đăng ký qua Google/Apple; <em>không</em> lưu thẻ.</li>
            <li><strong>AI Inputs:</strong> nội dung bạn nhập; không dùng cho quảng cáo.</li>
            <li><strong>Phone Number / Số điện thoại:</strong> We may collect and store your phone number for account login, identification, and future OTP-based authentication.<br /><strong>VI:</strong> Chúng tôi có thể thu thập và lưu số điện thoại của bạn để đăng nhập tài khoản, xác minh danh tính, và có thể dùng cho cơ chế OTP trong tương lai.</li>

          </ul>
          <p><em>No ad-tracking / Không theo dõi quảng cáo.</em></p>

          <h3>III. Legal Basis & Purposes / Cơ sở pháp lý & Mục đích</h3>
          <ul>
            <li><strong>Contract/Performance:</strong> log, chart, reminders.</li>
            <li><strong>Legitimate Interests:</strong> bảo mật, chống lạm dụng, ổn định.</li>
            <li><strong>Consent:</strong> AI, push, (tương lai) HealthKit/Google Fit.</li>
            <li><strong>Legal Obligation:</strong> tuân thủ yêu cầu hợp pháp.</li>
          </ul>

          <h3>IV. Storage & Security / Lưu trữ & bảo mật</h3>
          <ul>
            <li>Supabase + <em>Row Level Security (RLS)</em>.</li>
            <li>TLS khi truyền; bảo vệ tại chỗ theo nhà cung cấp.</li>
            <li>Backup ngắn hạn; dữ liệu xoá sẽ bị ghi đè theo chu kỳ.</li>
            <li>Có thể xử lý xuyên biên giới với biện pháp bảo vệ phù hợp.</li>
          </ul>

          <h3>V. Data Sharing / Chia sẻ dữ liệu</h3>
          <p>Không bán dữ liệu. Chỉ chia sẻ với: sub-processors (Supabase, AI providers khi bật, Google/Apple khi bật billing), tuân thủ pháp luật, hoặc theo yêu cầu bạn (export/share).</p>

          <h3>VI. Your Rights / Quyền của bạn</h3>
          <ul>
            <li>Truy cập, chỉnh sửa, tải xuống (PDF/CSV).</li>
            <li>Xoá tài khoản & dữ liệu (xem Mục VIII).</li>
            <li>Rút lại đồng ý cho tính năng tùy chọn.</li>
          </ul>
          <p>Qua Cài đặt hoặc email <a className="underline" href="mailto:support@anora.top">support@anora.top</a>.</p>

          <h3>VII. Retention / Thời hạn lưu</h3>
          <ul>
            <li>Tài khoản & dữ liệu sức khỏe: đến khi bạn xoá hoặc 24 tháng không hoạt động (sẽ thông báo trước khi dọn).</li>
            <li>System logs: tối đa 12 tháng.</li>
          </ul>

          <h3>VIII. Account & Data Deletion / Xoá tài khoản & dữ liệu</h3>
          <p><strong>Trong app:</strong> Settings → Account → Delete account (xóa vĩnh viễn, không khôi phục). Backup bị ghi đè theo lịch.</p>
          <p><strong>Qua email:</strong> từ email đăng ký nếu không truy cập được app.</p>
          <p><em>Khi bật Premium sau này:</em> xoá tài khoản ≠ hủy gia hạn; quản lý trong Google Play/App Store.</p>

          <h3>IX. Communications / Thông báo</h3>
          <p>Gửi thông báo dịch vụ; marketing là opt-in, có thể hủy bất cứ lúc nào.</p>

          <h3>X. Children’s Privacy / Trẻ em</h3>
          <p>Không dành cho trẻ dưới 13 tuổi.</p>

          <h3>XI. Changes / Thay đổi</h3>
          <p>Cập nhật sẽ hiển thị tại trang này; tiếp tục sử dụng là chấp nhận bản mới.</p>

          <h3>XII. Contact / Liên hệ</h3>
          <p>Anora — 12 A, ngách 1/16, Ngõ 1 Thúy Lĩnh, Hà Nội, Việt Nam • Email: support@anora.top • Phone: +84 898 888 917</p>
        </article>
      </LegalContainer>
    </>
  );
}
