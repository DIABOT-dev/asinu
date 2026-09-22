---
type: product-audit
title: "Asinu v2 — Rà soát Sprint Demo Closed Care Loop"
updated: 2026-09-22
status: action-required
scope:
  - app/asinu
  - app/backend.asinu
excludes:
  - doctor
  - crm
  - thanh toán bác sĩ
  - VNPay
---

# Asinu v2 — Rà soát Sprint Demo Closed Care Loop

## 1. Kết luận điều hành

Asinu hiện **đã có nền tảng kỹ thuật cho Closed Care Loop**, gồm check-in, triage ba mức, Care Circle, lưu notification, caregiver xác nhận và trạng thái check-in `resolved`.

Tuy nhiên, bản hiện tại **chưa đạt Definition of Done của kịch bản demo**:

> Bố/mẹ check-in → AI phân loại 🟡 → con nhận cảnh báo → Đã xem → Đang xử lý → Đã ổn.

Bốn blocker phải xử lý trước buổi demo:

1. Triage mức vàng (`medium`) của người cao tuổi có bệnh nền hiện vẫn trả `needsFamilyAlert=false`, nên Care Circle không nhận cảnh báo như kịch bản.
2. Caregiver chỉ có `seen`, `on_my_way`, `called`; chưa có state machine đúng `Chưa xem → Đã xem → Đang xử lý → Đã ổn`.
3. `package.json` khai báo `seed:care-circle-demo`, nhưng file `scripts/seed-care-circle-demo.js` không tồn tại.
4. Luồng xóa tài khoản vẫn lỗi khi user có dữ liệu `user_engagement`; yêu cầu NĐ13 chưa đạt.

Ngoài ra, `alert_decision_audit` hiện không bất biến: database không có trigger chặn `UPDATE/DELETE`, tài khoản sở hữu bảng vẫn có đủ quyền sửa/xóa.

## 2. Phạm vi Sprint cần giữ

### Trong phạm vi

- App bệnh nhân/người cao tuổi.
- Check-in sức khỏe.
- Triage rule-based ba mức 🟢🟡🔴.
- Care Circle và cảnh báo cho người thân.
- Alert Lifecycle.
- Onboarding nhanh và dữ liệu demo.
- Dashboard phục vụ đúng kịch bản demo.
- Giới hạn AI và fallback.
- Disclaimer, consent, xóa dữ liệu và audit log.
- Chuẩn bị build/store và video backup.

### Ngoài phạm vi P0

- Doctor portal.
- CRM.
- Thanh toán bác sĩ, VNPay và refund.
- Hoàn thiện toàn bộ dr.asinu.
- Các tính năng Premium không liên quan trực tiếp tới Closed Care Loop.

Nếu màn hình Doctor đang xuất hiện trong app demo, chỉ cần ẩn bằng feature flag hoặc để dưới dạng teaser. Không đưa nó vào câu chuyện chính.

## 3. Bằng chứng đã kiểm tra

Ngày kiểm tra: **22/09/2026**.

### Backend

- `npm test -- --runInBand`: **23 test suite, 166 test đạt**.
- `npm run build`: đạt.
- Database local đang dùng: `asinu_test` tại `localhost:5432`.
- Smoke test có database thật đã chạy thành công:
  - tạo patient và caregiver tạm;
  - tạo Care Circle có quyền nhận/xác nhận cảnh báo;
  - patient check-in;
  - triage red flag;
  - backend tạo notification và bản ghi xác nhận;
  - caregiver xác nhận `seen`;
  - pending alert giảm từ 1 xuống 0;
  - patient cập nhật `fine` hai lần và phiên chuyển `monitoring → resolved`;
  - dữ liệu test đã được dọn sạch.

### Triage rule-based

| Tình huống test | Kỳ vọng | Thực tế | Kết quả |
|---|---:|---:|---:|
| Người trẻ, triệu chứng đang đỡ | `low` | `low` | Đạt |
| Người 65 tuổi, cao huyết áp, triệu chứng không đổi | `medium` | `medium` | Đạt phân loại |
| Người 65 tuổi, cao huyết áp, triệu chứng nặng hơn | `high` | `high` | Đạt |
| Có red flag | `high` | `high` | Đạt |
| Mức vàng phải báo Care Circle theo demo | `true` | `false` | **Không đạt** |

