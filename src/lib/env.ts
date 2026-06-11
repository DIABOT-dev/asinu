const disableChartsRaw = process.env.EXPO_PUBLIC_DISABLE_CHARTS === '1';

// Mobile payment routing — App Store / Play Store cấm dùng QR/wallet ngoài
// platform billing để bán dịch vụ số. 3 mode:
//   'iap'    — Apple IAP + Google Play Billing (chuẩn store, đang scaffold)
//   'sepay'  — Cơ chế cũ (QR + wallet) — chỉ dùng trên web hoặc internal build
//   'hidden' — Ẩn hoàn toàn flow nâng cấp Premium (cho submit App Review)
type PaymentMethod = 'iap' | 'sepay' | 'hidden';
const rawPaymentMethod = (process.env.EXPO_PUBLIC_PAYMENT_METHOD ?? 'hidden').toLowerCase();
const paymentMethod: PaymentMethod =
  rawPaymentMethod === 'iap' || rawPaymentMethod === 'sepay' || rawPaymentMethod === 'hidden'
    ? (rawPaymentMethod as PaymentMethod)
    : 'hidden';

// Product IDs to register on Apple App Store Connect + Google Play Console.
// Public — không phải bí mật. Cùng ID giữa 2 platform để backend route dễ.
const iapProductMonthly = process.env.EXPO_PUBLIC_IAP_PRODUCT_MONTHLY ?? 'asinu.premium.monthly';
const iapProductYearly = process.env.EXPO_PUBLIC_IAP_PRODUCT_YEARLY ?? 'asinu.premium.yearly';

export const env = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000',
  disableChartsRaw,
  paymentMethod,
  iapProductMonthly,
  iapProductYearly,
};
