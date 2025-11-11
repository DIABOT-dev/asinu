BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_namespace WHERE nspname = 'asinu_app'
  ) THEN
    EXECUTE 'CREATE SCHEMA asinu_app AUTHORIZATION CURRENT_USER';
  END IF;
END
$$ LANGUAGE plpgsql;

-- Ensure all core tables live under asinu_app schema.
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
    'missions',
    'user_missions',
    'metrics_day',
    'metrics_week',
    'media_file'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF to_regclass(format('asinu_app.%I', tbl)) IS NULL
       AND to_regclass(format('public.%I', tbl)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I SET SCHEMA asinu_app;', tbl);
    END IF;
  END LOOP;
END
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  seq text;
  sequences text[] := ARRAY[
    'log_meal_id_seq',
    'log_bg_id_seq',
    'log_bp_id_seq',
    'log_weight_id_seq',
    'log_water_id_seq',
    'log_insulin_id_seq',
    'log_activity_id_seq',
    'log_sleep_id_seq',
    'mission_log_id_seq',
    'user_missions_id_seq',
    'metrics_day_id_seq',
    'metrics_week_id_seq',
    'media_file_file_id_seq'
  ];
BEGIN
  FOREACH seq IN ARRAY sequences LOOP
    IF to_regclass(format('asinu_app.%I', seq)) IS NULL
       AND to_regclass(format('public.%I', seq)) IS NOT NULL THEN
      EXECUTE format('ALTER SEQUENCE public.%I SET SCHEMA asinu_app;', seq);
    END IF;
  END LOOP;
END
$$ LANGUAGE plpgsql;

-- Default search_path for current database so new objects land in asinu_app.
ALTER DATABASE current_database() SET search_path TO asinu_app, public;

COMMIT;