### Mobile app

- `npm run type-check`: đạt.
- `npm run i18n:check`: đạt, 14 namespace VI/EN khớp key.
- `npm run lint:assets`: đạt.
- ESLint: **0 error, 5.922 warning**, trong đó 3.141 warning có thể tự động sửa.
- Chưa có script test UI/component/E2E trong `package.json` của mobile app.

### Chưa được xác minh

- Push notification thật trên hai thiết bị khi app foreground/background/killed.
- Luồng vàng hoàn chỉnh qua HTTP API và giao diện thật.
- Onboarding hoàn thành trong 60 giây bằng người dùng mới.
- IAP thật trên App Store Sandbox và Google Play Internal Testing.
- Trạng thái hồ sơ thực tế trên App Store Connect/Play Console.
- Kịch bản live trên mạng của địa điểm tổ chức.

## 4. Đánh giá theo kế hoạch Sprint

Quy ước:

- **Đạt**: có code, có test và khớp tiêu chí nghiệm thu.
- **Một phần**: có nền tảng nhưng chưa khớp đúng hành vi demo hoặc chưa test thiết bị thật.
- **Chưa đạt**: thiếu luồng, thiếu file hoặc test xác nhận thất bại.
- **Founder chốt**: cần quyết định sản phẩm/vận hành trước khi dev sửa.

| ID | Trạng thái | Hiện trạng | Khoảng trống cần xử lý |
|---|---|---|---|
| P0-1 Triage 3 mức | Một phần | Engine phân loại đúng `low/medium/high`; red flag có rule cứng | Mức vàng demo không báo Care Circle; bước phân loại triệu chứng đầu vào vẫn có thể gọi AI; chưa có test contract ba màu ở API |
| P0-2 Closed Care Loop | Một phần | Core backend có thể tạo alert, xác nhận và kết thúc phiên | Smoke test thành công ở nhánh đỏ, chưa phải nhánh vàng; caregiver không thể đưa loop tới `resolved` theo đúng kịch bản |
| P0-3 Care Circle + notification | Một phần | Có pending alert, push listener, modal và ba action | Không có state `in_progress/resolved`; push thật chưa test trên hai máy; emergency response thiếu `familyAlertResult` |
| P0-4 Onboarding + seed | Chưa đạt | Có onboarding V2 năm trang | Nhiều trường bắt buộc nên chưa chứng minh 60 giây; seed script bị thiếu; dashboard mới vẫn có empty state |
| P0-5 Pitch + traction + video | Founder chốt | Không phải phần code | Chưa có bằng chứng về số traction, video backup và lời thoại sân khấu |
| P1-1 Dashboard | Một phần | Home và Care Circle có dữ liệu thật | Chưa audit bằng mắt theo hai persona; empty state còn xuất hiện; chưa có demo focus mode |
| P1-2 AI demo có giới hạn | Một phần | Chatbot có daily/monthly gate; script regeneration có quota và fallback | Không có `DEMO_MODE`; triage long-tail classifier không dùng cùng quota; env local/prod chưa khai báo ngân sách cụ thể |
| P1-3 UX + test mắt | Chưa nghiệm thu | TypeScript/i18n/assets đạt | Không có automated UI test; 5.922 lint warning; chưa test font lớn, máy nhỏ, mạng chậm và thao tác người cao tuổi |
| P1-4 dr.asinu | Chưa cần P0 | App vẫn có “Tư vấn chuyên gia”, “Tìm bác sĩ...” | Nếu xuất hiện trong demo phải ẩn hoặc đổi đúng “Tham vấn & Định hướng”; không mở rộng chức năng trong Sprint này |
| P2-1 Pháp lý/NĐ13 | Chưa đạt | Có disclaimer, consent field và AI output guardrail | Xóa tài khoản vẫn lỗi; audit log chưa bất biến; consent onboarding mặc định được tick và backend tự ghi nhận khi complete |
| P2-2 Store | Một phần | Có bundle ID, Apple Sign-in, PrivacyInfo, IAP scaffold, EAS config | Chưa có bằng chứng external console; đường dẫn ASC key là đường dẫn máy cá nhân; chưa có screenshot/ASO/version notes được nghiệm thu |

