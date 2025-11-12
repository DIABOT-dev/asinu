BEGIN;

-- -------------------------------------------------------------------
-- 1) Enum types (relation + role)
-- -------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type typ
    JOIN pg_namespace nsp ON nsp.oid = typ.typnamespace
    WHERE nsp.nspname = 'asinu_app' AND typ.typname = 'relation_type'
  ) THEN
    EXECUTE $ddl$
      CREATE TYPE asinu_app.relation_type AS ENUM (
        'father','mother','son','daughter','husband','wife',
        'brother','sister','grandfather','grandmother',
        'grandson','granddaughter','uncle','aunt','cousin','other'
      );
    $ddl$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type typ
    JOIN pg_namespace nsp ON nsp.oid = typ.typnamespace
    WHERE nsp.nspname = 'asinu_app' AND typ.typname = 'relative_role'
  ) THEN
    EXECUTE $ddl$
      CREATE TYPE asinu_app.relative_role AS ENUM ('viewer','editor');
    $ddl$;
  END IF;
END
$$ LANGUAGE plpgsql;

-- -------------------------------------------------------------------
-- 2) Relatives table
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asinu_app.relatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES asinu_app.app_user(user_id) ON DELETE CASCADE,
  relative_user_id UUID NOT NULL REFERENCES asinu_app.app_user(user_id) ON DELETE CASCADE,
  relation asinu_app.relation_type NOT NULL,
  role asinu_app.relative_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_user_id, relative_user_id),
  CHECK (owner_user_id <> relative_user_id)
);

CREATE INDEX IF NOT EXISTS idx_relatives_relative_user
  ON asinu_app.relatives(relative_user_id);

-- -------------------------------------------------------------------
-- 3) Logged_by support on log tables
-- -------------------------------------------------------------------
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'log_meal',
    'log_bg',
    'log_bp',
    'log_weight',
    'log_water',
    'log_insulin',
    'log_activity',
    'log_sleep'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format(
      'ALTER TABLE asinu_app.%I
         ADD COLUMN IF NOT EXISTS logged_by UUID
         REFERENCES asinu_app.app_user(user_id);',
      tbl
    );
  END LOOP;
END
$$ LANGUAGE plpgsql;

-- -------------------------------------------------------------------
-- 4) RLS policies for relatives
-- -------------------------------------------------------------------
ALTER TABLE asinu_app.relatives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_relatives_owner_manage ON asinu_app.relatives;
CREATE POLICY p_relatives_owner_manage ON asinu_app.relatives
  FOR ALL
  USING (
    owner_user_id::text = current_setting('asinu.user_id', true)
  )
  WITH CHECK (
    owner_user_id::text = current_setting('asinu.user_id', true)
  );

DROP POLICY IF EXISTS p_relatives_relative_view ON asinu_app.relatives;
CREATE POLICY p_relatives_relative_view ON asinu_app.relatives
  FOR SELECT USING (
    relative_user_id::text = current_setting('asinu.user_id', true)
  );

COMMIT;
