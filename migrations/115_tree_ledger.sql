BEGIN;

-- -------------------------------------------------------------------
-- Tree events + ledger schema
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asinu_app.tree_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES asinu_app.app_user(user_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  amount INT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE asinu_app.tree_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_tree_events_owner ON asinu_app.tree_events;
CREATE POLICY p_tree_events_owner ON asinu_app.tree_events
  FOR ALL
  USING (user_id::text = current_setting('asinu.user_id', true))
  WITH CHECK (user_id::text = current_setting('asinu.user_id', true));

CREATE TABLE IF NOT EXISTS asinu_app.points_ledger (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES asinu_app.app_user(user_id) ON DELETE CASCADE,
  delta INT NOT NULL,
  reason TEXT NOT NULL,
  event_id UUID REFERENCES asinu_app.tree_events(id) ON DELETE SET NULL,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE asinu_app.points_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_points_ledger_owner ON asinu_app.points_ledger;
CREATE POLICY p_points_ledger_owner ON asinu_app.points_ledger
  FOR ALL
  USING (user_id::text = current_setting('asinu.user_id', true))
  WITH CHECK (user_id::text = current_setting('asinu.user_id', true));

CREATE TABLE IF NOT EXISTS asinu_app.tree_state (
  user_id UUID PRIMARY KEY REFERENCES asinu_app.app_user(user_id) ON DELETE CASCADE,
  total_points INT NOT NULL DEFAULT 0,
  level INT NOT NULL DEFAULT 1,
  e_day INT NOT NULL DEFAULT 0,
  streak INT NOT NULL DEFAULT 0,
  last_event_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE asinu_app.tree_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_tree_state_owner ON asinu_app.tree_state;
CREATE POLICY p_tree_state_owner ON asinu_app.tree_state
  FOR ALL
  USING (user_id::text = current_setting('asinu.user_id', true))
  WITH CHECK (user_id::text = current_setting('asinu.user_id', true));

COMMIT;