## 5. Những điểm Founder phải chốt

### C1. Khi nào cảnh báo vàng được gửi cho Care Circle?

Hiện trạng: `medium` không tự báo người thân.

Khuyến nghị để vừa đúng demo vừa tránh spam production:

- 🟢 Green: không báo Care Circle.
- 🟡 Yellow thông thường: theo dõi và hỏi lại, không báo ngay.
- 🟡 Yellow + người dễ tổn thương: báo Care Circle ở mức không khẩn cấp khi có ít nhất một điều kiện:
  - tuổi từ 60 trở lên và có bệnh nền;
  - triệu chứng không cải thiện/nặng hơn;
  - bỏ lỡ follow-up;
  - người dùng chủ động chọn “Báo cho người thân”.
- 🔴 Red/emergency: báo ngay, không phụ thuộc AI.

Kịch bản demo tiểu đường/huyết áp sẽ đi qua nhánh “Yellow + người dễ tổn thương”.

Quyết định cần ghi thành một câu có thể test được, ví dụ:

> Với user từ 60 tuổi có bệnh nền, kết luận medium phải tạo một caregiver alert nếu có Care Circle đã accepted và `can_receive_alerts=true`.

### C2. Ai có quyền bấm “Đã ổn”?

Hai phương án:

1. **Khuyến nghị an toàn:** caregiver bấm “Đã xem/Đang xử lý”; patient là người xác nhận “Tôi đã ổn”.
2. Caregiver được bấm “Đã ổn” sau khi đã liên hệ, nhưng phải có quyền `can_ack_escalation`, ghi người thao tác, thời gian và lý do.

Không nên để action `seen` tự đồng nghĩa với `resolved`.

### C3. Demo onboarding hay demo Closed Care Loop?

Nếu thời lượng demo ngắn, không nên bắt đầu bằng onboarding năm trang. Khuyến nghị:

- Closed Care Loop dùng hai tài khoản seed sẵn.
- Onboarding 60 giây quay thành video hoặc demo riêng.
- Có nút/reset script dành riêng cho staging để đưa dữ liệu về trạng thái ban đầu.

### C4. Dùng môi trường nào để demo?

Khuyến nghị:

- Một staging backend cố định, không dùng URL ngrok đổi theo phiên.
- Database staging riêng.
- Hai thiết bị thật hoặc một thiết bị thật + một simulator đã đăng nhập sẵn.
- `EXPO_PUBLIC_USE_MOCK_DATA=false`.
- Push token thật.
- Có kịch bản deterministic để kết quả không thay đổi theo AI.

### C5. Doctor có xuất hiện trong demo không?

Khuyến nghị: **không đưa Doctor vào luồng chính**. Có thể để một teaser cuối bài nói, hoặc ẩn toàn bộ CTA Doctor bằng feature flag trong demo build.

### C6. Chốt ngày demo và ngày nộp store

Cần ba mốc:

- Ngày code freeze.
- Ngày quay video backup.
- Ngày nộp App Store/Play Console.

Nếu chưa có ngày chấm, không thể chốt lịch store có buffer an toàn.

### C7. Chốt con số traction

Chỉ dùng số thật, có nguồn kiểm chứng. Ví dụ cần định nghĩa rõ “30 user pilot” là:

- 30 tài khoản đã đăng ký;
- hay 30 người đã check-in;
- hay 30 người dùng hoạt động trong 7 ngày.

## 6. Những việc Đức có thể xử lý ngay

Các mục dưới đây không cần đợi quyết định sản phẩm lớn.

### T1. Chuẩn hóa response cảnh báo của triage

Vấn đề:

- Nhánh emergency do keyword/red flag có tạo alert trong DB nhưng không trả `familyAlertResult`.
- Frontend chỉ hiện banner “đã báo người thân” khi field này tồn tại.

