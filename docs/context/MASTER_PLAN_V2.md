ASINU MVP MASTER PLAN (V2.0)
Trạng thái: LOCKDOWN (Đóng băng phạm vi)
Mục tiêu: Submit App lên Google Play & App Store trong 72h.
Ngày cập nhật: 25/12/2025

1. NGUYÊN TẮC BẤT DI BẤT DỊCH (THE IRON RULES)
- Source of Truth: Code nằm tại ROOT (./). apps/asinu-lite là RÁC (Legacy) - CẤM SỬA.
- Mobile Path: src/app/ (Expo Router).
- API Path: src/app/api/ (Next.js).
- Nguyên tắc AI: "Client Hint, Server Judge" (Mobile gửi dữ liệu, Server quyết định rủi ro).

2. BẢNG TIẾN ĐỘ CHI TIẾT (TASKS TABLE)

🔴 PHASE 1: DỌN DẸP TÀN DƯ HÔM QUA (Fix & Stabilize)
Mục tiêu: Đảm bảo môi trường sạch, không còn "Ghost UI".
| ID  | Công việc (Task)      | Trạng thái   | Yêu cầu kỹ thuật (Criteria) |
|-----|----------------------|--------------|-----------------------------|
| 1.1 | Confirm Clean Env    | ⚠️ PENDING   | Chạy npx expo start --clear tại Root. App phải hiện đúng UI mới nhất (không còn chữ "Meal ID"). |
| 1.2 | Lock Architecture    | ✅ DONE      | File docs/context/ARCHITECTURE_MAP.md đã được update thủ công để trỏ về Root. |
| 1.3 | API Sync Check       | ⏳ TODO      | Kiểm tra npm run dev (Backend) và Mobile có thông nhau không? (Login thử 1 phát). |

🟡 PHASE 2: TÍNH NĂNG CỐT LÕI (Core Features MVP)
Mục tiêu: Hoàn thiện 2 tính năng "ăn tiền" để Store duyệt.
| ID  | Tính năng           | Chi tiết kỹ thuật                                                                 | Directive áp dụng         |
|-----|---------------------|--------------------------------------------------------------------------------|--------------------------|
| 2.1 | Dia Brain Gateway   | Backend: - API /api/ai/chat. - Check Content-Length < 10KB. - Logic: Trust Level + Risk Rules (<54/>400). - Log DB: context_snapshot, decision. Mobile: - Lấy log từ Zustand store -> Nén -> Gửi kèm request. | DIRECTIVE 009 (Patched & Final) |
| 2.2 | Local Missions      | Frontend Only: - Store: missionStore (Zustand persist). - UI: Nút "Thêm nhiệm vụ", nhập tên. - Logic: Reset trạng thái khi qua ngày mới. | DIRECTIVE 010            |

🟢 PHASE 3: CHUẨN HÓA STORE (Store Polish)
Mục tiêu: Đủ điều kiện pháp lý để không bị Reject.
| ID  | Hạng mục            | Chi tiết thực hiện                                                               | Directive áp dụng         |
|-----|---------------------|--------------------------------------------------------------------------------|--------------------------|
| 3.1 | Medical Disclaimer  | Thêm dòng cảnh báo "Không thay thế bác sĩ" vào màn Login & Settings.            | DIRECTIVE 011            |
| 3.2 | Delete Account      | Nút xóa tài khoản trong Settings (Soft-delete hoặc Contact Admin).               | DIRECTIVE 011            |
| 3.3 | App Config          | app.json: Tên "Asinu", Version "1.0.0", Orientation "Portrait".               | DIRECTIVE 011            |
| 3.4 | Assets              | Icon 1024px, 3 Screenshots (6.5 inch), Privacy Policy URL. (Operator Manual)     |                          |

3. LỘ TRÌNH THỰC THI (EXECUTION FLOW)
Đây là thứ tự bạn cần giao cho Codex ngay bây giờ:
- Bước 1 (Environment): Kiểm tra xong Phase 1 (App chạy đúng ở Root).
- Bước 2 (Backend AI): Chạy Directive 009 (Tạo bảng DB + API Route an toàn).
- Bước 3 (Mobile AI): Chạy tiếp phần Frontend của Directive 009 (Kết nối API + Gửi Context).
- Bước 4 (Missions): Chạy Directive 010 (Làm tính năng nhiệm vụ Local).
- Bước 5 (Polish): Chạy Directive 011 (Thêm Disclaimer/Config).
- Bước 6 (Build): Chạy eas build hoặc npx expo run:android --variant release.

4. QUẢN LÝ RỦI RO (RISK MANAGEMENT)
- Nếu Codex sửa nhầm file ở apps/asinu-lite: -> Dừng lại, bắt đọc lại ARCHITECTURE_MAP.md.
- Nếu AI trả lời ngu/sai y khoa: -> Kiểm tra lại System Prompt và Risk Logic trong route.ts.
- Nếu App crash khi chat: -> Kiểm tra size payload gửi lên và try-catch ở mobile.
