import React from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "@/app/auth/login/page";

const replaceMock = vi.hoisted(() => vi.fn());
const apiFetchMock = vi.hoisted(() => vi.fn());
const ApiErrorMock = vi.hoisted(
  () =>
    class ApiError extends Error {
      code?: string;
      status?: number;
      payload?: unknown;
      constructor(message: string, opts: { code?: string; status?: number; payload?: unknown } = {}) {
        super(message);
        this.code = opts.code;
        this.status = opts.status ?? 400;
        this.payload = opts.payload;
      }
    },
);

vi.mock("next/navigation", () => {
  return {
    useRouter: () => ({ replace: replaceMock }),
    useSearchParams: () => new URLSearchParams(""),
  };
});

vi.mock("@/lib/http", () => {
  return {
    apiFetch: apiFetchMock,
    ApiError: ApiErrorMock,
  };
});

describe("LoginPage", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    apiFetchMock.mockReset();
    apiFetchMock.mockRejectedValueOnce(new ApiErrorMock("unauthorized", { status: 401 }));
  });

  it("supports OTP flow end-to-end", async () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "OTP (SMS)" }));

    const phoneInput = screen.getByPlaceholderText("0901234567");
    fireEvent.change(phoneInput, { target: { value: "0912345678" } });

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    apiFetchMock.mockResolvedValueOnce({ message: "OTP_SENT", expires_at: expiresAt });

    fireEvent.click(screen.getByRole("button", { name: /gửi otp/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/auth/phone/send",
        expect.objectContaining({ method: "POST" }),
      );
    });

    apiFetchMock.mockResolvedValueOnce({ code: "OTP_VERIFIED" });

    const otpInput = await screen.findByPlaceholderText("123456");
    fireEvent.change(otpInput, { target: { value: "123456" } });

    fireEvent.click(screen.getByRole("button", { name: /xác nhận otp/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/auth/phone/verify",
        expect.objectContaining({ method: "POST" }),
      );
    });

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalled();
    });
  });
});