Việc làm:

- Gom logic cảnh báo về một helper trả cùng schema.
- Mọi kết luận `high/emergency` phải trả:
  - `attempted`;
  - `caregiversNotified`;
  - `alreadyAlerted`;
  - `caregiver_status`;
  - `needs_caregiver_cta`.
- Thêm test không có caregiver, có một caregiver, duplicate/cooldown.

Definition of Done:

- Frontend luôn biết alert đã gửi hay chưa.
- Retry không tạo trùng alert.
- Không caregiver thì hiện CTA mời người thân.

### T2. Khôi phục seed demo

Vấn đề:

- Script npm tồn tại nhưng file thực thi bị thiếu.

Việc làm:

- Tạo `scripts/seed-care-circle-demo.js` idempotent.
- Seed hai tài khoản staging:
  - patient 65 tuổi, cao huyết áp/tiểu đường;
  - caregiver là con;
  - connection accepted;
  - `can_receive_alerts=true`;
  - `can_ack_escalation=true`.
- Seed profile, một ít health logs và trạng thái dashboard không rỗng.
- Không seed alert đang mở trước khi demo bắt đầu.
- Có lệnh reset chỉ cho development/staging.
- Cấm chạy script nếu `NODE_ENV=production` trừ khi có flag xác nhận riêng.

Definition of Done:

- Chạy seed hai lần không tạo dữ liệu trùng.
- Có thể reset và chạy lại demo trong dưới một phút.
- Không sử dụng thông tin cá nhân thật.

### T3. Sửa xóa tài khoản/NĐ13

Kết quả test hiện tại:

- Tạo user có một dòng `user_engagement`.
- Gọi `deleteAccount`.
- API service trả `{ok:false, error:"Lỗi khi xoá tài khoản"}`.
- User và engagement vẫn còn do transaction rollback.

Việc làm:

- Không duy trì danh sách delete thủ công dễ sót bảng.
- Rà toàn bộ foreign key tới `users`.
- Các dữ liệu thuộc user phải dùng `ON DELETE CASCADE` phù hợp hoặc được xóa trong transaction.
- Những dữ liệu bắt buộc lưu vì pháp luật phải được anonymize, không giữ định danh trực tiếp.
- Thêm integration test tạo dữ liệu đại diện ở tất cả module rồi xóa account.
- Kiểm tra cả CRM/Doctor outbox theo ID ngoài foreign key.

Definition of Done:

- Endpoint trả 200.
- Không còn dữ liệu nhận diện được của user trong các bảng thuộc phạm vi xóa.
- Không còn worker/outbox retry cho user đã xóa.
- Test chạy lặp lại ổn định.

### T4. Làm audit log bất biến

Hiện trạng database:

- `alert_decision_audit` không có trigger chống sửa/xóa.
- Owner hiện có quyền `UPDATE`, `DELETE`, `TRUNCATE`.

Việc làm:

- Tạo role ghi log chỉ có `INSERT/SELECT` cần thiết.
- Chặn `UPDATE/DELETE` qua trigger hoặc quyền database.
- Không cho app runtime kết nối bằng owner/superuser.
- Nếu cần correction, ghi event bù mới thay vì sửa dòng cũ.
- Ghi actor, request ID, config version và timestamp.

Definition of Done:

- Runtime role insert được.
- Runtime role update/delete/truncate bị từ chối.
- Có test database chứng minh hành vi này.

### T5. Sửa consent onboarding

Hiện trạng:

- Checkbox consent phía mobile mặc định `true`.
- Endpoint `complete-v2` không nhận/validate bằng chứng consent.
- Backend tự ghi `consent_accepted_at` khi hoàn thành onboarding.

Việc làm:

- Consent mặc định `false`.
- Gửi `consent_accepted`, `consent_version`, `accepted_at` từ client.
- Backend bắt buộc `consent_accepted=true` và version hợp lệ.
- Lưu version chính sách thực tế, không hardcode vĩnh viễn `v1.0.0`.
- Nếu user từ chối, giải thích tính năng nào không dùng được nhưng không giả ghi đồng ý.

