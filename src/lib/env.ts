const disableChartsRaw = process.env.EXPO_PUBLIC_DISABLE_CHARTS === '1';

// Mobile subscription payment routing.
//   'iap'    — native App Store / Google Play billing
//   'sepay'  — QR + wallet (internal / dev build)
//   'hidden' — Ẩn hoàn toàn flow nâng cấp (cho submit App Review)
type PaymentMethod = 'iap' | 'sepay' | 'hidden';
const rawPaymentMethod = (process.env.EXPO_PUBLIC_PAYMENT_METHOD ?? 'hidden').toLowerCase();
const paymentMethod: PaymentMethod =
  rawPaymentMethod === 'iap' || rawPaymentMethod === 'sepay' || rawPaymentMethod === 'hidden'
    ? (rawPaymentMethod as PaymentMethod)
    : 'hidden';

export const env = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000',
  doctorTenantId: process.env.EXPO_PUBLIC_DOCTOR_TENANT_ID ?? 'clinic-demo',
  disableChartsRaw,
  paymentMethod,
};
