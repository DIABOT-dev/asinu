"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/http";

type FieldErrors = Record<string, string>;
type BannerState = { tone: "info" | "error" | "success"; message: string };
type ValidationDetails = {
  fieldErrors?: Record<string, { message?: string }>;
};

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

function normalizeVietnamPhone(input: string): string | null {
  const digits = (input || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) return `+84${digits.slice(1)}`;
  if (digits.startsWith("84")) return `+${digits}`;
  if (digits.startsWith("+84")) return digits;
  if (digits.length >= 9 && digits.length <= 11) return `+84${digits}`;
  return null;
}

const DEFAULT_REDIRECT = "/dashboard";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [authMode, setAuthMode] = useState<"password" | "otp">("password");
  const [formData, setFormData] = useState({
    contactType: "email" as "email" | "phone",
    email: "",
    phone: "",
    password: "",
  });
  const [otpData, setOtpData] = useState({ phone: "", otp: "" });

  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [otpErrors, setOtpErrors] = useState<FieldErrors>({});
  const [otpBanner, setOtpBanner] = useState<BannerState | null>(null);
  const [otpState, setOtpState] = useState({
    sent: false,
    expiresAt: null as string | null,
    sending: false,
    verifying: false,
  });

  const nextTarget = useMemo(() => {
    const redirect = searchParams?.get("next") || searchParams?.get("redirect");
    return redirect ? new URLSearchParams({ next: redirect }).toString() : "";
  }, [searchParams]);
  const redirectTo = useMemo(() => {
    return searchParams?.get("next") || searchParams?.get("redirect") || DEFAULT_REDIRECT;
  }, [searchParams]);

  useEffect(() => {
    const status = searchParams?.get("status");
    if (status === "registered") {
      setBanner({
        tone: "info",
        message: "Tạo tài khoản thành công. Vui lòng đăng nhập để tiếp tục.",
      });
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await apiFetch<{ user_id: string }>("/api/auth/session", {
          cache: "no-store",
        });
        if (!cancelled && session?.user_id) {
          const target =
            searchParams?.get("next") || searchParams?.get("redirect") || DEFAULT_REDIRECT;
          router.replace(target);
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return;
        }
        console.warn("Session check failed", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  const resetForms = (mode: "password" | "otp") => {
    setAuthMode(mode);
    setFieldErrors({});
    setBanner(null);
    setOtpErrors({});
    setOtpBanner(null);
    setOtpState((state) => ({
      ...state,
      sent: false,
      expiresAt: null,
    }));
    if (mode === "password") {
      setFormData((prev) => ({ ...prev, password: "" }));
    } else {
      setOtpData({ phone: "", otp: "" });
    }
  };

  const mapFieldErrors = (details?: ValidationDetails) => {
    const mapped: FieldErrors = {};
    if (!details?.fieldErrors) return mapped;
    Object.entries(details.fieldErrors).forEach(([key, value]) => {
      mapped[key] = value?.message ?? "Trường này không hợp lệ.";
    });
    return mapped;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFieldErrors({});
    setBanner(null);

    const localErrors: FieldErrors = {};
    if (!formData.password) {
      localErrors.password = "Mật khẩu là bắt buộc.";
    }

    if (formData.contactType === "email") {
      if (!formData.email) {
        localErrors.email = "Email là bắt buộc.";
      } else if (!EMAIL_REGEX.test(formData.email.trim())) {
        localErrors.email = "Email không hợp lệ.";
      }
    } else {
      if (!formData.phone) {
        localErrors.phone = "Số điện thoại là bắt buộc.";
      } else if (!normalizeVietnamPhone(formData.phone)) {
        localErrors.phone = "Số điện thoại không hợp lệ.";
      }
    }

    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      return;
    }

    setLoading(true);
    try {
      const params = nextTarget ? `?${nextTarget}` : "";
      const data = await apiFetch<{ redirect_to?: string }>(`/api/auth/email/login${params}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactType: formData.contactType,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
        }),
      });

      router.replace(data.redirect_to || redirectTo);
      return;
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === "VALIDATION_ERROR") {
          setFieldErrors(mapFieldErrors(error.payload?.details as ValidationDetails | undefined));
          return;
        }
        if (error.code === "UNAUTHORIZED") {
          setBanner({ tone: "error", message: error.message });
          return;
        }
        setBanner({ tone: "error", message: error.message });
        return;
      }
      console.error("Login error:", error);
      setBanner({
        tone: "error",
        message: "Không thể xử lý đăng nhập vào lúc này.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    setOtpErrors({});
    setOtpBanner(null);
    if (!otpData.phone) {
      setOtpErrors({ phone: "Số điện thoại là bắt buộc." });
      return;
    }
    const normalized = normalizeVietnamPhone(otpData.phone);
    if (!normalized) {
      setOtpErrors({ phone: "Số điện thoại không hợp lệ." });
      return;
    }

    setOtpState((state) => ({ ...state, sending: true }));
    try {
      const response = await apiFetch<{ message?: string; expires_at?: string }>(
        "/api/auth/phone/send",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: normalized }),
        },
      );
      setOtpState({
        sent: true,
        expiresAt: response.expires_at ?? null,
        sending: false,
        verifying: false,
      });
      setOtpBanner({
        tone: "info",
        message: response.message || "OTP đã được gửi. Vui lòng kiểm tra điện thoại.",
      });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === "VALIDATION_ERROR") {
          setOtpErrors(mapFieldErrors(error.payload?.details as ValidationDetails | undefined));
          return;
        }
        setOtpBanner({ tone: "error", message: error.message });
        return;
      }
      setOtpBanner({
        tone: "error",
        message: "Không thể gửi OTP vào lúc này.",
      });
    } finally {
      setOtpState((state) => ({ ...state, sending: false }));
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setOtpErrors({});
    setOtpBanner(null);

    const local: FieldErrors = {};
    const normalizedPhone = normalizeVietnamPhone(otpData.phone);
    if (!normalizedPhone) {
      local.phone = otpData.phone ? "Số điện thoại không hợp lệ." : "Số điện thoại là bắt buộc.";
    }
    if (!otpData.otp) {
      local.otp = "OTP là bắt buộc.";
    }
    if (Object.keys(local).length > 0) {
      setOtpErrors(local);
      return;
    }

    setOtpState((state) => ({ ...state, verifying: true }));
    try {
      const params = nextTarget ? `?${nextTarget}` : "";
      await apiFetch(`/api/auth/phone/verify${params}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizedPhone, otp: otpData.otp }),
      });
      setOtpBanner({
        tone: "success",
        message: "Đăng nhập thành công. Đang chuyển hướng…",
      });
      router.replace(redirectTo);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === "VALIDATION_ERROR") {
          setOtpErrors(mapFieldErrors(error.payload?.details as ValidationDetails | undefined));
          return;
        }
        setOtpBanner({ tone: "error", message: error.message });
        return;
      }
      setOtpBanner({
        tone: "error",
        message: "Không thể xác thực OTP vào lúc này.",
      });
    } finally {
      setOtpState((state) => ({ ...state, verifying: false }));
    }
  };

  const activeBanner = authMode === "password" ? banner : otpBanner;

  const startOAuth = (provider: "google" | "zalo") => {
    if (typeof window === "undefined") return;
    window.location.href = `/api/auth/${provider}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center py-8 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-primary rounded-full mx-auto mb-4 flex items-center justify-center">
            <span className="text-3xl text-white">🤖</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Chào mừng trở lại</h1>
          <p className="text-gray-600 mt-2">Đăng nhập vào tài khoản DIABOT của bạn</p>
        </div>

        {activeBanner && (
          <div
            className={`mb-4 p-3 rounded-lg border text-sm ${
              activeBanner.tone === "info"
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : activeBanner.tone === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            {activeBanner.message}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Chọn phương thức</label>
            <div className="grid grid-cols-2 bg-gray-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => resetForms("password")}
                className={`py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  authMode === "password"
                    ? "bg-primary text-white"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                Mật khẩu
              </button>
              <button
                type="button"
                onClick={() => resetForms("otp")}
                className={`py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  authMode === "otp" ? "bg-primary text-white" : "text-gray-600 hover:text-gray-800"
                }`}
              >
                OTP (SMS)
              </button>
            </div>
          </div>

          {authMode === "password" ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, contactType: "email" }))}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    formData.contactType === "email"
                      ? "bg-primary text-white"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, contactType: "phone" }))}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    formData.contactType === "phone"
                      ? "bg-primary text-white"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  Số điện thoại
                </button>
              </div>

              {formData.contactType === "email" ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
                      fieldErrors.email ? "border-red-300" : "border-gray-300"
                    }`}
                    placeholder="your@email.com"
                    autoComplete="username"
                  />
                  {fieldErrors.email && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
                      fieldErrors.phone ? "border-red-300" : "border-gray-300"
                    }`}
                    placeholder="0901234567"
                    autoComplete="tel"
                  />
                  {fieldErrors.phone && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.phone}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Hỗ trợ 0/84/+84. Số sẽ được chuẩn hóa sang định dạng quốc tế.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mật khẩu</label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
                    fieldErrors.password ? "border-red-300" : "border-gray-300"
                  }`}
                  placeholder="Nhập mật khẩu"
                  autoComplete="current-password"
                />
                {fieldErrors.password && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>
                )}
                <div className="mt-2 text-right">
                  <Link
                    href="/auth/forgot-password"
                    className="text-sm text-primary hover:text-primary-700"
                  >
                    Quên mật khẩu?
                  </Link>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-primary text-white font-semibold rounded-lg hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-60"
              >
                {loading ? "Đang xử lý..." : "Đăng nhập"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  value={otpData.phone}
                  onChange={(e) => setOtpData((prev) => ({ ...prev, phone: e.target.value }))}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
                    otpErrors.phone ? "border-red-300" : "border-gray-300"
                  }`}
                  placeholder="0901234567"
                  autoComplete="tel"
                />
                {otpErrors.phone && <p className="mt-1 text-sm text-red-600">{otpErrors.phone}</p>}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={otpState.sending}
                  className="flex-1 py-3 px-4 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-60"
                >
                  {otpState.sending ? "Đang gửi..." : otpState.sent ? "Gửi lại OTP" : "Gửi OTP"}
                </button>
                {otpState.expiresAt && (
                  <span className="text-xs text-gray-600">
                    Hết hạn: {new Date(otpState.expiresAt).toLocaleTimeString()}
                  </span>
                )}
              </div>

              {otpState.sent && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nhập OTP</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={otpData.otp}
                    onChange={(e) => setOtpData((prev) => ({ ...prev, otp: e.target.value }))}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
                      otpErrors.otp ? "border-red-300" : "border-gray-300"
                    }`}
                    placeholder="123456"
                  />
                  {otpErrors.otp && <p className="mt-1 text-sm text-red-600">{otpErrors.otp}</p>}
                  <p className="mt-1 text-xs text-gray-500">
                    OTP có hiệu lực khoảng 5 phút. Nhấn “Gửi OTP” để lấy mã mới.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={!otpState.sent || otpState.verifying}
                className="w-full py-3 px-4 bg-primary text-white font-semibold rounded-lg hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-60"
              >
                {otpState.verifying ? "Đang xác thực..." : "Xác nhận OTP"}
              </button>
            </form>
          )}

          <div className="pt-2 border-t border-gray-100">
            <p className="text-center text-xs text-gray-500 mb-3">Hoặc tiếp tục với</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => startOAuth("google")}
                className="flex-1 py-2 px-4 border border-gray-200 rounded-lg text-sm font-medium hover:border-gray-400"
              >
                Google
              </button>
              <button
                type="button"
                onClick={() => startOAuth("zalo")}
                className="flex-1 py-2 px-4 border border-gray-200 rounded-lg text-sm font-medium hover:border-gray-400"
              >
                Zalo
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-sm text-gray-600 mt-6">
          Chưa có tài khoản?{" "}
          <Link href="/auth/register" className="text-primary hover:text-primary-700">
            Đăng ký ngay
          </Link>
        </p>
      </div>
    </div>
  );
}
