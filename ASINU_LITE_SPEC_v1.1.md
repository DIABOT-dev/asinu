# ASINU LITE – SPEC v1.1 (FINAL ARCHITECTURE)
#asinu-new

## 0. Tư duy chiến lược: Backend ổn định – Mobile làm mới

### Backend (`src/`) = NÃO – GIỮ NGUYÊN
- Toàn bộ logic Auth, Bridge Dia Brain, Domain, Modules, Usecases, Repository, Database.
- **Tuyệt đối không viết lại, không chỉnh sửa để chiều nhu cầu của Mobile.**
- Nếu Mobile cần thêm API → chỉ mở lớp REST mỏng `/api/mobile/*` gọi vào usecase có sẵn.

### Mobile (`apps/asinu-lite`) = MẮT + TAY MỚI – XÂY DỰNG TỪ 0
- Không reuse `apps/mobile` cũ (coi như legacy).
- Xây 1 app hoàn toàn mới dựa trên Expo Router + Template UI.
- Từ dòng code đầu tiên phải mang kiến trúc Asinu, không follow kiến trúc mẫu mental-health rồi sửa.

### Cách ly rủi ro & tốc độ
- Backend và Mobile là 2 dự án tách biệt, chỉ giao tiếp qua HTTP.
- Mobile nát cỡ nào cũng không ảnh hưởng Backend.
- Đảm bảo Codex Cloud có thể code nhanh, ít rủi ro, dễ rollback.

---

## 1. Cấu trúc repo tổng thể

