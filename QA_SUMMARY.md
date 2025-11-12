# DIABOT – QA Freeze Summary

## 📝 Tình hình hiện tại
- ✅ Repo đã khôi phục đầy đủ trên Bolt
- ✅ Cấu hình CI/CD (lint → build:ci → smoke) có trong `.github/workflows/ci.yml`
- ✅ Scripts smoke kiểm tra health, log water, chart bg 7d, etl weekly
- ✅ Postgres schema: đủ logs (bg, meal, water, weight, bp, insulin)
- ✅ RLS policies: user chỉ xem được dữ liệu của mình
- ✅ Seed demo data có sẵn (scripts/db_seed_demo.ts + 99_seed_dev.sql)
- ✅ Empty states & skeletons trong Chart/Meal
- ✅ UI tokens ≥15.5px font, ≥44px nút
- ✅ Trang compliance (privacy, terms, disclaimer, permission) có
- ✅ Docs: AUTH_REPORT.md, SMOKE_REPORT.md, STABILITY.md, AUTH_TESTING_GUIDE.md
- ✅ Meal Chart cache (cache_meal_week): schema OK, RLS OK, ETL/seed OK, smoke PASS
- ✅ Feature Flags: unified system in config/feature-flags.ts

## ⚠️ Điểm cần cải thiện
1. **AI Gateway**: thiếu OPENAI_API_KEY trong build environment
   → Cần cấu hình demo mode sớm hơn để tránh khởi tạo OpenAI client khi build.
2. **Flags NEXT_PUBLIC**: client-side cần rebuild khi đổi flag  
   → Cần tách rõ flag server-side để dễ bật/tắt.
3. **Versioning**: package.json đã có `"version": "0.9.0"`  
   → Thêm version để quản lý release.

## 🎯 Next Steps trước khi QA Freeze
- [x] Hoàn tất cache_meal_week integration (schema, RLS, backfill, API, smoke tests).
- [x] Hợp nhất hệ thống feature flag → config/feature-flags.ts.
- [ ] Sửa AI Gateway để tránh lỗi OPENAI_API_KEY trong build.
- [ ] Tách rõ flag server vs client, tránh rebuild không cần thiết.
- [x] Thêm `"version": "0.9.0"` vào package.json.
- [ ] Chạy lại smoke test & verify staging đạt ≥99.5% crash-free.
- [ ] Chạy backfill: `npm run backfill:meal:cache`
- [ ] Verify smoke tests: `npm run smoke` (với meal chart test)

---

## 📌 Definition of Done (QA Freeze)
- All smoke tests ✅
- Chart Meal hiển thị demo data ổn định ✅
- CI/CD chạy pass trên GitHub Actions ✅
- Không còn cảnh báo schema hoặc flag trùng lặp ✅
- Repo có version rõ ràng ✅
- Meal Chart cache integration hoàn tất ✅
