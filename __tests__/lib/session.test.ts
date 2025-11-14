import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, getUserFromSession } from "@/lib/session";
import { query } from "@/lib/db_client";

vi.mock("@/lib/db_client", () => ({
  query: vi.fn(),
}));

const queryMock = vi.mocked(query);

beforeEach(() => {
  queryMock.mockReset();
});

describe("lib/session", () => {
  it("creates session rows with metadata", async () => {
    queryMock.mockResolvedValue({ rowCount: 0, rows: [] } as any);
    const { sessionId, expiresAt } = await createSession("user-1", { method: "test" });
    expect(typeof sessionId).toBe("string");
    expect(sessionId).toHaveLength(36);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(queryMock).toHaveBeenCalledTimes(1);
    const args = queryMock.mock.calls[0][1];
    expect(args[1]).toBe("user-1");
    expect(args[2]).toContain("method");
  });

  it("returns null when session not found", async () => {
    queryMock.mockResolvedValueOnce({ rowCount: 0, rows: [] } as any);
    const record = await getUserFromSession("missing");
    expect(record).toBeNull();
  });

  it("maps DB rows into session payloads", async () => {
    const future = new Date(Date.now() + 1000);
    queryMock.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          session_id: "sess-1234",
          user_id: "user-1234",
          email: "test@example.com",
          phone: "+84912345678",
          display_name: "Tester",
          expires_at: future,
        },
      ],
    } as any);
    const record = await getUserFromSession("sess-1234");
    expect(record).not.toBeNull();
    expect(record?.user_id).toBe("user-1234");
    expect(record?.email).toBe("test@example.com");
  });
});
