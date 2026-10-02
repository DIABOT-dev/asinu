/**
 * Shared types between the native store client and the backend
 * verify endpoint. Keep these in sync with backend/src/services/payment/iap.service.js.
 */

export type IapPlatform = 'apple' | 'google';

export type IapProduct = {
  id: string;
  plan_code: 'antam_1' | 'antam_2' | 'antam_4' | 'antam_8';
  plan_name: string;
  billing_period: 'monthly' | 'yearly';
  plan_months: number;
  protected_members: number;
  consultation_credits: number;
  display_price_vnd: number;
};

/** Returned by GET /api/iap/products */
export type IapProductsResponse = {
  ok: boolean;
  apple_bundle_id: string;
  google_package_name: string;
  products: IapProduct[];
};

/** Sent to POST /api/iap/verify */
export type IapVerifyRequest = {
  platform: IapPlatform;
  productId: string;
  // Google
  purchaseToken?: string;
  // Apple v2 (preferred)
  signedTransaction?: string;
  // Apple legacy
  receiptData?: string;
};

/** 200 from POST /api/iap/verify */
export type IapVerifySuccess = {
  ok: true;
  expiresAt: string;
  planCode: IapProduct['plan_code'];
  billingPeriod: IapProduct['billing_period'];
  platform: IapPlatform;
  alreadyProcessed?: boolean;
};

/** 402 from POST /api/iap/verify */
export type IapVerifyFailure = {
  ok: false;
  code:
    | 'APPLE_VERIFIER_NOT_IMPLEMENTED'
    | 'GOOGLE_VERIFIER_NOT_IMPLEMENTED'
    | 'INVALID_PAYLOAD'
    | 'UNKNOWN_PLATFORM'
    | 'UNKNOWN_PRODUCT'
    | string;
  error: string;
};

export type IapVerifyResponse = IapVerifySuccess | IapVerifyFailure;
