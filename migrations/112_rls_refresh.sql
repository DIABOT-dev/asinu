BEGIN;

DROP FUNCTION IF EXISTS diabot_set_user;

CREATE OR REPLACE FUNCTION asinu_set_user(uid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('asinu.user_id', uid::text, TRUE);
END;
$$;

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'app_user',
    'user_settings',
    'log_meal',
    'log_bg',
    'log_bp',
    'log_weight',
    'log_water',
    'log_insulin',
    'log_activity',
    'log_sleep',
    'mission_log',
    'user_missions',
    'metrics_day',
    'metrics_week',
    'media_file'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE asinu_app.%I ENABLE ROW LEVEL SECURITY;', tbl);

    EXECUTE format('
      DROP POLICY IF EXISTS p_%1$s_select ON asinu_app.%1$s;
      CREATE POLICY p_%1$s_select ON asinu_app.%1$s
        FOR SELECT USING (
          asinu_app.%1$s.user_id::text = current_setting(''asinu.user_id'', true)
        );

      DROP POLICY IF EXISTS p_%1$s_mod ON asinu_app.%1$s;
      CREATE POLICY p_%1$s_mod ON asinu_app.%1$s
        FOR ALL USING (
          asinu_app.%1$s.user_id::text = current_setting(''asinu.user_id'', true)
        )
        WITH CHECK (
          asinu_app.%1$s.user_id::text = current_setting(''asinu.user_id'', true)
        );
    ', tbl);
  END LOOP;
END
$$ LANGUAGE plpgsql;

COMMIT;
