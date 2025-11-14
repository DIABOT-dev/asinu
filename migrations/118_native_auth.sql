-- 118_native_auth.sql
-- Purpose: Introduce native auth session + OTP tables and migrate password hashes into app_user.
-- Date: 2025-11-14

BEGIN;

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS password_algo TEXT,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS google_sub TEXT,
  ADD COLUMN IF NOT EXISTS zalo_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_app_user_phone ON app_user(phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_user_google_sub ON app_user(google_sub) WHERE google_sub IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_user_zalo_id ON app_user(zalo_id) WHERE zalo_id IS NOT NULL;

UPDATE app_user u
SET
  password_hash = prefs -> 'auth' ->> 'password_hash',
  password_algo = COALESCE(prefs -> 'auth' ->> 'password_algo', password_algo),
  updated_at = now()
FROM user_settings s
WHERE
  s.user_id = u.user_id
  AND u.password_hash IS NULL
  AND prefs -> 'auth' ->> 'password_hash' IS NOT NULL;

CREATE TABLE IF NOT EXISTS auth_session (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_session_user ON auth_session(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_session_expires_at ON auth_session(expires_at);

CREATE TABLE IF NOT EXISTS auth_otp_store (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  otp TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_otp_phone ON auth_otp_store(phone);
CREATE INDEX IF NOT EXISTS idx_auth_otp_expires_at ON auth_otp_store(expires_at);

COMMIT;
