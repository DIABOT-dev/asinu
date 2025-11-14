import { ensureDbConnection, getPool, query } from "@/lib/db_client";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import type { SessionPayload } from "@/lib/auth/session";

export const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
export const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

type DbClient = Awaited<ReturnType<ReturnType<typeof getPool>["connect"]>>;

export type AuthUserRecord = SessionPayload & {
  password_hash: string | null;
  password_algo: string | null;
  provider: string | null;
  legacy_password_hash: string | null;
  legacy_password_algo: string | null;
  google_sub?: string | null;
  zalo_id?: string | null;
};

type RawUserRow = {
  user_id: string;
  email: string | null;
  phone: string | null;
  display_name: string | null;
  password_hash: string | null;
  password_algo: string | null;
  provider: string | null;
  google_sub: string | null;
  zalo_id: string | null;
  prefs?: Record<string, unknown> | null;
};

function mapRow(row: RawUserRow): AuthUserRecord {
  const prefs = (row.prefs ?? {}) as any;
  const legacyAuth = prefs?.auth ?? {};
  return {
    user_id: row.user_id,
    email: row.email ?? null,
    phone: row.phone ?? null,
    display_name: row.display_name ?? null,
    password_hash: row.password_hash ?? null,
    password_algo: row.password_algo ?? null,
    provider: row.provider ?? null,
    legacy_password_hash: legacyAuth?.password_hash ?? null,
    legacy_password_algo: legacyAuth?.password_algo ?? null,
    google_sub: row.google_sub ?? null,
    zalo_id: row.zalo_id ?? null,
  };
}

export function normalizeEmail(email?: string | null): string | null {
  if (!email) return null;
  const trimmed = email.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

export function normalizeVietnamPhone(input?: string | null): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) return `+84${digits.slice(1)}`;
  if (digits.startsWith("84")) return `+${digits}`;
  if (digits.startsWith("+84")) return digits;
  if (digits.length >= 9 && digits.length <= 11) return `+84${digits}`;
  return null;
}

export function deriveDisplayName(
  email?: string | null,
  phone?: string | null,
  fallback?: string | null,
): string {
  if (fallback && fallback.trim()) return fallback.trim();
  if (email) {
    return email.split("@")[0]?.slice(0, 32) || "Member";
  }
  if (phone) {
    return `Member ${phone.slice(-4)}`;
  }
  return "Member";
}

