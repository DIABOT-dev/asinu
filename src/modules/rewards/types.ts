export type RewardCatalogItem = {
  id: string;
  title: string;
  subtitle: string | null;
  item_type: string;
  cost: number;
  inventory: number | null;
  metadata: Record<string, unknown>;
  badge?: string | null;
  tags: string[];
  can_redeem: boolean;
};

export type RewardOffer = {
  id: string;
  item_id: string;
  segment: string | null;
  starts_at: string | null;
  ends_at: string | null;
  min_points: number;
  label: string | null;
};

export type RewardCatalogPayload = {
  balance: number;
  supporter_badge: boolean;
  items: RewardCatalogItem[];
  offers: RewardOffer[];
};

export type LadderStep = {
  threshold: number;
  message: string;
};

export type RewardRedemption = {
  id: string;
  item_id: string;
  title: string;
  subtitle: string | null;
  item_type: string;
  cost: number;
  status: string;
  voucher_code: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  fulfilled_at: string | null;
};

export type DonationInput = {
  provider: string;
  amountPoints?: number;
  amountVnd?: number;
  campaign?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
};

export type DonationPayload = {
  id: string;
  provider: string;
  amount_points: number;
  amount_vnd: number;
  status: string;
  campaign: string | null;
  created_at: string;
  balance: number;
  supporter_badge: boolean;
  payment_url?: string;
};
