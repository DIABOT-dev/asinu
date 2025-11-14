import { beforeEach, describe, expect, it, vi } from "vitest";
import { issueOtp, verifyOtp } from "@/modules/auth/otpService";
import { query } from "@/lib/db_client";

vi.mock("@/lib/db_client", () => ({
  query: vi.fn(),
}));

const queryMock = vi.mocked(query);

beforeEach(() => {
  queryMock.mockReset();
});

describe("otpService", () => {
  it("issues OTP with normalized phone", async () => {
    queryMock.mockResolvedValue({ rowCount: 0, rows: [] } as any);
    const result = await issueOtp("0912 345 678");
    expect(result.phone).toBe("+84912345678");
    expect(result.otp).toBe("123456");
    expect(queryMock).toHaveBeenCalledTimes(3);
    const insertArgs = queryMock.mock.calls[2];
    expect(insertArgs[1][0]).toBe("+84912345678");
  });

  it("verifies OTP and marks as consumed", async () => {
    const future = new Date(Date.now() + 60_000);
    queryMock
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: "otp-1", expires_at: future, otp: "123456" }],
      } as any)
      .mockResolvedValueOnce({ rowCount: 1 } as any);

    const result = await verifyOtp("+84912345678", "123456");
    expect(result).toEqual({ ok: true, phone: "+84912345678" });
    expect(queryMock).toHaveBeenCalledTimes(2);
  });
});
