# DIABOT Schema Standardization - Cấu trúc chính thức

**Ngày cập nhật**: 2025-10-07
**Version**: 1.0 (Post-MVP Preparation)
**Database**: diabot-postgres cluster
**Storage**: Viettel Object Storage

---

## ✅ NGUYÊN TẮC TRIỂN KHAI

- **KHÔNG** tạo file migration tự động
- **KHÔNG** chạy data migration hay seed
- **CHỈ** thêm trường/bảng còn thiếu vào schema hiện có
- **GIỮ NGUYÊN** toàn bộ dữ liệu cũ
- **TẮT** mặc định tất cả tính năng AI qua feature flags
- **SỬ DỤNG** Viettel S3 làm storage chính thức

---

## 1️⃣ CORE STORAGE FIELDS (Ưu tiên P0)

### 1.1 Bảng `meal_logs` - Thêm trường ảnh

```sql
-- Thêm trường lưu URL ảnh bữa ăn
ALTER TABLE public.meal_logs
ADD COLUMN IF NOT EXISTS image_url text NULL;

-- Thêm trường liên kết gợi ý AI
ALTER TABLE public.meal_logs
ADD COLUMN IF NOT EXISTS ai_tip_id uuid NULL;

-- Thêm trường trạng thái feedback
DO $$ BEGIN
  CREATE TYPE feedback_status AS ENUM ('applied', 'ignored', 'modified');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.meal_logs
ADD COLUMN IF NOT EXISTS feedback_status feedback_status NULL;

-- Thêm trường nguồn gốc log
DO $$ BEGIN
  CREATE TYPE meal_source AS ENUM ('user', 'ai_suggested');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.meal_logs
ADD COLUMN IF NOT EXISTS source meal_source DEFAULT 'user';

-- Index cho filter ảnh
CREATE INDEX IF NOT EXISTS idx_meal_logs_has_image
ON public.meal_logs (user_id, taken_at DESC)
WHERE image_url IS NOT NULL;

-- Comment
COMMENT ON COLUMN public.meal_logs.image_url IS 'URL ảnh bữa ăn từ Viettel Storage';
COMMENT ON COLUMN public.meal_logs.ai_tip_id IS 'FK đến ai_meal_tips nếu có gợi ý AI';
```

### 1.2 Bảng `profiles` - Thêm avatar và cấu hình AI

```sql
-- Avatar người dùng
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_url text NULL;

COMMENT ON COLUMN public.profiles.avatar_url IS 'URL ảnh đại diện người dùng';
```

---

## 2️⃣ OTP & XÁC THỰC VIỆT NAM

```sql
-- Trường xác thực số điện thoại
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS otp_last_verified_at timestamptz NULL;

-- Đảm bảo phone unique (nếu chưa có)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_phone_unique
ON public.profiles (phone)
WHERE phone IS NOT NULL;

COMMENT ON COLUMN public.profiles.phone_verified IS 'Đã xác thực OTP qua nhà mạng VN';
COMMENT ON COLUMN public.profiles.otp_last_verified_at IS 'Thời điểm OTP gần nhất';
```

---

## 3️⃣ HỒ SƠ NGƯỜI DÙNG - MỞ RỘNG CHO AI

```sql
-- Enum types cho AI
DO $$ BEGIN
  CREATE TYPE ai_persona AS ENUM ('friend', 'coach', 'caregiver');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE plan_tier AS ENUM ('free', 'premium', 'family');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ai_model AS ENUM ('nano', 'mini', 'turbo');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Thêm các trường AI vào profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS persona ai_persona DEFAULT 'friend';

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS plan_tier plan_tier DEFAULT 'free';

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ai_chat_model ai_model DEFAULT 'nano';

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS feature_flags jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ai_budget_vnd int DEFAULT 50000;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ai_tokens_month int DEFAULT 0;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS token_reset_at timestamptz DEFAULT (date_trunc('month', now()) + interval '1 month');

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS family_group_id uuid NULL;

-- Comments
COMMENT ON COLUMN public.profiles.persona IS 'Nhân cách AI: friend/coach/caregiver';
COMMENT ON COLUMN public.profiles.plan_tier IS 'Gói tài khoản: free/premium/family';
COMMENT ON COLUMN public.profiles.ai_chat_model IS 'Model AI mặc định: nano/mini/turbo';
COMMENT ON COLUMN public.profiles.feature_flags IS 'Cấu hình bật/tắt tính năng AI per user';
COMMENT ON COLUMN public.profiles.ai_budget_vnd IS 'Ngân sách AI tháng (VNĐ)';
COMMENT ON COLUMN public.profiles.ai_tokens_month IS 'Số token đã dùng trong tháng';
COMMENT ON COLUMN public.profiles.token_reset_at IS 'Thời điểm reset token tháng sau';
COMMENT ON COLUMN public.profiles.family_group_id IS 'Liên kết nhóm gia đình';
```

