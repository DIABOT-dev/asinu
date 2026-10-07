export type PlanCode = "free" | "antam_2" | "antam_4" | "antam_8";

export type SubscriptionStatus = {
  ok: boolean;
  planCode: PlanCode;
  planName: string;
  tier: "free" | "antam";
  isAnTam: boolean;
  isOwner: boolean;
  ownerUserId: number;
  protectedMemberLimit: number;
  protectedMemberCount: number;
  connectionLimit: number;
  billingPeriod: "monthly" | "yearly" | null;
  expiresAt: string | null;
  consultationCredits: number;
};