Definition of Done:

- Không thể hoàn tất bước thu thập dữ liệu sức khỏe nếu chưa đồng ý rõ ràng.
- Không thể bypass bằng gọi API trực tiếp.
- Có audit event cho consent và withdrawal.

### T6. Thêm test contract cho P0

Việc làm:

- Test triage API cho green/yellow/red.
- Test user không có Care Circle.
- Test Care Circle chưa accepted.
- Test không có quyền nhận alert.
- Test duplicate alert/cooldown.
- Test hai caregiver cùng thao tác.
- Test retry cùng request không tạo state sai.
- Test phiên đã resolved không bị mở lại ngoài ý muốn.
- Test notification khi không có push token vẫn tồn tại trong in-app inbox.

Definition of Done:

- Có một lệnh duy nhất chạy toàn bộ acceptance test P0.
- CI fail nếu một state transition hoặc contract response sai.

## 7. Những việc cần Founder chốt trước khi Đức code

### T7. Quy tắc cảnh báo vàng

Phụ thuộc C1. Sau khi chốt, Đức cần:

- sửa `calculateConclusion` hoặc policy sau triage;
- không hardcode riêng cho tài khoản demo;
- phân biệt alert vàng và emergency trong nội dung/âm thanh/UI;
- bảo đảm alert vàng không nói “cấp cứu”;
- thêm test cho user 65 tuổi có cao huyết áp/tiểu đường.

### T8. Alert Lifecycle bốn trạng thái

Phụ thuộc C2.

Mô hình đề xuất:

| Trạng thái sản phẩm | Backend | Người tạo transition |
|---|---|---|
| Chưa xem | `pending` | Hệ thống tạo alert |
| Đã xem | `seen` | Caregiver mở/xác nhận |
| Đang xử lý | `in_progress` | Caregiver chọn gọi/đang đến |
| Đã ổn | `resolved` | Patient xác nhận hoặc caregiver có quyền theo quyết định C2 |

Việc làm:

- Thêm migration cho `status`, `seen_at`, `in_progress_at`, `resolved_at`, `resolved_by`.
- Giữ backward compatibility với `confirmed_action` trong giai đoạn chuyển đổi.
- Endpoint status update phải kiểm tra quan hệ và permission.
- State transition phải idempotent và không được đi lùi tùy tiện.
- Gửi realtime/push cho phía còn lại sau transition.
- UI Caregiver modal và màn member phải hiển thị cùng state.
- Lưu timeline để demo được “vòng lặp đã khép kín”.

Definition of Done:

- Hai thiết bị nhìn thấy cùng trạng thái trong vài giây.
- Refresh/reopen app không mất trạng thái.
- Không thể xác nhận alert của người không thuộc Care Circle.
- “Đã ổn” kết thúc đúng phiên liên quan, không đóng nhầm phiên khác.

### T9. Onboarding 60 giây

Phụ thuộc C3.

Hiện onboarding có năm bước và nhiều trường bắt buộc. Founder phải chọn:

- rút gọn production onboarding;
- hoặc giữ production onboarding và dùng tài khoản seed cho demo.

Khuyến nghị Sprint này: giữ luồng production, chỉ sửa rõ ràng/lỗi; demo Closed Care Loop bằng tài khoản seed.

Nếu vẫn bắt buộc 60 giây:

- chỉ bắt buộc tên, năm sinh, giới tính, một bệnh nền/mục tiêu và consent;
- chiều cao/cân nặng/ăn uống/lối sống cho phép bổ sung sau;
- đo thời gian bằng ba người chưa từng dùng app;
- tiêu chí đạt: ít nhất 2/3 người hoàn thành dưới 60 giây không cần hướng dẫn.

### T10. Doctor visibility

Phụ thuộc C5.

Nếu ẩn:

- thêm feature flag rõ ràng;
- ẩn CTA ở Home, check-in result và Profile;
- không xóa code Doctor;
- không để deep link làm crash.

Nếu giữ teaser:

- dùng “Tham vấn & Định hướng”;
- không dùng “khám bệnh”;
- không để CTA kéo giám khảo khỏi Closed Care Loop.