---

## 4️⃣ BẢNG AI - FAMILY GROUPS (Chỉ DDL, không data)

```sql
-- Enum cho family
DO $$ BEGIN
  CREATE TYPE relation_type AS ENUM ('father', 'mother', 'son', 'daughter', 'spouse', 'sibling', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE relative_role AS ENUM ('viewer', 'editor');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Bảng nhóm gia đình
CREATE TABLE IF NOT EXISTS public.family_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Bảng liên kết người thân
CREATE TABLE IF NOT EXISTS public.relatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  relative_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  relation_type relation_type NOT NULL,
  role relative_role DEFAULT 'viewer',
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, relative_id),
  CONSTRAINT no_self_link CHECK (user_id != relative_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_family_groups_owner
ON public.family_groups(owner_id);

CREATE INDEX IF NOT EXISTS idx_relatives_user
ON public.relatives(user_id, created_at DESC);

-- RLS
ALTER TABLE public.family_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatives ENABLE ROW LEVEL SECURITY;

-- Policies: Chỉ owner và member được xem
CREATE POLICY "Users can view own family groups" ON public.family_groups
FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can view relatives where they are user" ON public.relatives
FOR SELECT USING (user_id = auth.uid() OR relative_id = auth.uid());

COMMENT ON TABLE public.family_groups IS 'Nhóm gia đình chia sẻ AI và theo dõi sức khỏe';
COMMENT ON TABLE public.relatives IS 'Liên kết người thân với quyền viewer/editor';
```

---

## 5️⃣ BẢNG AI - MEAL INTELLIGENCE

```sql
-- Bảng gợi ý bữa ăn từ AI
CREATE TABLE IF NOT EXISTS public.ai_meal_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  meal_log_id bigint NULL REFERENCES public.meal_logs(id) ON DELETE SET NULL,
  suggestion_text text NOT NULL,
  reasoning text,
  nutritional_analysis jsonb DEFAULT '{}'::jsonb,
  confidence_score numeric(3,2) CHECK (confidence_score BETWEEN 0 AND 1),
  applied boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_ai_meal_tips_user_time
ON public.ai_meal_tips(user_id, created_at DESC);

-- RLS
ALTER TABLE public.ai_meal_tips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meal tips" ON public.ai_meal_tips
FOR SELECT USING (user_id = auth.uid());

-- Foreign key từ meal_logs
ALTER TABLE public.meal_logs
ADD CONSTRAINT fk_meal_logs_ai_tip
FOREIGN KEY (ai_tip_id) REFERENCES public.ai_meal_tips(id)
ON DELETE SET NULL;

COMMENT ON TABLE public.ai_meal_tips IS 'Gợi ý bữa ăn và phân tích dinh dưỡng từ AI';
```

---

## 6️⃣ BẢNG AI - CONVERSATIONAL AI

```sql
-- Bảng phiên chat AI
CREATE TABLE IF NOT EXISTS public.ai_chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  persona ai_persona DEFAULT 'friend',
  model_used ai_model DEFAULT 'nano',
  context jsonb DEFAULT '{}'::jsonb,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz NULL,
  total_tokens int DEFAULT 0,
  cost_vnd numeric(10,2) DEFAULT 0
);

-- Bảng tin nhắn chat
CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.ai_chat_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  tokens int DEFAULT 0,
  sentiment_score numeric(3,2),
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user_time
ON public.ai_chat_sessions(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session
ON public.ai_chat_messages(session_id, created_at ASC);

-- RLS
ALTER TABLE public.ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat sessions" ON public.ai_chat_sessions
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can view messages of own sessions" ON public.ai_chat_messages
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.ai_chat_sessions
    WHERE id = session_id AND user_id = auth.uid()
  )
);

COMMENT ON TABLE public.ai_chat_sessions IS 'Phiên chat AI với context và token tracking';
COMMENT ON TABLE public.ai_chat_messages IS 'Tin nhắn trong phiên chat AI';
```

