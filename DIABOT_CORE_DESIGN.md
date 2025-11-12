📄 DIABOT_AI_MEAL_TIP_CORE_SPEC.md
0) Mục tiêu

Một tài liệu “linh hồn AI” duy nhất cho DIABOT: thống nhất triết lý, trải nghiệm, quy tắc AI, dữ liệu cần nạp (warehouse nội bộ), event chuẩn, API contract, KPI, và quy định an toàn.

1) Triết lý

Ăn uống bình thường nhất có thể, chỉ tinh chỉnh nhẹ để kiểm soát đường huyết.

Phản hồi ≤800 ký tự, ngôn ngữ bạn bè – không phán xét.

Luôn có fallback an toàn khi thiếu dữ liệu/lỗi.

Tránh tuyệt đối từ ngữ QC cấm: “chữa khỏi”, “thần dược”, “100%”, “khỏi hẳn”, “điều trị”, “đặc trị”.

2) Kiến trúc lớp (tinh gọn)

Event Layer: meal.logged, tip.shown, tip.applied, user.corrected, preference.changed, consent.updated.
Trường tối thiểu: schema_version, request_id, timestamp, user_id (ẩn danh), payload (gọn, không PII).

Profile & Preferences: Persona (Bạn bè/HLV/Cố vấn), chế độ “ít hỏi” vs “hướng dẫn kỹ”, khẩu vị/không ăn được/khung giờ.

Rules Engine (MVP): giảm carb khi cao, thêm đạm khi thấp, ưu tiên chất béo tốt, kcal tối cao → chia nhỏ bữa.

Feature Layer (mở ML): tổng carb/protein/fat, % bữa tối, số bữa chiên, nước… theo ngày/tuần.

Model Gateway (tương lai): score.meal_risk, recommend.portion, recommend.swap (timeout → fallback).

Decision Orchestrator: gộp profile + features + rules/ML → tip cuối; luôn sanitize ≤800 + lọc từ cấm + gắn persona.

3) UX Flow (1 chạm xác nhận – ít hỏi)

Mở app → gợi ý 2–3 lựa chọn theo giờ + thói quen → 1 chạm xác nhận.

Thiếu log hôm qua → hỏi 1 câu ngắn + 2 lựa chọn sẵn.

Tip cấu trúc: (1) tóm tắt bữa, (2) 2 gợi ý nhỏ, (3) chốt êm động viên (≤800 ký tự).

Persona đổi được tức thời (friend/coach/advisor).

4) Data & Privacy

Data contracts versioned, PII tối thiểu.

Consent: bật/tắt dùng dữ liệu cho huấn luyện; có audit trail.

RLS: user chỉ xem được dữ liệu của mình.

5) KPI

TTFF (time-to-first-tip) <1s (p95).

1-tap apply rate ≥40%.

Edit-distance tip ↔ log giảm dần theo thời gian.

QC violations =0.

Stickiness: % user log ≥3 ngày/tuần.

6) Rollback & Safety

ML/gateway lỗi → fallback rule-based.

Dữ liệu rác → xử lý mặc định 0, vẫn trả tip.

Dấu hiệu nguy hiểm → nhắc an toàn (đo/đi khám) bằng ngôn ngữ nhẹ nhàng.

7) Rules Engine (ngưỡng đề xuất – MVP)

Carb cao: tổng ≥45g/bữa → bớt tinh bột nhanh, thêm rau/xơ.

Protein thấp: <15–20g/bữa → thêm cá/ức gà/đậu phụ/trứng.

Fat bão hòa cao: >20g hoặc món chiên/mỡ → chuyển chất béo tốt (hạt, cá, dầu oliu).

Kcal tối cao: >600 kcal → chia nhỏ bữa, ưu tiên rau + đạm nạc.

BG cao (nếu có log gần): ưu tiên low-carb + vận động nhẹ 10–15’.

8) API Contracts (MVP)
8.1 POST /api/ai/meal-tip

Input

{
  "items": [
    { "food": "cơm gạo lứt", "kcal": 180, "carb_g": 38, "protein_g": 4, "fat_g": 1 }
  ]
}


Output

{
  "tip": "string (≤800 chars, summary→2 suggestions→conclusion, QC-safe)",
  "meta": {
    "request_id": "uuid",
    "source": "rule-based",
    "length": 220,
    "time": "2025-01-01T12:00:00Z"
  }
}


Yêu cầu: cắt ≤800, lọc từ cấm; lỗi → trả fallback tip (200).

8.2 GET /api/meal/suggest?userId=...&mealType=optional (không LLM)

Output: 3 quick options, 1 copy-yesterday, 1 custom
Mỗi option: { description, portion_estimate, confidence, adjustment_note }

Latency mục tiêu: <200ms, cache 15 phút theo user.