## 8. Việc P1 nên làm sau khi P0 chạy xuyên suốt

### P1-A. Demo mode có phanh

- Thêm `DEMO_MODE` phía backend và build profile staging.
- Demo mode chỉ nới UX, không bỏ safety rule.
- Dùng deterministic fixture cho kịch bản sân khấu.
- Đặt hard cap theo user/device/IP cho các AI call.
- Ghi token/cost theo feature: triage, chat, onboarding, script generation.
- Khi hết quota hoặc AI lỗi, fallback rule-based phải tiếp tục được loop.
- Không dùng `TESTING_MODE=true` trong production.

Lưu ý hiện tại:

- Chatbot đã có daily/monthly gate.
- Script regeneration đã có quota mặc định free `2`, premium `10` mỗi tháng.
- Triage long-tail safety classifier chưa đi qua cùng quota.
- Local mobile đang gọi API qua ngrok; production gọi `https://asinu.top`.

### P1-B. Tách dashboard theo persona

Người cao tuổi chỉ cần thấy:

- “Hôm nay bác thấy thế nào?”
- Một nút check-in lớn.
- Trạng thái người thân đã nhận/xử lý.
- Nút SOS rõ ràng.

Caregiver chỉ cần thấy:

- Người thân nào cần chú ý.
- Trạng thái alert hiện tại.
- Hành động tiếp theo.
- Lần cập nhật gần nhất.

Các widget không phục vụ câu chuyện demo nên ẩn khỏi demo focus mode.

### P1-C. UX/accessibility

- Test font `large/xlarge`.
- Test thiết bị màn nhỏ.
- Touch target tối thiểu phù hợp người lớn tuổi.
- Không dùng màu làm tín hiệu duy nhất; luôn có nhãn 🟢/🟡/🔴 bằng chữ.
- Loading phải có timeout và retry.
- Mạng chậm không được tạo hai check-in/alert.
- Dọn warning theo vùng code thay đổi; không cần biến Sprint thành chiến dịch sửa toàn bộ 5.922 warning.

## 9. Việc P2 cần hoàn thành trước go-live

### P2-A. Ba lá chắn pháp lý

1. Disclaimer:
   - app cung cấp thông tin, sàng lọc và định hướng;
   - không chẩn đoán, kê đơn hoặc thay thế cấp cứu.
2. Guardrail đầu ra:
   - hiện đã có bộ lọc chẩn đoán/thuốc/liều;
   - cần test mọi đường AI đều gọi filter trước khi trả client.
3. Audit bất biến:
   - hiện chưa đạt, xử lý theo T4.

Ngoài ra cần review dữ liệu nội dung tĩnh. `health_feed/seedData.json` đang có câu nhắc sử dụng thuốc theo hướng dẫn cũ; dù không phải AI, vẫn phải qua duyệt nội dung chuyên môn/pháp lý trước production.

### P2-B. Store readiness

Đã có:

- iOS bundle ID và Android package `com.asinu.lite`.
- Apple Sign-in plugin.
- IAP scaffold và product IDs.
- iOS PrivacyInfo manifest.
- EAS production build dùng app bundle cho Android.

Cần xác minh ngoài repository:

- App Store product đã Ready to Submit.
- Google Play product đã active trên Internal Testing.
- Restore Purchase chạy thật.
- Server notification/webhook production.
- Privacy labels/Data Safety khớp dữ liệu app thu thập.
- Screenshot, ASO và version notes.
- Review account và hướng dẫn reviewer.

Rủi ro vận hành:

- `eas.json` đang trỏ `ascApiKeyPath` tới đường dẫn tuyệt đối trên máy cá nhân; cần chuyển sang EAS Secret/credential management hoặc runbook rõ ràng.

## 10. Thứ tự triển khai Sprint đề xuất

### Ngày 0 — chốt sản phẩm

- Chốt C1: yellow alert policy.
- Chốt C2: ai được resolve.
- Chốt C3: onboarding live hay seed.
- Chốt C5: ẩn hay giữ Doctor teaser.
- Chốt ngày demo/code freeze/store.

