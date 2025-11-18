import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  emitMissionDoneEvent,
  emitRewardRedeemedEvent,
  emitDonationEvent,
} from "@/lib/bridge";

const savedUrl = process.env.BRIDGE_URL;
const savedKey = process.env.BRIDGE_KEY;

describe("bridge emitter (env missing)", () => {
  beforeEach(() => {
    delete process.env.BRIDGE_URL;
    delete process.env.BRIDGE_KEY;
  });

  afterEach(() => {
    if (savedUrl) {
      process.env.BRIDGE_URL = savedUrl;
    }
    if (savedKey) {
      process.env.BRIDGE_KEY = savedKey;
    }
  });

  it("skips mission events when bridge env is not configured", async () => {
    const result = await emitMissionDoneEvent({
      userId: "user-1",
      missionId: "mission-1",
      missionCode: "water",
      points: 4,
      ts: new Date().toISOString(),
    });
    expect(result.skipped).toBe(true);
    expect(result.delivered).toBe(false);
  });

  it("skips reward events when bridge env is not configured", async () => {
    const result = await emitRewardRedeemedEvent({
      userId: "user-1",
      itemId: "item-1",
      itemType: "badge",
      itemTitle: "Daily Hero",
      cost: 10,
      balance: 90,
      ts: new Date().toISOString(),
    });
    expect(result.skipped).toBe(true);
    expect(result.delivered).toBe(false);
  });

  it("skips donation events when bridge env is not configured", async () => {
    const result = await emitDonationEvent({
      userId: "user-1",
      provider: "smoke",
      amountPoints: 50,
      amountVnd: 0,
      campaign: "test",
      ts: new Date().toISOString(),
    });
    expect(result.skipped).toBe(true);
    expect(result.delivered).toBe(false);
  });
});
