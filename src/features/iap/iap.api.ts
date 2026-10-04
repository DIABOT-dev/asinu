/**
 * Backend API wrapper for IAP — only the HTTP layer. The native
 * purchasing flow (native store client) lives in iap.service.ts.
 */

import { apiClient } from '../../lib/apiClient';
import { Platform } from 'react-native';
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
    return apiClient<IapProductsResponse>(`/api/iap/products?platform=${Platform.OS === 'ios' ? 'apple' : 'google'}`);
  },

  /**
   * Send the platform receipt to the backend for verification and activation.
   * Backend verifies with Apple / Google and writes the receipt and household
   * entitlement. Idempotent by
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