### Ngày 1 — backend P0

- T1 chuẩn hóa response.
- T7 yellow alert rule.
- T8 migration và state machine.
- Viết test transition/idempotency/permission.

### Ngày 2 — frontend P0

- Hiển thị đúng ba mức.
- Caregiver lifecycle bốn trạng thái.
- Đồng bộ trạng thái patient/caregiver.
- Error/loading/retry cơ bản.

### Ngày 3 — dữ liệu demo và onboarding

- T2 seed/reset script.
- Chốt tài khoản demo.
- Bổ sung dữ liệu dashboard.
- Đo onboarding nếu vẫn demo trực tiếp.

### Ngày 4 — hai thiết bị thật

- Test foreground/background/killed.
- Test Wi-Fi/4G và mạng chậm.
- Test push token mất/hết hạn.
- Test refresh/relogin.
- Test font lớn và màn hình nhỏ.

### Ngày 5 — hardening và backup

- Sửa T3/T4/T5 pháp lý.
- Chạy regression.
- Code freeze.
- Quay video backup.
- Chốt lời thoại và traction.
- Tạo build nộp store hoặc internal testing.

## 11. Kịch bản nghiệm thu bắt buộc

### AC-01 — Green

- Patient check-in nhẹ/đang đỡ.
- Kết quả green.
- Không tạo caregiver alert.
- Có hướng dẫn theo dõi phù hợp.

### AC-02 — Yellow demo

- Patient seed: 65 tuổi, cao huyết áp/tiểu đường.
- Check-in tạo medium/yellow theo rule đã chốt.
- Caregiver nhận push và in-app alert.
- Patient thấy “Đã thông báo người thân”.
- Không hiển thị nội dung cấp cứu.

### AC-03 — Alert Lifecycle

- Ban đầu: Chưa xem.
- Caregiver mở: Đã xem.
- Caregiver chọn gọi/đang đến: Đang xử lý.
- Actor được phép xác nhận an toàn: Đã ổn.
- Cả hai thiết bị hiển thị cùng trạng thái.

### AC-04 — Red/emergency

- Red flag chuyển đỏ ngay, không bị AI downgrade.
- Gợi ý gọi 115/cơ sở y tế phù hợp.
- Cảnh báo Care Circle ngay.
- Retry không spam duplicate.

### AC-05 — Không có caregiver

- Triage vẫn hoàn tất.
- Không báo sai “đã gửi”.
- Hiển thị CTA thêm Care Circle.
- Emergency vẫn hướng dẫn gọi dịch vụ khẩn cấp.

### AC-06 — AI lỗi/hết quota

- Check-in không bị cụt.
- Fallback rule-based trả kết quả.
- Không gọi AI lặp vô hạn.
- Log được provider/model/tokens/cost/fallback reason.

### AC-07 — Seed/reset

- Seed chạy idempotent.
- Reset xóa đúng dữ liệu demo của phiên.
- Không chạm dữ liệu user thật.
- Bị chặn ở production.

### AC-08 — NĐ13

- Consent không tick sẵn.
- API không nhận onboarding nếu thiếu consent hợp lệ.
- Xóa tài khoản có dữ liệu đầy đủ vẫn trả 200.
- Không còn dữ liệu định danh ngoài phạm vi lưu giữ hợp pháp.
- Audit runtime không sửa/xóa được.

### AC-09 — Store build

- App khởi động từ build release, không phải Expo Go.
- Login Apple/Google hoạt động.
- Push hoạt động.
- IAP/restore hoạt động theo build profile.
- Không có QR/wallet ngoài store cho hàng số.

## 12. Runbook demo đề xuất

### Chuẩn bị trước sân khấu

- Máy A đăng nhập patient.
- Máy B đăng nhập caregiver.
- Hai máy có Internet và push token hợp lệ.
- Reset demo hoàn tất.
- Không có alert cũ.
- Bật Do Not Disturb cho app khác, nhưng cho phép notification Asinu.
- Mở sẵn video backup offline.

### Trình tự demo

