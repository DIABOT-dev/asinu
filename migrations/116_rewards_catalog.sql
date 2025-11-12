BEGIN;

CREATE TABLE IF NOT EXISTS asinu_app.catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  item_type TEXT NOT NULL CHECK (item_type IN ('voucher','cosmetic','physical','donation')),
  cost INT NOT NULL CHECK (cost >= 0),
  inventory INT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS asinu_app.reward_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES asinu_app.catalog_items(id) ON DELETE CASCADE,
  segment TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  min_points INT NOT NULL DEFAULT 0,
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS asinu_app.reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES asinu_app.app_user(user_id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES asinu_app.catalog_items(id) ON DELETE CASCADE,
  cost INT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','fulfilled','failed','void')),
  voucher_code TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  fulfilled_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_user ON asinu_app.reward_redemptions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS asinu_app.seeding_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ladder JSONB NOT NULL,
  active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