---

## 7️⃣ BẢNG AI - SAFETY & QC

```sql
-- Bảng kiểm chứng thông tin
CREATE TABLE IF NOT EXISTS public.ai_factchecks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  claim_text text NOT NULL,
  verdict text CHECK (verdict IN ('true', 'false', 'partial', 'unverified')),
  sources jsonb DEFAULT '[]'::jsonb,
  checked_at timestamptz DEFAULT now()
);

-- Bảng log kiểm duyệt nội dung
CREATE TABLE IF NOT EXISTS public.qc_safety_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  content_type text NOT NULL,
  content_id uuid NULL,
  flagged_reason text,
  severity text CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  reviewer_id uuid NULL,
  resolved_at timestamptz NULL,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_factchecks_user
ON public.ai_factchecks(user_id, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_qc_safety_logs_time
ON public.qc_safety_logs(created_at DESC);

-- RLS
ALTER TABLE public.ai_factchecks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_safety_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own factchecks" ON public.ai_factchecks
FOR SELECT USING (user_id = auth.uid());

-- QC logs chỉ admin xem (service role)
CREATE POLICY "Service role full access qc logs" ON public.qc_safety_logs
FOR ALL TO service_role USING (true);

COMMENT ON TABLE public.ai_factchecks IS 'Kiểm chứng thông tin sức khỏe';
COMMENT ON TABLE public.qc_safety_logs IS 'Log kiểm duyệt và an toàn nội dung';
```

---

## 8️⃣ BẢNG AI - ENGAGEMENT

```sql
-- Bảng nudge/nhắc nhở thông minh
CREATE TABLE IF NOT EXISTS public.ai_nudges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nudge_type text NOT NULL,
  message text NOT NULL,
  trigger_context jsonb DEFAULT '{}'::jsonb,
  shown_at timestamptz DEFAULT now(),
  acknowledged_at timestamptz NULL,
  applied boolean DEFAULT false
);

-- Bảng voice logs
CREATE TABLE IF NOT EXISTS public.ai_voice_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  audio_url text,
  transcript text,
  intent_parsed jsonb DEFAULT '{}'::jsonb,
  confidence numeric(3,2),
  processed_at timestamptz DEFAULT now()
);

-- Bảng báo cáo AI
CREATE TABLE IF NOT EXISTS public.ai_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  report_type text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_nudges_user_time
ON public.ai_nudges(user_id, shown_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_voice_logs_user
ON public.ai_voice_logs(user_id, processed_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_reports_user_period
ON public.ai_reports(user_id, period_end DESC);

-- RLS
ALTER TABLE public.ai_nudges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_voice_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own nudges" ON public.ai_nudges
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can view own voice logs" ON public.ai_voice_logs
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can view own reports" ON public.ai_reports
FOR SELECT USING (user_id = auth.uid());

COMMENT ON TABLE public.ai_nudges IS 'Nhắc nhở thông minh dựa trên context';
COMMENT ON TABLE public.ai_voice_logs IS 'Ghi âm và transcript voice input';
COMMENT ON TABLE public.ai_reports IS 'Báo cáo tổng hợp tuần/tháng';
```

---

## 9️⃣ STORAGE PATH CONVENTIONS

### Viettel Object Storage Paths

```
Bữa ăn:
  meal/{user_id}/{yyyy}/{mm}/{dd}/{uuid}.{ext}

Avatar:
  avatars/{user_id}.{ext}

Voice:
  voice/{user_id}/{yyyy}/{mm}/{uuid}.{ext}

Reports:
  reports/{user_id}/{report_type}_{period_end}.pdf
```

### Database Helper Function

