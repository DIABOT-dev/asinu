import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRewardCatalog, buildDonationPaymentUrl } from "@/modules/rewards/service";
import { query } from "@/lib/db_client";
import { getRewardBalance } from "@/modules/rewards/ledger";

vi.mock("@/lib/db_client", () => {
  const queryMock = vi.fn();
  return {
    query: queryMock,
    getPool: vi.fn(() => ({
      connect: vi.fn(() => ({
        query: vi.fn(),
        release: vi.fn(),
      })),
    })),
  };
});

vi.mock("@/modules/rewards/ledger", () => ({
  getRewardBalance: vi.fn(),
  getRewardLedger: vi.fn(),
  debitRewardPoints: vi.fn(),
}));

const mockedQuery = query as unknown as vi.Mock;
const mockedBalance = getRewardBalance as unknown as vi.Mock;

afterEach(() => {
  mockedQuery.mockReset();
  mockedBalance.mockReset();
});

describe("fetchRewardCatalog", () => {
  it("marks items as redeemable only when balance and inventory allow", async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: "item-1",
            title: "Voucher nước",
            subtitle: "Sâm Việt",
            item_type: "voucher",
            cost: 60,
            inventory: null,
            metadata: {},
          },
          {
            id: "item-2",
            title: "Combo khám",
            subtitle: null,
            item_type: "physical",
            cost: 100,
            inventory: 0,
            metadata: {},
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    mockedBalance.mockResolvedValue(80);

    const payload = await fetchRewardCatalog("user-1");

    expect(payload.balance).toBe(80);
    expect(payload.items[0].can_redeem).toBe(true);
    expect(payload.items[1].can_redeem).toBe(false);
  });
});

describe("buildDonationPaymentUrl", () => {
  it("returns link when amount is positive", () => {
    const url = buildDonationPaymentUrl("vnpay", 100000, "tree");
    expect(url).toContain("vnpay");
    expect(url).toContain("amount=100000");
    expect(url).toContain("campaign=tree");
  });

  it("returns null for zero amount", () => {
    expect(buildDonationPaymentUrl("vnpay", 0, null)).toBeNull();
  });
});
