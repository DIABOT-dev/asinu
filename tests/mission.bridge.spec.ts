import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { emitMissionDoneEvent } from "@/lib/bridge";

const originalBridgeUrl = process.env.BRIDGE_URL;
const originalBridgeKey = process.env.BRIDGE_KEY;
const originalBridgeHash = process.env.BRIDGE_HASH_SECRET;
const originalFetch = global.fetch;

describe("bridge emitter", () => {
  beforeEach(() => {
    process.env.BRIDGE_URL = "https://bridge.example.com/events";
    process.env.BRIDGE_KEY = "test-key";
    process.env.BRIDGE_HASH_SECRET = "hash-secret";
  });

  afterEach(() => {
    if (originalBridgeUrl) {
      process.env.BRIDGE_URL = originalBridgeUrl;
    } else {
      delete process.env.BRIDGE_URL;
    }
    if (originalBridgeKey) {
      process.env.BRIDGE_KEY = originalBridgeKey;
    } else {
      delete process.env.BRIDGE_KEY;
    }
    if (originalBridgeHash) {
      process.env.BRIDGE_HASH_SECRET = originalBridgeHash;
    } else {
      delete process.env.BRIDGE_HASH_SECRET;
    }
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("emits mission_done event when bridge is configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn(),
    });
    global.fetch = fetchMock as any;

    const result = await emitMissionDoneEvent({
      userId: "user-123",
      missionId: "mission-123",
      missionCode: "water",
      points: 6,
      ts: "2025-10-07T00:00:00.000Z",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe("https://bridge.example.com/events");
    const requestInit = call[1] as RequestInit;
    expect(requestInit.method).toBe("POST");
    expect(requestInit.headers).toMatchObject({
      Authorization: expect.stringMatching(/^Bearer /),
    });
    const body = JSON.parse(requestInit.body as string);
    expect(body.event).toBe("mission_done");
    expect(body.payload.user_hash).toBeDefined();
    expect(body.payload.user_id).toBeUndefined();
    expect(result.delivered).toBe(true);
  });
});
