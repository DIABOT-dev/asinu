import crypto from "crypto";
import { getPool, query } from "@/lib/db_client";
import { RewardServiceError } from "./errors";
import {
  debitRewardPoints,
  getRewardBalance,
  getRewardLedger,
  RewardLedgerError,
} from "./ledger";
import type {
  DonationInput,
  DonationPayload,
  LadderStep,
  RewardCatalogItem,
  RewardCatalogPayload,
  RewardOffer,
  RewardRedemption,
} from "./types";

type CatalogRow = {
  id: string;
  title: string;
  subtitle: string | null;
  item_type: string;
  cost: number;
  inventory: number | null;
  metadata: Record<string, unknown>;
};

const DONATION_PORTAL =
  process.env.DONATION_PORTAL_URL || "https://asinu.ai/donate";

function normalizeItem(row: CatalogRow, balance: number): RewardCatalogItem {
  const metadata = row.metadata ?? {};
  const badge =
    typeof metadata.badge === "string" ? (metadata.badge as string) : null;
  const tags = Array.isArray(metadata.tags)
    ? (metadata.tags as string[])
    : [];
  const available = row.inventory == null || Number(row.inventory) > 0;
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    item_type: row.item_type,
    cost: Number(row.cost),
    inventory: row.inventory,
    metadata,
    badge,
    tags,
    can_redeem: available && balance >= Number(row.cost),
  };
}

function normalizeOffer(row: any): RewardOffer {
  const limits =
    row.limits && typeof row.limits === "object" ? row.limits : {};
  return {
    id: row.id,
    item_id: row.item_id,
    segment: row.segment ?? null,
    starts_at:
      row.starts_at instanceof Date
        ? row.starts_at.toISOString()
        : row.starts_at,
    ends_at:
      row.ends_at instanceof Date ? row.ends_at.toISOString() : row.ends_at,
    min_points: Number(row.min_points ?? 0),
    label: typeof limits.label === "string" ? (limits.label as string) : null,
  };
}

export async function fetchRewardCatalog(userId: string): Promise<RewardCatalogPayload> {
  const [itemsRes, offersRes, badgeRes, balance] = await Promise.all([
    query<CatalogRow>(
      `SELECT id, title, subtitle, item_type, cost, inventory, metadata
       FROM catalog_items
       WHERE active = true
       ORDER BY cost ASC`,
    ),
    query(
      `SELECT id, item_id, segment, starts_at, ends_at, min_points, limits
       FROM reward_offers
       WHERE active = true
         AND (starts_at IS NULL OR starts_at <= now())
         AND (ends_at IS NULL OR ends_at >= now())
       ORDER BY coalesce(starts_at, now()) ASC`,
    ),
    query<{ exists: boolean }>(
      `SELECT true as exists FROM donation_log WHERE user_id = $1 LIMIT 1`,
      [userId],
    ),
    getRewardBalance(userId),
  ]);

  const items = itemsRes.rows.map((row) => normalizeItem(row, balance));
  const offers = offersRes.rows.map(normalizeOffer);
  const supporterBadge = badgeRes.rowCount > 0;

  return {
    balance,
    supporter_badge: supporterBadge,
    items,
    offers,
  };
}

export async function listRedemptions(userId: string, limit = 20): Promise<RewardRedemption[]> {
  const res = await query(
    `SELECT rr.id,
            rr.item_id,
            ci.title,
            ci.subtitle,
            ci.item_type,
            rr.cost,
            rr.status,
            rr.voucher_code,
            rr.metadata,
            rr.created_at,
            rr.fulfilled_at
     FROM reward_redemptions rr
     JOIN catalog_items ci ON ci.id = rr.item_id
     WHERE rr.user_id = $1
     ORDER BY rr.created_at DESC
     LIMIT $2`,
    [userId, limit],
  );

  return res.rows.map((row: any) => ({
    id: row.id,
    item_id: row.item_id,
    title: row.title,
    subtitle: row.subtitle,
    item_type: row.item_type,
    cost: Number(row.cost),
    status: row.status,
    voucher_code: row.voucher_code,
    metadata: row.metadata ?? {},
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    fulfilled_at: row.fulfilled_at instanceof Date ? row.fulfilled_at.toISOString() : row.fulfilled_at,
  }));
}

