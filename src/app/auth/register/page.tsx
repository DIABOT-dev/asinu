"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/http";

type FieldErrors = Record<string, string>;

const EMAIL_REGEX =
  /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

function normalizeVietnamPhone(input: string): string | null {
  const digits = (input || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) return `+84${digits.slice(1)}`;
  if (digits.startsWith("84")) return `+${digits}`;
  if (digits.startsWith("+84")) return digits;
  if (digits.length >= 9 && digits.length <= 11) return `+84${digits}`;
  return null;
}

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [formData, setFormData] = useState({
    contactType: "email" as "email" | "phone",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    agreeTerms: false,
    agreeAI: false,
  });

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"terms" | "privacy">("terms");
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<{ tone: "info" | "error"; message: string } | null>(null);

  useEffect(() => {
    const legal = searchParams?.get("legal");
    if (legal === "terms" || legal === "privacy") {
      setActiveTab(legal);
      setModalOpen(true);
    }
  }, [searchParams]);

  const payload = useMemo(
    () => ({
      contactType: formData.contactType,
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      password: formData.password,
      confirmPassword: formData.confirmPassword,
      agreeTerms: formData.agreeTerms,
      agreeAI: formData.agreeAI,
    }),
    [formData],
  );

  const validateForm = () => {
    const errors: FieldErrors = {};

    if (!formData.agreeTerms) {
      errors.agreeTerms = "Bạn phải đồng ý với Điều khoản sử dụng.";
    }
    if (!formData.agreeAI) {
      errors.agreeAI = "Bạn phải đồng ý cho phép sử dụng thông tin cá nhân hoá AI.";
    }

    if (!formData.password || !PASSWORD_REGEX.test(formData.password)) {
      errors.password = "Mật khẩu phải từ 8 ký tự, gồm chữ và số.";
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = "Mật khẩu xác nhận không khớp.";
    }

    if (formData.contactType === "email") {
      if (!formData.email) {
        errors.email = "Email là bắt buộc.";
      } else if (!EMAIL_REGEX.test(formData.email.trim())) {
        errors.email = "Email không hợp lệ.";
      }
    } else {
      if (!formData.phone) {
        errors.phone = "Số điện thoại là bắt buộc.";
      } else if (!normalizeVietnamPhone(formData.phone)) {
        errors.phone = "Số điện thoại không hợp lệ.";
      }
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBanner(null);

    const newErrors = validateForm();
    setFieldErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      return;
    }

    setLoading(true);
    try {
      await apiFetch("/api/auth/email/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setBanner({
        tone: "info",
        message: "Tạo tài khoản thành công. Đang chuyển tới trang đăng nhập...",
      });
      setTimeout(() => {
        router.push("/auth/login?status=registered");
      }, 1200);
      return;
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === "VALIDATION_ERROR") {
          const details = error.payload?.details as
            | Array<{ field?: string; message?: string }>
            | undefined;
          const mapped: FieldErrors = {};
          details?.forEach((detail) => {
            if (detail.field) {
              mapped[detail.field] = detail.message ?? "Trường không hợp lệ.";
            }
          });
          setFieldErrors(mapped);
          return;
        }
        if (error.code === "CONFLICT") {
          if (error.message.includes("Email")) {
            setFieldErrors({ email: error.message });
          } else if (error.message.includes("Số điện thoại")) {
            setFieldErrors({ phone: error.message });
          } else {
            setBanner({ tone: "error", message: error.message });
          }
          return;
        }
        setBanner({
          tone: "error",
          message: error.message,
        });
        return;
      }
      console.error("Register error:", error);
      setBanner({
        tone: "error",
        message: "Đăng ký thất bại. Vui lòng thử lại sau.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-primary/20 py-8 px-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-primary rounded-full mx-auto mb-4 flex items-center justify-center">
            <span className="text-3xl text-white" aria-hidden>
              💙
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Đăng ký DIABOT</h1>
          <p className="text-gray-600 mt-2">Tạo tài khoản để bắt đầu hành trình sức khỏe</p>
        </div>

        {banner && (
          <div
            className={`mb-4 p-3 rounded-lg border text-sm ${
              banner.tone === "info"
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            {banner.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Thông tin liên hệ</label>
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
              />
              {fieldErrors.email && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Số điện thoại</label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
                  fieldErrors.phone ? "border-red-300" : "border-gray-300"
                }`}
                placeholder="0901234567"
              />
              {fieldErrors.phone && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.phone}</p>
              )}
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
              placeholder="Ít nhất 8 ký tự, gồm chữ và số"
              autoComplete="new-password"
            />
            {fieldErrors.password && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nhập lại mật khẩu</label>
            <input
              type="password"
              required
              value={formData.confirmPassword}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  confirmPassword: e.target.value,
                }))
              }
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
                fieldErrors.confirmPassword ? "border-red-300" : "border-gray-300"
              }`}
              placeholder="Xác nhận mật khẩu"
              autoComplete="new-password"
            />
            {fieldErrors.confirmPassword && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.confirmPassword}</p>
            )}
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={formData.agreeTerms}
                onChange={(e) => setFormData((prev) => ({ ...prev, agreeTerms: e.target.checked }))}
              />
              <span className="text-sm text-gray-700">
                Tôi đồng ý với{" "}
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => {
                    setActiveTab("terms");
                    setModalOpen(true);
                  }}
                >
                  Điều khoản sử dụng
                </button>
                .
              </span>
            </label>
            {fieldErrors.agreeTerms && (
              <p className="text-sm text-red-600">{fieldErrors.agreeTerms}</p>
            )}

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={formData.agreeAI}
                onChange={(e) => setFormData((prev) => ({ ...prev, agreeAI: e.target.checked }))}
              />
              <span className="text-sm text-gray-700">
                Tôi đồng ý cung cấp dữ liệu để cá nhân hoá trải nghiệm AI.
              </span>
            </label>
            {fieldErrors.agreeAI && (
              <p className="text-sm text-red-600">{fieldErrors.agreeAI}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-primary text-white font-semibold rounded-lg hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-60"
          >
            {loading ? "Đang xử lý..." : "Tạo tài khoản"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          Đã có tài khoản?{" "}
          <Link href="/auth/login" className="text-primary hover:text-primary-700">
            Đăng nhập
          </Link>
        </p>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div className="flex gap-2 text-sm font-medium">
                <button
                  className={`px-3 py-2 rounded-md ${
                    activeTab === "terms" ? "bg-primary text-white" : "text-gray-600"
                  }`}
                  onClick={() => setActiveTab("terms")}
                >
                  Điều khoản
                </button>
                <button
                  className={`px-3 py-2 rounded-md ${
                    activeTab === "privacy" ? "bg-primary text-white" : "text-gray-600"
                  }`}
                  onClick={() => setActiveTab("privacy")}
                >
                  Quyền riêng tư
                </button>
              </div>
              <button
                className="text-sm text-gray-500 hover:text-gray-700"
                onClick={() => setModalOpen(false)}
              >
                Đóng
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto px-6 py-4 text-sm leading-relaxed text-gray-700 space-y-4">
              {activeTab === "terms" ? (
                <>
                  <p>
                    Khi sử dụng Asinu, bạn đồng ý cung cấp thông tin trung thực và sử dụng dữ liệu
                    theo đúng mục đích theo dõi sức khỏe cá nhân. Bạn chịu trách nhiệm bảo mật tài
                    khoản và mật khẩu của mình.
                  </p>
                  <p>
                    Asinu có quyền cập nhật điều khoản và sẽ thông báo trước khi áp dụng. Tiếp tục
                    sử dụng dịch vụ đồng nghĩa với việc bạn chấp nhận các cập nhật đó.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Chúng tôi chỉ thu thập thông tin cần thiết để vận hành tính năng theo dõi sức
                    khỏe. Dữ liệu được lưu trữ trên hạ tầng Viettel Cloud và được mã hóa khi truyền
                    tải.
                  </p>
                  <p>
                    Bạn có thể yêu cầu xóa dữ liệu bất cứ lúc nào qua mục Cài đặt &gt; Xóa tài
                    khoản. Thắc mắc thêm vui lòng liên hệ team Asinu.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