async function withTransaction<T>(fn: (client: DbClient) => Promise<T>): Promise<T> {
  const pool = getPool();
  await ensureDbConnection();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function ensureUserSettings(client: DbClient, userId: string) {
  await client.query(
    `INSERT INTO user_settings (user_id, prefs, created_at, updated_at)
     VALUES ($1, '{}'::jsonb, now(), now())
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
}

async function insertUserRow(
  client: DbClient,
  params: {
    email?: string | null;
    phone?: string | null;
    displayName?: string | null;
    passwordHash?: string | null;
    passwordAlgo?: string | null;
    provider?: string | null;
    googleSub?: string | null;
    zaloId?: string | null;
  },
): Promise<AuthUserRecord> {
  const result = await client.query(
    `INSERT INTO app_user (
        email,
        phone,
        display_name,
        password_hash,
        password_algo,
        provider,
        google_sub,
        zalo_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING user_id,
               email,
               phone,
               display_name,
               password_hash,
               password_algo,
               provider,
               google_sub,
               zalo_id`,
    [
      params.email ?? null,
      params.phone ?? null,
      params.displayName ?? null,
      params.passwordHash ?? null,
      params.passwordAlgo ?? null,
      params.provider ?? null,
      params.googleSub ?? null,
      params.zaloId ?? null,
    ],
  );
  const user = mapRow(result.rows[0] as RawUserRow);
  await ensureUserSettings(client, user.user_id);
  return user;
}

export async function createUserWithPassword(params: {
  email?: string | null;
  phone?: string | null;
  password: string;
  displayName?: string | null;
  provider?: string | null;
}): Promise<AuthUserRecord> {
  const normalizedEmail = normalizeEmail(params.email);
  const normalizedPhone = normalizeVietnamPhone(params.phone);
  const passwordHash = await hashPassword(params.password);
  const displayName = deriveDisplayName(normalizedEmail, normalizedPhone, params.displayName);
  const provider =
    params.provider ??
    (normalizedPhone ? "phone_password" : normalizedEmail ? "email_password" : "credentials");

  return withTransaction((client) =>
    insertUserRow(client, {
      email: normalizedEmail,
      phone: normalizedPhone,
      displayName,
      passwordHash,
      passwordAlgo: "scrypt",
      provider,
    }),
  );
}

export async function createPhoneOtpUser(phone: string): Promise<AuthUserRecord> {
  const normalizedPhone = normalizeVietnamPhone(phone);
  if (!normalizedPhone) {
    throw new Error("PHONE_INVALID");
  }
  return withTransaction((client) =>
    insertUserRow(client, {
      phone: normalizedPhone,
      displayName: deriveDisplayName(null, normalizedPhone, null),
      provider: "phone_otp",
    }),
  );
}

async function fetchUser(where: string, value: string): Promise<AuthUserRecord | null> {
  const result = await query(
    `SELECT u.user_id,
            u.email,
            u.phone,
            u.display_name,
            u.password_hash,
            u.password_algo,
            u.provider,
            u.google_sub,
            u.zalo_id,
            s.prefs
     FROM app_user u
     LEFT JOIN user_settings s ON s.user_id = u.user_id
     WHERE ${where}
     LIMIT 1`,
    [value],
  );
  if (result.rows.length === 0) {
    return null;
  }
  return mapRow(result.rows[0] as RawUserRow);
}

export async function findUserByEmail(email: string | null): Promise<AuthUserRecord | null> {
  if (!email) return null;
  return fetchUser("lower(u.email) = lower($1)", email);
}

export async function findUserByPhone(phone: string | null): Promise<AuthUserRecord | null> {
  if (!phone) return null;
  return fetchUser("u.phone = $1", phone);
}

export async function findUserByGoogleSub(sub: string): Promise<AuthUserRecord | null> {
  return fetchUser("u.google_sub = $1", sub);
}

export async function findUserByZaloId(zaloId: string): Promise<AuthUserRecord | null> {
  return fetchUser("u.zalo_id = $1", zaloId);
}

async function migrateLegacyHash(userId: string, hash: string, algo?: string | null) {
  await query(
    `UPDATE app_user
     SET password_hash = $2,
         password_algo = COALESCE($3, 'scrypt'),
         updated_at = now()
     WHERE user_id = $1`,
    [userId, hash, algo ?? "scrypt"],
  );
}

export async function verifyUserPassword(
  user: AuthUserRecord,
  password: string,
): Promise<boolean> {
  if (user.password_hash) {
    return verifyPassword(password, user.password_hash);
  }
  if (user.legacy_password_hash) {
    const valid = await verifyPassword(password, user.legacy_password_hash);
    if (valid) {
      await migrateLegacyHash(user.user_id, user.legacy_password_hash, user.legacy_password_algo);
    }
    return valid;
  }
  return false;
}

export async function recordLogin(userId: string, provider?: string | null) {
  await query(
    `UPDATE app_user
     SET last_login_at = now(),
         provider = COALESCE(provider, $2),
         updated_at = now()
     WHERE user_id = $1`,
    [userId, provider ?? null],
  );
}

export async function upsertOAuthUser(params: {
  email?: string | null;
  googleSub?: string | null;
  zaloId?: string | null;
  displayName?: string | null;
  provider: "google" | "zalo";
}): Promise<AuthUserRecord> {
  if (!params.googleSub && !params.zaloId && !params.email) {
    throw new Error("OAUTH_PROFILE_INCOMPLETE");
  }

  let user: AuthUserRecord | null = null;
  if (params.googleSub) {
    user = await findUserByGoogleSub(params.googleSub);
  } else if (params.zaloId) {
    user = await findUserByZaloId(params.zaloId);
  }

  if (!user && params.email) {
    user = await findUserByEmail(params.email);
  }

  if (user) {
    // Ensure provider-specific identifiers are stored.
    const updates: string[] = [];
    const values: any[] = [];
    if (params.googleSub && !user.google_sub) {
      updates.push("google_sub = $" + (values.length + 2));
      values.push(params.googleSub);
    }
    if (params.zaloId && !user.zalo_id) {
      updates.push("zalo_id = $" + (values.length + 2));
      values.push(params.zaloId);
    }
    if (updates.length > 0) {
      await query(
        `UPDATE app_user
         SET ${updates.join(", ")},
             updated_at = now()
         WHERE user_id = $1`,
        [user.user_id, ...values],
      );
      user = await fetchUser("u.user_id = $1", user.user_id);
    }
    return user!;
  }

  const normalizedEmail = normalizeEmail(params.email ?? null);
  const displayName = deriveDisplayName(normalizedEmail, null, params.displayName ?? null);
  return withTransaction((client) =>
    insertUserRow(client, {
      email: normalizedEmail,
      displayName,
      provider: params.provider,
      googleSub: params.googleSub ?? null,
      zaloId: params.zaloId ?? null,
    }),
  );
}
