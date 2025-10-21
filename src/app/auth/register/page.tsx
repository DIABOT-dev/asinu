"use client";

/**
 * /auth/register — ANORA (MVP Freeze)
 * - Giữ logic Supabase signUp như cũ
 * - Khi chọn Số điện thoại: normalize phone -> map sang email ảo `${E164NoPlus}@phone.anora`
 * - "Điều khoản sử dụng" & "Chính sách quyền riêng tư": mở tại chỗ bằng Modal + Tabs (không rời trang)
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [formData, setFormData] = useState({
    contactType: 'email' as 'email' | 'phone',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
    agreeAI: false,
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // === Modal pháp lý (mở tại chỗ) ===
  const [isLegalOpen, setIsLegalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>('terms');

  // Hỗ trợ deep-link: /auth/register?legal=terms|privacy
  useEffect(() => {
    const legal = searchParams?.get('legal');
    if (legal === 'terms' || legal === 'privacy') {
      setActiveTab(legal);
      setIsLegalOpen(true);
    }
  }, [searchParams]);

  // Chuẩn hóa số điện thoại -> E.164 (VN giả định). Ví dụ: 0901234567 -> +84901234567
  function normalizePhoneToE164VN(input: string) {
    const onlyDigits = input.replace(/\D/g, '');
    if (!onlyDigits) return null;
    if (onlyDigits.startsWith('0')) return `+84${onlyDigits.slice(1)}`;
    if (onlyDigits.startsWith('84')) return `+${onlyDigits}`;
    if (onlyDigits.startsWith('+' )) return onlyDigits; // đã chuẩn
    // fallback: coi là số VN thiếu 0 đầu
    return `+84${onlyDigits}`;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // === Validation UI-level (giữ nguyên tinh thần cũ) ===
    const newErrors: Record<string, string> = {};

    if (formData.contactType === 'email' && !formData.email) {
      newErrors.email = 'Email là bắt buộc';
    }
    if (formData.contactType === 'phone' && !formData.phone) {
      newErrors.phone = 'Số điện thoại là bắt buộc';
    }
    if (!formData.password || formData.password.length < 6) {
      newErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự';
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Mật khẩu xác nhận không khớp';
    }
    if (!formData.agreeTerms) {
      newErrors.agreeTerms = 'Bạn phải đồng ý với Điều khoản sử dụng';
    }
    if (!formData.agreeAI) {
      newErrors.agreeAI = 'Bạn phải đồng ý cho phép sử dụng thông tin cá nhân hóa AI';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      // === PATCH: chuẩn bị email đăng ký ===
      let signUpEmail = formData.email;
      let finalPhoneE164: string | null = null;

      if (formData.contactType === 'phone') {
        finalPhoneE164 = normalizePhoneToE164VN(formData.phone);
        if (!finalPhoneE164) {
          setLoading(false);
          return setErrors({ phone: 'Số điện thoại không hợp lệ' });
        }
        // email ảo: bỏ dấu '+' cho gọn
        const emailAlias = `${finalPhoneE164.replace('+', '')}@phone.anora`;
        signUpEmail = emailAlias;
      }

      const { data, error } = await supabase.auth.signUp({
        email: signUpEmail,
        password: formData.password,
        options: {
          emailRedirectTo: `${location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      // (Khuyến nghị) Sau khi signUp thành công, nhóm Auth có thể gọi API của nhóm Profile để lưu profiles.phone = finalPhoneE164
      // Ví dụ:
      // if (finalPhoneE164 && data.user?.id) {
      //   await fetch('/api/profiles/create', {
      //     method: 'POST',
      //     headers: { 'Content-Type': 'application/json' },
      //     body: JSON.stringify({
      //       user_id: data.user.id,
      //       phone: finalPhoneE164,
      //     }),
      //   });
      // }

      router.push('/auth/login?message=check_email_for_confirmation');
    } catch (error) {
      console.error('Registration error:', error);
      setErrors({ general: 'Đăng ký thất bại. Vui lòng thử lại.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-primary/20 py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-primary rounded-full mx-auto mb-4 flex items-center justify-center">
            {/* Thay icon tạm thời: 💙 (có thể đổi thành <Image src="/logo.svg" /> sau) */}
            <span className="text-3xl text-white" aria-hidden>💙</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Đăng ký DIABOT</h1>
          <p className="text-gray-600 mt-2">Tạo tài khoản để bắt đầu hành trình sức khỏe</p>
        </div>

        {errors.general && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {errors.general}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
          {/* Contact Type Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Thông tin liên hệ</label>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, contactType: 'email' }))}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  formData.contactType === 'email' 
                    ? 'bg-primary text-white' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Email
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, contactType: 'phone' }))}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  formData.contactType === 'phone' 
                    ? 'bg-primary text-white' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Số điện thoại
              </button>
            </div>
          </div>

          {/* Email or Phone Input */}
          {formData.contactType === 'email' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
                  errors.email ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="your@email.com"
              />
              {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Số điện thoại</label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
                  errors.phone ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="0901234567"
              />
              {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
              <p className="mt-1 text-xs text-gray-500">
                Số điện thoại của bạn sẽ được dùng làm tên đăng nhập. Hiện chưa yêu cầu OTP.
              </p>
            </div>
          )}

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mật khẩu</label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
                errors.password ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Tối thiểu 6 ký tự"
            />
            {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Xác nhận mật khẩu</label>
            <input
              type="password"
              required
              value={formData.confirmPassword}
              onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
                errors.confirmPassword ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Nhập lại mật khẩu"
            />
            {errors.confirmPassword && <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>}
          </div>

          {/* Terms Agreement */}
          <div>
            <div className="space-y-3">
              <label className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  checked={formData.agreeTerms}
                  onChange={(e) => setFormData(prev => ({ ...prev, agreeTerms: e.target.checked }))}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary mt-1"
                />
                <span className="text-sm text-gray-700">
                  Tôi đồng ý với{' '}
                  {/* Intercept click để mở modal tại chỗ, vẫn giữ href để Open in new tab */}
                  <Link
                    href="/terms"
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveTab('terms');
                      setIsLegalOpen(true);
                      router.replace('?legal=terms', { scroll: false });
                    }}
                    className="text-primary hover:text-primary-700 underline"
                  >
                    Điều khoản sử dụng
                  </Link>
                  {' '}và{' '}
                  <Link
                    href="/privacy"
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveTab('privacy');
                      setIsLegalOpen(true);
                      router.replace('?legal=privacy', { scroll: false });
                    }}
                    className="text-primary hover:text-primary-700 underline"
                  >
                    Chính sách quyền riêng tư
                  </Link>
                </span>
              </label>
              {errors.agreeTerms && <p className="text-sm text-red-600">{errors.agreeTerms}</p>}
            </div>
          </div>

          {/* AI Data Usage Agreement */}
          <div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <label className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  checked={formData.agreeAI}
                  onChange={(e) => setFormData(prev => ({ ...prev, agreeAI: e.target.checked }))}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary mt-1"
                />
                <div className="text-sm">
                  <p className="font-medium text-gray-800 mb-1">Đồng ý sử dụng AI cá nhân hóa</p>
                  <p className="text-gray-600">
                    Tôi đồng ý cho DIABOT sử dụng dữ liệu sức khỏe của tôi để cung cấp các gợi ý và 
                    khuyến nghị được cá nhân hóa. Dữ liệu sẽ được bảo mật và chỉ sử dụng để cải thiện trải nghiệm của tôi.
                  </p>
                </div>
              </label>
              {errors.agreeAI && <p className="mt-2 text-sm text-red-600">{errors.agreeAI}</p>}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-3 px-4 rounded-lg font-medium hover:bg-primary-700 focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Đang đăng ký...' : 'Đăng ký'}
          </button>

          {/* Login Link */}
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Đã có tài khoản?{' '}
              <Link href="/auth/login" className="text-primary hover:text-primary-700 font-medium">
                Đăng nhập
              </Link>
            </p>
          </div>
        </form>

        {/* ===== Modal Điều khoản/Privacy (tại chỗ) ===== */}
        {isLegalOpen && (
          <div className="fixed inset-0 z-50">
            {/* backdrop */}
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => {
                setIsLegalOpen(false);
                router.replace('/auth/register', { scroll: false });
              }}
              aria-hidden="true"
            />
            {/* dialog */}
            <div
              role="dialog"
              aria-modal="true"
              className="absolute inset-x-0 top-10 mx-auto w-[95%] max-w-2xl rounded-2xl bg-white shadow-xl"
            >
              {/* header */}
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('terms')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium ${activeTab === 'terms' ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    Điều khoản
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('privacy')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium ${activeTab === 'privacy' ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    Quyền riêng tư
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsLegalOpen(false);
                    router.replace('/auth/register', { scroll: false });
                  }}
                  className="px-3 py-1.5 rounded-md border text-sm hover:bg-gray-50"
                  aria-label="Đóng"
                >
                  Đóng
                </button>
              </div>

              {/* body: nhúng nội dung có sẵn qua iframe */}
              <div className="p-0">
                {activeTab === 'terms' ? (
                  <iframe
                    src="/terms?embed=1"
                    className="w-full h-[70vh] rounded-b-2xl"
                    title="Điều khoản sử dụng"
                  />
                ) : (
                  <iframe
                    src="/privacy?embed=1"
                    className="w-full h-[70vh] rounded-b-2xl"
                    title="Chính sách quyền riêng tư"
                  />
                )}
              </div>
            </div>
          </div>
        )}
        {/* ===== End Modal ===== */}
      </div>
    </div>
  );
}
