# DIABOT Schema Standardization - Quick Start

**Date**: 2025-10-07
**Status**: ✅ Documentation Complete, Ready for Database Application

---

## 📚 DOCUMENTS CREATED

| File | Size | Purpose |
|------|------|---------|
| `SCHEMA_STANDARDIZATION.md` | 18KB | Complete DDL statements and schema details |
| `DEPLOYMENT_VIETTEL_STORAGE.md` | 6.9KB | Viettel Object Storage configuration guide |
| `STANDARDIZATION_SUMMARY.md` | 12KB | Executive summary and deployment checklist |
| `QUICK_START_SCHEMA.md` | This file | Quick reference guide |

---

## ⚡ QUICK START - 3 STEPS

### Step 1: Apply Database Schema

Open a Postgres SQL session (psql or any client) and execute sections from `SCHEMA_STANDARDIZATION.md`:

```bash
# Priority order:
1. Section 1️⃣ - Core Storage Fields (meal_logs.image_url, profiles.avatar_url)
2. Section 2️⃣ - OTP Authentication (phone_verified, otp_last_verified_at)
3. Section 3️⃣ - AI Profile Extensions (persona, plan_tier, etc.)
4. Sections 4-8 - AI Tables (when needed, all have RLS enabled)
5. Section 9 - Storage Helper Function
```

### Step 2: Install Storage SDK

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### Step 3: Verify Configuration

```bash
# Check environment
cat .env.production | grep STORAGE_PROVIDER
# Expected: STORAGE_PROVIDER=viettel

# Run type check
npm run typecheck

# Test upload (after implementing ViettelS3Client)
curl -X POST http://localhost:3000/api/upload/image \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@test.jpg"
```

---

## 🔑 KEY CONFIGURATIONS

### Viettel Storage (Already Configured)
```bash
STORAGE_PROVIDER=viettel
S3_ENDPOINT=https://s3-north1.viettelidc.com.vn
S3_REGION=vn-1
S3_BUCKET=diabot-prod
S3_ACCESS_KEY=00df2058200293e0e7db
S3_SECRET_KEY=vkzYc6d1nSJvsp6TTMzdJZ1K0Lpi+eNvK4v6Jw7m
S3_FORCE_PATH_STYLE=true
S3_SIGNATURE_VERSION=s3v4
```

### Storage Paths
```
Meal: meal/{user_id}/{yyyy}/{mm}/{dd}/{uuid}.{ext}
Avatar: avatars/{user_id}.{ext}
Voice: voice/{user_id}/{yyyy}/{mm}/{uuid}.{ext}
```

---

## 📋 WHAT'S INCLUDED

### Core Storage (Immediate Use)
- ✅ meal_logs.image_url - Store Viettel S3 URLs
- ✅ profiles.avatar_url - User profile pictures
- ✅ Storage path generator function

### OTP Authentication (Ready)
- ✅ profiles.phone_verified - SMS verification status
- ✅ profiles.otp_last_verified_at - Verification timestamp
- ✅ Unique phone constraint

### AI Profile Extensions (Post-MVP Ready)
- ✅ persona (friend/coach/caregiver)
- ✅ plan_tier (free/premium/family)
- ✅ ai_chat_model (nano/mini/turbo)
- ✅ feature_flags (jsonb per-user config)
- ✅ ai_budget_vnd, ai_tokens_month (cost tracking)

### AI Tables (9 Tables, All with RLS)
- family_groups, relatives (family collaboration)
- ai_meal_tips (meal suggestions)
- ai_chat_sessions, ai_chat_messages (conversational AI)
- ai_factchecks (information verification)
- qc_safety_logs (content moderation)
- ai_nudges (smart reminders)
- ai_voice_logs (voice input)
- ai_reports (generated reports)

---

## 🎯 FEATURE FLAGS (All OFF by Default)

Add to `.env.production`:
```bash
AI_FAMILY_ENABLED=false
AI_MEAL_TIPS_ENABLED=false
AI_CHAT_ENABLED=false
AI_NUDGES_ENABLED=false
# AI_VOICE_ENABLED=false (already set)
```

Enable incrementally as features are implemented.

---

## ✅ VERIFICATION COMMANDS

### Check Schema Applied
```sql
-- Run in Postgres (psql / client)

-- Verify new columns exist
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('profiles', 'meal_logs')
AND column_name IN ('image_url', 'avatar_url', 'phone_verified', 'persona', 'plan_tier')
ORDER BY table_name, column_name;
-- Expected: 6 rows

-- Verify AI tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND (table_name LIKE 'ai_%' OR table_name IN ('family_groups', 'relatives'))
ORDER BY table_name;
-- Expected: 10 tables

-- Test storage path function
SELECT public.generate_storage_path('meal', gen_random_uuid(), 'jpg');
-- Expected: meal/{uuid}/2025/10/07/{uuid}.jpg
```

### Check Environment
```bash
# Verify Viettel config
node -e "require('dotenv').config({path:'.env.production'}); console.log('Provider:', process.env.STORAGE_PROVIDER, '\nBucket:', process.env.S3_BUCKET)"

# Expected:
# Provider: viettel
# Bucket: diabot-prod
```

---

## 🚨 IMPORTANT REMINDERS

### Data Safety
- ✅ All changes are **backward compatible**
- ✅ No data migration required (FRESH start)
- ✅ Existing functionality unaffected
- ✅ All new fields are nullable

### Security
- ✅ RLS enabled on all tables
- ✅ Production credentials in `.env.production`
- ⚠️ **NEVER commit `.env.production` to git**
- ✅ All AI features default to OFF

### Cost Management
- Viettel Storage: ~$0.03/GB/month
- Default AI budget: 50,000 VND/user/month
- Token usage auto-resets monthly

---

## 📞 NEXT ACTIONS

### Immediate (Today)
1. [ ] Review `SCHEMA_STANDARDIZATION.md` sections 1-3
2. [ ] Apply core schema changes (storage + OTP)
3. [ ] Verify with SQL queries above

### Short Term (This Week)
4. [ ] Install AWS SDK packages
5. [ ] Implement ViettelS3Client upload method
6. [ ] Test image upload to Viettel S3

### Medium Term (Next 2 Weeks)
7. [ ] Apply AI table schemas (sections 4-8)
8. [ ] Update TypeScript types
9. [ ] Enable meal tips feature flag
10. [ ] Monitor storage costs

---

## 📖 FULL DOCUMENTATION

For complete details, refer to:
- **Schema DDL**: `SCHEMA_STANDARDIZATION.md`
- **Storage Guide**: `DEPLOYMENT_VIETTEL_STORAGE.md`
- **Deployment Plan**: `STANDARDIZATION_SUMMARY.md`

---

**Status**: Ready for deployment
**Last Updated**: 2025-10-07
**Document Owner**: DIABOT Team