8.3 POST /api/meal/feedback

Input: thông tin bữa vừa log (server đã có).

Output: 3 câu (tóm tắt → 1–2 tip → chốt êm) + gợi ý nước/vận động.

8.4 PUT /api/profile/personality

Body: { "ai_persona":"friend|coach|advisor", "guidance_level":"minimal|detailed" }

Lưu vào profiles.prefs, log event preference.changed.

9) Persona (copy text templates)

Friend: “mình – bạn”, ấm áp, khen trước, gợi ý nhẹ.

Coach: “tôi – bạn”, mục tiêu rõ, gợi ý thực tế.

Advisor: “tôi – anh/chị”, ngắn gọn, chuyên nghiệp.

Luôn tránh từ cấm QC; không phán xét.

10) Event Layer — Schema chuẩn (Postgres)

Bảng: public.analytics_events

id uuid pk default gen_random_uuid()

event_type text not null

schema_version int not null default 1

request_id uuid not null

user_id uuid references public.profiles(id) on delete cascade

payload jsonb (gọn, không PII)

created_at timestamptz default now()

Event types:
meal.logged, tip.shown, tip.applied, user.corrected, preference.changed, consent.updated.

RLS

Enable RLS.

SELECT: auth.uid() = user_id

INSERT: auth.uid() = user_id

11) Data Intake Fields — Postgres (chuẩn hóa để nạp)
11.1 public.meal_logs (bổ sung, không phá cũ)

id uuid pk

user_id uuid (RLS is_self)

items jsonb (danh sách món, tên + ước lượng)

kcal numeric

carb_g numeric

protein_g numeric (NEW)

fat_g numeric (NEW)

meal_type text (NEW) — enum: breakfast|lunch|dinner|snack

cooking_method text (NEW) — ví dụ: fried|steamed|boiled|grilled|raw

created_at timestamptz default now()

RLS: user chỉ thấy bản ghi của mình.

11.2 public.bg_logs (đang có)

Đảm bảo có: value_mgdl numeric, taken_at timestamptz, user_id.

11.3 public.profiles

id uuid pk

prefs jsonb (giữ dạng JSONB, thêm schema gợi ý)
Gợi ý cấu trúc:

{
  "ai_persona": "friend|coach|advisor",
  "guidance_level": "minimal|detailed",
  "favorite_meals": ["..."],
  "allergies": ["..."],
  "budget_level": "low|mid|high",
  "meal_times": { "breakfast":"07:30", "lunch":"12:00", "dinner":"19:00" },
  "low_ask_mode": true
}

11.4 Feature Store (chuẩn bị ML)

Bảng: public.user_meal_patterns

user_id uuid, meal_type text, dish text, portion_avg numeric, freq_7d int, updated_at timestamptz

Bảng: public.user_daily_features

user_id uuid, date date,

carb_g_total numeric, protein_g_total numeric, fat_g_total numeric,

dinner_pct numeric, late_meal_count int,

fried_count int, steamed_count int,

water_ml numeric, water_target_pct numeric,

updated_at timestamptz

Bảng: public.user_habit_scores

user_id uuid, date date, cluster text (vd: carb-heavy, late-night, fried-prefer), score numeric, updated_at timestamptz

RLS: tất cả theo auth.uid() = user_id.

12) QC & Validation

Forbidden words filter cho mọi tip: “chữa khỏi|thần dược|100%|khỏi hẳn|điều trị|đặc trị”.

Length guard: cắt ≤800 ký tự, ưu tiên 3–4 câu ngắn.

Tone guard: trung lập tích cực, không phán xét/đe dọa.

Safety guard: nếu pattern hạ/tăng đường huyết bất thường → nhắc an toàn.

13) Roadmap triển khai

P0 (MVP)

Postgres: analytics_events + bổ sung cột meal_logs (protein_g, fat_g, meal_type, cooking_method).

API /api/ai/meal-tip (rule-based + sanitize + fallback).

QuickMealEntry + MealFeedbackCard (UI).

P1

Feature Store: user_meal_patterns, user_daily_features, user_habit_scores; ETL daily.

Persona switch + “ít hỏi”.

Auto-suggest + missing log detection.

P2

Structured tip display polish; fallback tests; Model gateway mở ML.

14) Acceptance (DoD/QA)

AI-TIP-200: /api/ai/meal-tip trả 200, có tip non-empty.

AI-TIP-LEN: len(tip) ≤ 800.

AI-TIP-QC: không chứa từ cấm QC.

AI-TIP-LOGS: logs chỉ {request_id, source} – không payload/PII.

EVENT: ghi tip.shown & tip.applied đúng RLS.

UX: Quick 1-tap; thiếu log → hỏi 1 câu + 2 lựa chọn; tip có 3 phần.
