import "dotenv/config";
import { Pool } from "pg";

type CleanupResult = {
  removed: number;
};

function resolveConnectionString() {
  return process.env.DATABASE_URL || process.env.DIABOT_DB_URL;
}

async function withPool<T>(handler: (pool: Pool) => Promise<T>) {
  const connectionString = resolveConnectionString();
  if (!connectionString) {
    throw new Error("DATABASE_URL or DIABOT_DB_URL is required");
  }
  const pool = new Pool({
    connectionString,
    ssl:
      process.env.PGSSLMODE === "disable"
        ? false
        : {
            rejectUnauthorized: false,
          },
  });

  try {
    return await handler(pool);
  } finally {
    await pool.end();
  }
}

async function cleanupOtpStore(): Promise<CleanupResult> {
  return withPool(async (pool) => {
    const result = await pool.query<{ count: string }>(
      `WITH deleted AS (
         DELETE FROM auth_otp_store
         WHERE expires_at <= now() OR consumed_at IS NOT NULL
         RETURNING 1
       )
       SELECT COUNT(*)::text AS count FROM deleted`,
    );
    return { removed: Number.parseInt(result.rows[0]?.count ?? "0", 10) };
  });
}

async function main() {
  const start = Date.now();
  try {
    const result = await cleanupOtpStore();
    const duration = Date.now() - start;
    console.log(
      `[otp-cleanup] removed ${result.removed} row(s) in ${duration}ms at ${new Date().toISOString()}`,
    );
  } catch (error) {
    console.error("[otp-cleanup] failed", error);
    process.exitCode = 1;
  }
}

void main();
