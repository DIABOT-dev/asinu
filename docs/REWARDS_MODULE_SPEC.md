# Rewards & Ladder Module — Planning Spec (MVP v1)

**Status:** Implemented behind flags (`REWARDS_ENABLED = false`, `DONATION_ENABLED = false` by default)  
**Scope:** Sprint 3 – Rewards catalog + Donate APIs + UI, currently soaking behind QA freeze.

---

## 1. Goals
- Cho phép người dùng tích lũy `HEALTH_POINTS` (đã chạy qua Life Tree) và thấy các mốc seeding.
- Thiết kế cửa hàng quà tặng (catalog + offers) với khả năng bật/tắt theo từng môi trường.
- Ghi lại mọi lượt đổi quà bằng ledger riêng, đảm bảo audit/rollback được.
- Chuẩn bị JSON config để mở rộng (CSR campaign, đối tác).

Không release ngay; chỉ dựng schema + API contract + test plan.

---

## 2. Data Model (migration skeleton `116_rewards_catalog.sql`)

```
catalog_items (
  id uuid pk,
  title text,
  subtitle text,
  type text check (voucher|cosmetic|physical|donation),
  cost int,
  inventory int,
  metadata jsonb,
  active boolean,
  created_at timestamptz
)

reward_offers (
  id uuid pk,
  item_id fk→catalog_items,
  segment text,
  starts_at timestamptz,
  ends_at timestamptz,
  min_points int,
  limits jsonb,
  active boolean
)

reward_redemptions (
  id uuid pk,
  user_id fk→app_user,
  item_id fk→catalog_items,
  cost int,
  status text (pending|fulfilled|failed|void),
  voucher_code text,
  metadata jsonb,
  created_at timestamptz,
  fulfilled_at timestamptz
)

seeding_rules (
  id uuid pk,
  ladder jsonb,            -- [{threshold: 3, message:"..."}, ...]
  active boolean,
  created_at timestamptz
)

vp_ledger (
  id uuid pk,
  user_id uuid fk→app_user,
  delta int,
  reason text,
  metadata jsonb,
  idempotency_key text unique,
  created_at timestamptz
)

vp_balances (
  user_id uuid pk,
  balance int,
  updated_at timestamptz
)

donation_log (
  id uuid pk,
  user_id uuid,
  provider text,
  amount_points int,
  amount_vnd int,
  campaign text,
  status text,
  metadata jsonb,
  created_at timestamptz
)
```

RLS sẽ reuse `app_user` policies (user_id = current_setting).

---

## 3. API Contract (server → client)

| Endpoint | Method | Description | Flag |
|----------|--------|-------------|------|
| `/api/rewards/catalog` | GET | Trả danh sách item + offer active | `TREE_ENABLED && REWARDS_ENABLED` |
| `/api/rewards/ladders` | GET | Trả seeding ladder (3→10→80…) | same |
| `/api/rewards/redeem` | POST | Body `{ item_id }` → ghi redemption pending, trả mã voucher (nếu có) | same |
| `/api/rewards/redemptions` | GET | Lịch sử đổi quà của user | same |

Tất cả route trả 404 khi flag OFF (sử dụng `featureGate`).

---

## 4. Frontend plan (later)
- Component `RewardsShelf` (grid catalog) – hiển thị cost, CTA disabled nếu điểm không đủ.
- `LadderPanel` – badges + progress bar, reuse Life Tree card design.
- `RedemptionHistoryDrawer` – list + status chip.
- Tất cả ẩn khi `REWARDS_ENABLED` false.

---

## 5. Test Plan (pre-coding checklist)
- Unit: points deduction logic (no negative balance), redemption status transitions.
- API integration (Vitest + supertest) – ensure 404 when flag OFF, 200 when ON.
- Migration smoke: `psql -f migrations/116_rewards_catalog.sql` on empty DB.
- Seed script for demo data (3 items, 1 offer).

---

## 6. Tracking & follow-up
- Issue #? “Implement Rewards Sprint 3” – tách PR:
  1. Schema + DAL + feature flag gating.
  2. API routes + tests.
  3. UI surfaces.

Until then, user vẫn tích HEALTH_POINTS trong ledger, chờ ngày bật `REWARDS_ENABLED`.
