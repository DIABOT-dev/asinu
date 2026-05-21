/**
 * Backend API wrapper for IAP — only the HTTP layer. The native
 * purchasing flow (StoreKit / Play Billing client) lives in iap.service.ts.
 */

import { apiClient } from '../../lib/apiClient';
import type {
  IapProductsResponse,
  IapVerifyRequest,
  IapVerifyResponse,
} from './iap.types';

export const iapApi = {
  /**
   * Static catalogue — used by the client to show pricing before StoreKit
   * resolves on slow networks. Public endpoint, no auth required.
   */
  async fetchProducts() {
    return apiClient<IapProductsResponse>('/api/iap/products');
  },

  /**
   * Send the platform receipt to the backend for verification + Premium
   * activation. Backend verifies with Apple / Google and writes to
   * iap_receipts + subscriptions atomically. Idempotent by
   * transaction_id; replaying the same receipt is safe.
   */
  async verifyReceipt(payload: IapVerifyRequest) {
    return apiClient<IapVerifyResponse>('/api/iap/verify', {
      method: 'POST',
      body: payload,
      timeoutMs: 30000,
    });
  },
};
