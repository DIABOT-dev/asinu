BEGIN;

-- -------------------------------------------------------------------
-- Spendable Vitality Points ledger + balances
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asinu_app.vp_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES asinu_app.app_user(user_id) ON DELETE CASCADE,
  delta INT NOT NULL,
  reason TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vp_ledger_user ON asinu_app.vp_ledger(user_id, created_at DESC);

ALTER TABLE asinu_app.vp_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_vp_ledger_owner ON asinu_app.vp_ledger;
CREATE POLICY p_vp_ledger_owner ON asinu_app.vp_ledger
  FOR ALL
  USING (user_id::text = current_setting('asinu.user_id', true))
  WITH CHECK (user_id::text = current_setting('asinu.user_id', true));

CREATE TABLE IF NOT EXISTS asinu_app.vp_balances (
  user_id UUID PRIMARY KEY REFERENCES asinu_app.app_user(user_id) ON DELETE CASCADE,
  balance INT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE asinu_app.vp_balances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_vp_balances_owner ON asinu_app.vp_balances;
CREATE POLICY p_vp_balances_owner ON asinu_app.vp_balances
  FOR ALL
  USING (user_id::text = current_setting('asinu.user_id', true))
  WITH CHECK (user_id::text = current_setting('asinu.user_id', true));

-- -------------------------------------------------------------------
-- Donation log (records VNPay/MoMo pledges + point donations)
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asinu_app.donation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES asinu_app.app_user(user_id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  amount_points INT NOT NULL DEFAULT 0 CHECK (amount_points >= 0),
  amount_vnd INT NOT NULL DEFAULT 0 CHECK (amount_vnd >= 0),
  campaign TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'recorded',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_donation_log_user ON asinu_app.donation_log(user_id, created_at DESC);

ALTER TABLE asinu_app.donation_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_donation_log_owner ON asinu_app.donation_log;
CREATE POLICY p_donation_log_owner ON asinu_app.donation_log
  FOR ALL
  USING (user_id::text = current_setting('asinu.user_id', true))
  WITH CHECK (user_id::text = current_setting('asinu.user_id', true));

-- -------------------------------------------------------------------
-- Seed minimal catalog + ladder (idempotent)
-- -------------------------------------------------------------------
INSERT INTO asinu_app.catalog_items (id, title, subtitle, item_type, cost, inventory, metadata, active)
VALUES
  ('11111111-2222-4aaa-8888-000000000001', 'Voucher nước khoáng', 'Đối tác Sâm Việt Nam', 'voucher', 80, NULL, '{"badge":"Hydro Hero"}', true),
  ('11111111-2222-4aaa-8888-000000000002', 'Gói khám dinh dưỡng', 'Tư vấn trực tuyến 15 phút', 'physical', 120, 25, '{"provider":"Anora Care"}', true),
  ('11111111-2222-4aaa-8888-000000000003', 'Ủng hộ bệnh nhi', 'Chuyển 100.000đ tới Quỹ Đường', 'donation', 60, NULL, '{"donation":true}', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO asinu_app.seeding_rules (id, ladder, active)
VALUES (
  '22222222-1111-4bbb-9999-000000000001',
  '[
     {"threshold":3,"message":"Bạn đủ điểm đổi sticker đầu tiên!"},
     {"threshold":10,"message":"Sắp đạt mốc 80 điểm, cố lên!"},
     {"threshold":80,"message":"Mở khóa voucher nước khoáng"},
     {"threshold":120,"message":"Đổi gói tư vấn dinh dưỡng"},
     {"threshold":200,"message":"Nhận huy hiệu Người chăm cây"}
   ]'::jsonb,
  true
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
