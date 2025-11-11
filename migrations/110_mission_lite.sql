BEGIN;

CREATE TABLE IF NOT EXISTS missions (
  mission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  cluster TEXT NOT NULL,
  energy INT NOT NULL DEFAULT 0,
  max_per_day INT NOT NULL DEFAULT 1,
  active_from DATE NOT NULL DEFAULT CURRENT_DATE,
  active_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_missions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES missions(mission_id) ON DELETE CASCADE,
  mission_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, mission_id, mission_date)
);
CREATE INDEX IF NOT EXISTS idx_user_missions_user_date ON user_missions(user_id, mission_date DESC);

CREATE TABLE IF NOT EXISTS mission_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES missions(mission_id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  points INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mission_log_user_date ON mission_log(user_id, ts DESC);

WITH defaults(code, title, cluster, energy, max_per_day) AS (
  VALUES
    ('water', 'Drink 6 glasses of water', 'body', 4, 3),
    ('walk', 'Walk at least 10 minutes', 'move', 6, 1),
    ('mood', 'Check in with your mood', 'mind', 5, 1)
)
INSERT INTO missions (code, title, cluster, energy, max_per_day, active_from, active_to)
SELECT
  d.code,
  d.title,
  d.cluster,
  d.energy,
  d.max_per_day,
  CURRENT_DATE,
  NULL
FROM defaults d
ON CONFLICT (code) DO UPDATE
SET
  title = EXCLUDED.title,
  cluster = EXCLUDED.cluster,
  energy = EXCLUDED.energy,
  max_per_day = EXCLUDED.max_per_day,
  updated_at = now();

COMMIT;
