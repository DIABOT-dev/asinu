BEGIN;

CREATE TABLE IF NOT EXISTS bridge_log (
  id BIGSERIAL PRIMARY KEY,
  event_id UUID NOT NULL DEFAULT gen_random_uuid(),
  event TEXT NOT NULL,
  user_id UUID,
  user_hash TEXT,
  payload JSONB NOT NULL,
  delivered BOOLEAN NOT NULL DEFAULT false,
  status INT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bridge_log_created_at ON bridge_log(created_at DESC);

COMMIT;