```txt
ROOT/
│
├── src/                          # 🧠 BACKEND (CORE, KEEP)
│   ├── modules/                  # auth, mission, tree, bg, bp, insulin...
│   ├── domain/
│   ├── application/
│   ├── infrastructure/
│   └── ...                       # GIỮ NGUYÊN, KHÔNG ĐỤNG
│
├── apps/
│   ├── mobile/                   # 🗑️ LEGACY (để tham khảo)
│   └── asinu-lite/               # ✨ APP MOBILE MỚI
│       ├── app/                  # Router + Screens
│       ├── src/                  # UI Kit + Features + Logic Client
│       ├── package.json
│       └── ...
│
└── package.json                  # Config monorepo
2. Phạm vi MVP (Mobile)
2.1. Mục tiêu sản phẩm
App dành cho người con chăm bố/mẹ tiểu đường:

Ghi chỉ số sức khoẻ hằng ngày.

Thực hiện nhiệm vụ hỗ trợ sức khỏe.

Theo dõi tiến triển qua “Cây Sức Khoẻ”.

Dashboard tổng quan.

Quản lý hồ sơ cơ bản.

2.2. 5 tính năng lõi MVP
Tính năng	Mô tả
Logs	Ghi đường huyết, huyết áp, thuốc/insulin (ưu tiên cao nhất)
Missions	Danh sách nhiệm vụ ngày + hoàn thành
Life Tree	Điểm + biểu đồ lịch sử sức khoẻ
Home Dashboard	Tổng hợp Logs + Missions + Tree
Profile + Settings	Thông tin user + logout

2.3. Chưa thuộc MVP (có UI nhưng ẩn bằng Flag)
Mood tracker

Journal

Audio/Relaxation

Daily check-in

Community/chat

Rewards, donation, shop

Family Forest nâng cao

AI Chat / AI Feed / AI Summary

Offline nâng cao

3. Cấu trúc thư mục apps/asinu-lite
Lưu ý quan trọng: Các màn hình chính nằm trong group (tabs) để tạo Bottom Tab Bar chuẩn Expo Router.

bash
Sao chép mã
apps/
└── asinu-lite/
    ├── app/
    │   ├── _layout.tsx                 # Root layout (Session, Query providers)
    │   ├── index.tsx                   # Splash: chuyển login/home
    │   │
    │   ├── (tabs)/                     # ⭐ Bottom Tab Group
    │   │   ├── _layout.tsx             # TabBar config (4 tab)
    │   │   ├── home/
    │   │   │   └── index.tsx
    │   │   ├── missions/
    │   │   │   └── index.tsx
    │   │   ├── tree/
    │   │   │   └── index.tsx
    │   │   └── profile/
    │   │       └── index.tsx
    │   │
    │   ├── logs/                       # ĐỂ NGOÀI TABS (Modal/Full screen)
    │   │   ├── index.tsx               # Chọn loại log
    │   │   ├── glucose.tsx
    │   │   ├── blood-pressure.tsx
    │   │   └── medication.tsx
    │   │
    │   ├── login/
    │   │   └── index.tsx
    │   │
    │   └── settings/
    │       └── index.tsx
    │
    ├── src/
    │   ├── ui-kit/                     # ✨ SKU hoá UI Template
    │   │   ├── H1SectionHeader.tsx
    │   │   ├── H2HeroBanner.tsx
    │   │   ├── M1MetricCard.tsx
    │   │   ├── C1TrendChart.tsx
    │   │   ├── T1ProgressRing.tsx
    │   │   ├── L1ListItem.tsx
    │   │   ├── F1ProfileSummary.tsx
    │   │   └── ... (đủ 24 SKU)
    │   │
    │   ├── components/                 # Atom & molecule
    │   │   ├── Button.tsx
    │   │   ├── TextInput.tsx
    │   │   ├── Card.tsx
    │   │   ├── SectionHeader.tsx
    │   │   ├── Avatar.tsx
    │   │   ├── ListItem.tsx
    │   │   ├── FloatingActionButton.tsx  # Log 1 chạm
    │   │   └── ...
    │   │
    │   ├── features/
    │   │   ├── auth/
    │   │   │   ├── auth.api.ts
    │   │   │   ├── auth.store.ts
    │   │   │   └── auth.dev-bypass.ts     # ENV-based login skip
    │   │   ├── home/
    │   │   │   └── home.vm.ts
    │   │   ├── missions/
    │   │   │   ├── missions.api.ts
    │   │   │   ├── missions.store.ts      # ⭐ Optimistic Update
    │   │   │   └── useMissionActions.ts
    │   │   ├── tree/
    │   │   │   ├── tree.api.ts
    │   │   │   └── tree.store.ts
    │   │   ├── logs/
    │   │   │   ├── logs.api.ts
    │   │   │   └── logs.store.ts
    │   │   ├── profile/
    │   │   │   ├── profile.api.ts
    │   │   │   └── profile.store.ts
    │   │   └── app-config/
    │   │       ├── flags.api.ts
    │   │       └── flags.store.ts
    │   │
    │   ├── lib/
    │   │   ├── apiClient.ts
    │   │   ├── env.ts
    │   │   ├── storage.ts
    │   │   ├── navigation.ts
    │   │   └── utils.ts
    │   │
    │   ├── providers/
    │   │   ├── SessionProvider.tsx
    │   │   └── QueryProvider.tsx
    │   │
    │   ├── styles/
    │   │   ├── theme.ts
    │   │   └── index.ts
    │   │
    │   └── template/legacy-ui/          # Template raw (tham khảo)
    │
    ├── app.json
    ├── package.json
    ├── tsconfig.json
    ├── eas.json
    └── README.md
4. Logic tính năng (chi tiết thực thi)
4.1. Auth (giữ nguyên, không sửa Backend)
POST /api/mobile/auth/login

GET /api/mobile/profile

POST /api/mobile/auth/logout (nếu có)

auth.dev-bypass.ts dùng ENV:

EXPO_PUBLIC_DEV_BYPASS_AUTH=1

Tạo profile giả đúng shape API thật.

4.2. Logs (One-Thumb Logging + Tags cho AI)
Ghi chỉ số quan trọng nhất của Asinu.

FAB Quick Log (trong Home):

3 nút lớn:

Glucose

Blood Pressure

Medication

Bấm mở Modal → nhập nhanh.

Tags ngữ cảnh:
Ví dụ glucose:
[Trước ăn] [Sau ăn] [Vừa ngủ dậy] [Đang mệt]

Payload gửi:

json
Sao chép mã
{
  "type": "glucose",
  "value": 180,
  "tags": ["sau ăn"],
  "note": ""
}
4.3. Missions (Optimistic Update)
Toggle "complete mission" đổi màu ngay → UI nhanh.

Gửi API sau.

Nếu lỗi → rollback.

4.4. Life Tree
GET /api/mobile/tree – điểm hôm nay

GET /api/mobile/tree/history?range=7|30

UI: Progress ring + Trend chart

4.5. Home Dashboard
Hero

Quick Log

3 Missions gần nhất

Life Tree summary

5. Feature Flag
Flag	Mặc định	Mục đích
FEATURE_MOOD_TRACKER	false	UI có sẵn nhưng ẩn
FEATURE_JOURNAL	false	ẩn
FEATURE_AUDIO	false	ẩn
FEATURE_DAILY_CHECKIN	false	ẩn
FEATURE_AI_FEED	false	để phase sau
FEATURE_AI_CHAT	false	để phase sau

6. Definition of Done (MVP)
Login → Home → Log → Missions → Tree → Profile → Settings flow không crash.

Tất cả API /api/mobile/* chạy thật.

FAB Quick Log hoạt động mượt (modal).

Mission completion = Optimistic.

Logs có tag ngữ cảnh.

Tất cả UI template vào ui-kit hoặc (experimental), không xóa nhầm.

Không import bất kỳ file nào từ src/ trực tiếp vào mobile.

7. Triển khai (dành cho Codex Cloud)
Tạo thư mục apps/asinu-lite bằng template Expo.

Dựng Router theo cấu trúc (tabs) như trên.

Import toàn bộ template UI vào ui-kit & components.

Implement 5 tính năng MVP.

Kết nối API thật.

Commit theo từng bước nhỏ → PR rõ ràng.

8. Ghi chú cuối
App này là Greenfield, sạch, dễ build.
Backend là Core Asset, không đụng.
Luồng này cho phép:

Build nhanh,

Dễ kiểm thử,

Không phá backend,

Không rối như bản cũ.

END OF FILE