function buildVoucherCode(item: CatalogRow) {
  if (typeof item.metadata?.voucher_code === "string") {
    return item.metadata.voucher_code as string;
  }
  if (item.item_type === "voucher") {
    return `ASINU-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  }
  return null;
}

export async function redeemRewardItem(userId: string, itemId: string) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const itemRes = await client.query<CatalogRow>(
      `SELECT id, title, subtitle, item_type, cost, inventory, metadata
       FROM catalog_items
       WHERE id = $1 AND active = true
       FOR UPDATE`,
      [itemId],
    );
    const item = itemRes.rows[0];
    if (!item) {
      throw new RewardServiceError("ITEM_NOT_FOUND", "Phần thưởng không khả dụng.", 404);
    }
    if (item.inventory !== null && Number(item.inventory) <= 0) {
      throw new RewardServiceError("OUT_OF_STOCK", "Phần thưởng đã hết.", 409);
    }

    const debit = await debitRewardPoints({
      userId,
      amount: Number(item.cost),
      reason: `reward:${item.id}`,
      metadata: { item_id: item.id, item_type: item.item_type },
      client,
    });

    const redemptionRes = await client.query(
      `INSERT INTO reward_redemptions (user_id, item_id, cost, status, voucher_code, metadata)
       VALUES ($1, $2, $3, 'fulfilled', $4, $5::jsonb)
       RETURNING id, status, created_at`,
      [
        userId,
        item.id,
        item.cost,
        buildVoucherCode(item),
        JSON.stringify({ source: "rewards-ui" }),
      ],
    );

    if (item.inventory !== null) {
      await client.query(
        `UPDATE catalog_items
         SET inventory = GREATEST(inventory - 1, 0)
         WHERE id = $1`,
        [item.id],
      );
    }

    await client.query("COMMIT");

    return {
      redemption_id: redemptionRes.rows[0]?.id,
      status: redemptionRes.rows[0]?.status ?? "fulfilled",
      created_at:
        redemptionRes.rows[0]?.created_at instanceof Date
          ? redemptionRes.rows[0]?.created_at.toISOString()
          : redemptionRes.rows[0]?.created_at,
      balance: debit.balance,
      item: {
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        item_type: item.item_type,
        cost: item.cost,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error instanceof RewardLedgerError) {
      throw new RewardServiceError(
        error.code,
        error.message,
        error.code === "INSUFFICIENT_POINTS" ? 409 : 400,
        error.details,
      );
    }
    throw error;
  } finally {
    client.release();
  }
}

export function buildDonationPaymentUrl(provider: string, amountVnd: number, campaign?: string | null) {
  if (!amountVnd) return null;
  const url = new URL(DONATION_PORTAL);
  url.searchParams.set("provider", provider);
  url.searchParams.set("amount", String(amountVnd));
  if (campaign) url.searchParams.set("campaign", campaign);
  return url.toString();
}

export async function recordDonation(userId: string, input: DonationInput): Promise<DonationPayload> {
  const amountPoints = Number(input.amountPoints ?? 0);
  const amountVnd = Number(input.amountVnd ?? 0);
  if (amountPoints <= 0 && amountVnd <= 0) {
    throw new RewardServiceError("INVALID_DONATION", "Cần ít nhất một khoản điểm hoặc số tiền hợp lệ.", 400);
  }
  if (amountPoints < 0 || amountVnd < 0) {
    throw new RewardServiceError("INVALID_DONATION", "Giá trị không hợp lệ.", 400);
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let latestBalance: number | null = null;
    if (amountPoints > 0) {
      const debit = await debitRewardPoints({
        userId,
        amount: amountPoints,
        reason: `donation:${input.provider}`,
        metadata: { campaign: input.campaign ?? null },
        client,
      });
      latestBalance = debit.balance;
    }

    const donationRes = await client.query(
      `INSERT INTO donation_log (user_id, provider, amount_points, amount_vnd, campaign, note, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       RETURNING id, status, created_at`,
      [
        userId,
        input.provider,
        amountPoints,
        amountVnd,
        input.campaign ?? null,
        input.note ?? null,
        amountVnd > 0 ? "pending_payment" : "recorded",
        JSON.stringify(input.metadata ?? {}),
      ],
    );

    await client.query("COMMIT");

    const paymentUrl = buildDonationPaymentUrl(input.provider, amountVnd, input.campaign);
    const balance = latestBalance ?? (await getRewardBalance(userId));

    return {
      id: donationRes.rows[0]?.id,
      provider: input.provider,
      amount_points: amountPoints,
      amount_vnd: amountVnd,
      status: donationRes.rows[0]?.status ?? "recorded",
      campaign: input.campaign ?? null,
      created_at:
        donationRes.rows[0]?.created_at instanceof Date
          ? donationRes.rows[0]?.created_at.toISOString()
          : donationRes.rows[0]?.created_at,
      balance,
      supporter_badge: true,
      payment_url: paymentUrl ?? undefined,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error instanceof RewardLedgerError) {
      throw new RewardServiceError(
        error.code,
        error.message,
        error.code === "INSUFFICIENT_POINTS" ? 409 : 400,
        error.details,
      );
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function fetchRewardLedger(userId: string) {
  return getRewardLedger(userId, 30);
}

export async function fetchActiveLadder(): Promise<LadderStep[]> {
  const res = await query<{ ladder: any }>(
    `SELECT ladder
     FROM seeding_rules
     WHERE active = true
     ORDER BY created_at DESC
     LIMIT 1`,
  );
  if (!res.rows.length) return [];
  const ladder = res.rows[0].ladder;
  if (Array.isArray(ladder)) {
    return ladder as LadderStep[];
  }
  if (typeof ladder === "string") {
    try {
      const parsed = JSON.parse(ladder);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