1. Patient mở Home và bấm check-in.
2. Chọn câu trả lời fixture tạo mức vàng.
3. App hiện kết quả 🟡 và trạng thái đã báo người thân.
4. Máy caregiver nhận notification.
5. Caregiver mở alert: trạng thái Đã xem.
6. Caregiver chọn gọi/đang đến: trạng thái Đang xử lý.
7. Actor đã chốt ở C2 xác nhận Đã ổn.
8. Hai máy cùng hiện vòng lặp đã khép kín.
9. Founder kết bằng một câu: “Asinu không chỉ cảnh báo; Asinu theo dõi đến khi gia đình biết việc đã được xử lý.”

Thời lượng mục tiêu: 2–3 phút.

## 13. Checklist giao việc trong buổi họp

### Founder

- [ ] Chốt C1 yellow alert policy.
- [ ] Chốt C2 quyền resolve.
- [ ] Chốt C3 onboarding/seed.
- [ ] Chốt C5 Doctor visibility.
- [ ] Chốt ngày demo, code freeze và store submission.
- [ ] Chốt traction có nguồn.
- [ ] Viết lời thoại 2–3 phút.
- [ ] Chỉ định người quay video backup.

### Đức

- [ ] T1 chuẩn hóa family alert response.
- [ ] T2 khôi phục seed/reset.
- [ ] T3 sửa xóa tài khoản.
- [ ] T4 audit bất biến.
- [ ] T5 consent rõ ràng.
- [ ] T6 acceptance test P0.
- [ ] T7 triển khai yellow rule sau khi chốt.
- [ ] T8 lifecycle bốn trạng thái sau khi chốt.
- [ ] T9 onboarding theo phạm vi đã chốt.
- [ ] T10 Doctor visibility theo phạm vi đã chốt.
- [ ] Test hai thiết bị và cung cấp video bằng chứng.

## 14. Definition of Done của Sprint

Sprint chỉ được đánh dấu hoàn thành khi tất cả điều sau đúng:

- [ ] Green/yellow/red đều có test contract.
- [ ] Yellow demo thật sự gửi alert tới đúng caregiver.
- [ ] Lifecycle chạy đủ `Chưa xem → Đã xem → Đang xử lý → Đã ổn`.
- [ ] Hai thiết bị đồng bộ trạng thái.
- [ ] Seed/reset chạy trong dưới một phút và không đụng production.
- [ ] AI lỗi/hết quota không làm check-in bị cụt.
- [ ] Không có notification trùng khi retry.
- [ ] Consent không tick sẵn và backend validate consent.
- [ ] Delete Account integration test đạt.
- [ ] Audit log runtime không sửa/xóa được.
- [ ] Type-check, i18n, assets và backend tests đều đạt.
- [ ] Có video backup offline.
- [ ] Có traction thật và lời thoại demo.
- [ ] Build release đã chạy thử trên thiết bị thật.

## 15. File/code liên quan chính

- Mobile check-in: `app/checkin/index.tsx`
- Mobile caregiver modal: `src/components/CaregiverAlertModal.tsx`
- Mobile check-in API: `src/features/checkin/checkin.api.ts`
- Mobile onboarding: `app/onboarding/index.tsx`
- Mobile environment: `src/lib/env.ts`
- Backend triage engine: `../../backend.asinu/src/core/checkin/triage-engine.js`
- Backend triage/check-in flow: `../../backend.asinu/src/services/checkin/checkin.service.js`
- Backend check-in controller: `../../backend.asinu/src/controllers/checkin.controller.js`
- Caregiver state helper: `../../backend.asinu/src/services/care-circle/caregiver-status.service.js`
- AI safety filter: `../../backend.asinu/src/services/ai/ai-safety.service.js`
- Chatbot gate: `../../backend.asinu/src/middleware/chatbot.gate.middleware.js`
- Script quota: `../../backend.asinu/src/services/checkin/script-quota.service.js`
- Account deletion: `../../backend.asinu/src/services/profile/profile.service.js`
- Risk audit migration: `../../backend.asinu/db/migrations/020_asinu_risk_engine_audit.sql`
- Backend scripts: `../../backend.asinu/package.json`