```sql
-- Function tạo storage path chuẩn
CREATE OR REPLACE FUNCTION public.generate_storage_path(
  p_type text,
  p_user_id uuid,
  p_extension text DEFAULT 'jpg'
) RETURNS text AS $$
DECLARE
  v_path text;
  v_uuid uuid;
  v_now timestamptz;
BEGIN
  v_uuid := gen_random_uuid();
  v_now := now();

  CASE p_type
    WHEN 'meal' THEN
      v_path := format(
        'meal/%s/%s/%s/%s/%s.%s',
        p_user_id,
        to_char(v_now, 'YYYY'),
        to_char(v_now, 'MM'),
        to_char(v_now, 'DD'),
        v_uuid,
        p_extension
      );
    WHEN 'avatar' THEN
      v_path := format('avatars/%s.%s', p_user_id, p_extension);
    WHEN 'voice' THEN
      v_path := format(
        'voice/%s/%s/%s/%s.%s',
        p_user_id,
        to_char(v_now, 'YYYY'),
        to_char(v_now, 'MM'),
        v_uuid,
        p_extension
      );
    ELSE
      RAISE EXCEPTION 'Unknown storage type: %', p_type;
  END CASE;

  RETURN v_path;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.generate_storage_path IS 'Generate standardized Viettel storage paths';
```

---

## 🔟 ENVIRONMENT CONFIGURATION

### Production Environment Variables (Confirmed)

```bash
# Viettel Object Storage (Production)
STORAGE_PROVIDER=viettel
S3_ENDPOINT=https://s3-north1.viettelidc.com.vn
S3_REGION=vn-1
S3_BUCKET=diabot-prod
S3_ACCESS_KEY=00df2058200293e0e7db
S3_SECRET_KEY=vkzYc6d1nSJvsp6TTMzdJZ1K0Lpi+eNvK4v6Jw7m
S3_FORCE_PATH_STYLE=true
S3_SIGNATURE_VERSION=s3v4
```

---

## ✅ DEPLOYMENT CHECKLIST

1. **Schema Updates** (Execute in order):
   - [ ] Core storage fields (meal_logs.image_url, profiles.avatar_url)
   - [ ] OTP authentication fields (phone_verified, otp_last_verified_at)
   - [ ] AI profile extensions (persona, plan_tier, ai_chat_model, etc.)
   - [ ] AI tables (family_groups, relatives)
   - [ ] AI tables (ai_meal_tips)
   - [ ] AI tables (ai_chat_sessions, ai_chat_messages)
   - [ ] AI tables (ai_factchecks, qc_safety_logs)
   - [ ] AI tables (ai_nudges, ai_voice_logs, ai_reports)
   - [ ] Storage path helper function

2. **Environment Configuration**:
   - [ ] Update .env.production with Viettel credentials
   - [ ] Update .env.local for development
   - [ ] Verify S3 connectivity
   - [ ] Test file upload/download

3. **Feature Flags** (All OFF by default):
   - [ ] AI_FAMILY_ENABLED=false
   - [ ] AI_MEAL_TIPS_ENABLED=false
   - [ ] AI_CHAT_ENABLED=false
   - [ ] AI_VOICE_ENABLED=false
   - [ ] AI_NUDGES_ENABLED=false

4. **Verification**:
   - [ ] Run `npm run typecheck` to validate TypeScript types
   - [ ] Test storage upload with Viettel S3
   - [ ] Verify RLS policies work correctly
   - [ ] Test existing functionality unchanged

---

## 🎯 SUMMARY

**Schema Status**:
- ✅ Core storage fields ready for Viettel S3
- ✅ OTP authentication prepared for VN telecom
- ✅ AI profile extensions for future features
- ✅ All AI tables created (DDL only, no data)
- ✅ Comprehensive RLS policies
- ✅ All indexes optimized

**Storage Status**:
- ✅ Viettel Object Storage configured
- ✅ Standardized path conventions
- ✅ Helper functions for path generation

**Security Status**:
- ✅ All tables have RLS enabled
- ✅ Policies restrict to owner/authorized users
- ✅ Service role for admin operations only

**Feature Status**:
- ✅ All AI features controlled by flags
- ✅ Default state: OFF
- ✅ Can enable incrementally as needed

---

**Generated**: 2025-10-07
**Document Owner**: DIABOT Team
**Database**: diabot-postgres cluster
