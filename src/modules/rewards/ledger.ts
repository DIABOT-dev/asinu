import type { PoolClient } from "pg";
import { getPool, query } from "@/lib/db_client";

export class RewardLedgerError extends Error {
  code: "INSUFFICIENT_POINTS" | "INVALID_AMOUNT";
  details?: Record<string, unknown>;

  constructor(code: RewardLedgerError["code"], message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "RewardLedgerError";
    this.code = code;
    this.details = details;
  }
}

export type LedgerMetadata = Record<string, unknown>;

type BaseMovement = {
  userId: string;
  amount: number;
  reason: string;
  metadata?: LedgerMetadata;
  idempotencyKey?: string | null;
  client?: PoolClient | null;
};

export type CreditResult = {
  balance: number;
  ledgerId: string | null;
  duplicate: boolean;
};

export type DebitResult = CreditResult;

async function runWithClient<T>(existing: PoolClient | null | undefined, handler: (client: PoolClient) => Promise<T>) {
  if (existing) {
    return handler(existing);
  }
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await handler(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function ensureBalanceRow(client: PoolClient, userId: string) {
  await client.query(
    `INSERT INTO vp_balances (user_id, balance, updated_at)
     VALUES ($1, 0, now())
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
}

async function selectLedgerByKey(client: PoolClient, key?: string | null) {
  if (!key) return null;
  const res = await client.query<{ id: string }>(`SELECT id FROM vp_ledger WHERE idempotency_key = $1`, [key]);
  return res.rows[0] ?? null;
}

async function readBalance(client: PoolClient, userId: string, forUpdate = false) {
  const sql = forUpdate
    ? `SELECT balance FROM vp_balances WHERE user_id = $1 FOR UPDATE`
    : `SELECT balance FROM vp_balances WHERE user_id = $1`;
  const res = await client.query<{ balance: number }>(sql, [userId]);
  return res.rows[0]?.balance ?? 0;
}

export async function creditRewardPoints(input: BaseMovement): Promise<CreditResult> {
  if (input.amount <= 0) {
    throw new RewardLedgerError("INVALID_AMOUNT", "Amount must be greater than zero.");
  }
  return runWithClient(input.client, async (client) => {
    const duplicate = await selectLedgerByKey(client, input.idempotencyKey);
    if (duplicate) {
      const balance = await readBalance(client, input.userId);
      return { balance, ledgerId: duplicate.id, duplicate: true };
    }

    const ledgerRes = await client.query<{ id: string }>(
      `INSERT INTO vp_ledger (user_id, delta, reason, metadata, idempotency_key)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       RETURNING id`,
      [
        input.userId,
        input.amount,
        input.reason,
        JSON.stringify(input.metadata ?? {}),
        input.idempotencyKey ?? null,
      ],
    );

    const balanceRes = await client.query<{ balance: number }>(
      `INSERT INTO vp_balances (user_id, balance, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (user_id) DO UPDATE
         SET balance = vp_balances.balance + EXCLUDED.balance,
             updated_at = now()
       RETURNING balance`,
      [input.userId, input.amount],
    );

    return {
      ledgerId: ledgerRes.rows[0]?.id ?? null,
      balance: balanceRes.rows[0]?.balance ?? 0,
      duplicate: false,
    };
  });
}

export async function debitRewardPoints(input: BaseMovement): Promise<DebitResult> {
  if (input.amount <= 0) {
    throw new RewardLedgerError("INVALID_AMOUNT", "Amount must be greater than zero.");
  }
  return runWithClient(input.client, async (client) => {
    const duplicate = await selectLedgerByKey(client, input.idempotencyKey);
    if (duplicate) {
      const balance = await readBalance(client, input.userId);
      return { balance, ledgerId: duplicate.id, duplicate: true };
    }

    await ensureBalanceRow(client, input.userId);
    const current = await readBalance(client, input.userId, true);
    if (current < input.amount) {
      throw new RewardLedgerError("INSUFFICIENT_POINTS", "Not enough points to complete this action.", {
        balance: current,
        requested: input.amount,
      });
    }

    const ledgerRes = await client.query<{ id: string }>(
      `INSERT INTO vp_ledger (user_id, delta, reason, metadata, idempotency_key)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       RETURNING id`,
      [
        input.userId,
        -input.amount,
        input.reason,
        JSON.stringify(input.metadata ?? {}),
        input.idempotencyKey ?? null,
      ],
    );

    const balanceRes = await client.query<{ balance: number }>(
      `UPDATE vp_balances
       SET balance = balance - $2,
           updated_at = now()
       WHERE user_id = $1
       RETURNING balance`,
      [input.userId, input.amount],
    );

    return {
      ledgerId: ledgerRes.rows[0]?.id ?? null,
      balance: balanceRes.rows[0]?.balance ?? 0,
      duplicate: false,
    };
  });
}

export async function getRewardBalance(userId: string): Promise<number> {
  const res = await query<{ balance: number }>(
    `SELECT balance FROM vp_balances WHERE user_id = $1`,
    [userId],
  );
  return res.rows[0]?.balance ?? 0;
}

export async function getRewardLedger(
  userId: string,
  limit = 20,
): Promise<
  {
    id: string;
    delta: number;
    reason: string;
    metadata: LedgerMetadata;
    created_at: string;
  }[]
> {
  const res = await query(
    `SELECT id, delta, reason, metadata, created_at
     FROM vp_ledger
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit],
  );
  return res.rows.map((row: any) => ({
    id: row.id,
    delta: Number(row.delta),
    reason: row.reason,
    metadata: row.metadata ?? {},
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  }));
}
