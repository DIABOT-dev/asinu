/**
 * StoreKit / Play Billing client wrapper.
 *
 * Status: SCAFFOLD ONLY. `react-native-iap` (or a chosen successor like
 * `expo-iap`) has not been installed yet. When wiring the real library:
 *
 *   1. `npm install react-native-iap` and run `npx pod-install` for iOS.
 *   2. Add the App Store / Play Console product IDs from src/lib/env.ts.
 *   3. Replace each `throw new Error('NOT_IMPLEMENTED')` below with the
 *      corresponding library call.
 *   4. Hook `initialize()` into the app entry (e.g. /app/_layout.tsx)
 *      so listeners fire before the user reaches the upgrade screen.
 *
 * The shape below mirrors what /app/subscription/iap.tsx will consume so
 * the screen can be built (and TS-typed) before the native lib lands.
 */

import { Platform } from 'react-native';
import { env } from '../../lib/env';
import { iapApi } from './iap.api';
import type { IapProduct, IapVerifyResponse } from './iap.types';

export type LocalProduct = IapProduct & {
  // Localised price formatted by the platform (e.g. "199.000 ₫" on iOS,
  // "₫199,000" on Android). When using the stub fallback we render the
  // display_price_vnd field instead.
  localizedPrice?: string;
};

export type PurchaseResult =
  | { kind: 'success'; verify: IapVerifyResponse }
  | { kind: 'cancelled' }
  | { kind: 'failed'; error: string };

/**
 * Initialise the platform billing connection. Call once at app start.
 * SAFE TO CALL when react-native-iap isn't installed — it just no-ops.
 */
export async function initializeIap(): Promise<void> {
  if (env.paymentMethod !== 'iap') return; // off by default

  try {
    // const RNIap = require('react-native-iap');
    // await RNIap.initConnection();
    // RNIap.purchaseUpdatedListener(...) and purchaseErrorListener(...) go here.
    console.warn('[iap] react-native-iap not installed; initializeIap is a no-op');
  } catch (err) {
    console.warn('[iap] init failed:', err);
  }
}

/**
 * Fetch products to display on the upgrade screen. Falls back to the
 * backend's static catalogue when the native lib isn't available so the
 * upgrade UI can still render a price.
 */
export async function fetchAvailableProducts(): Promise<LocalProduct[]> {
  // 1. Always ask the backend for the canonical product IDs first — it
  //    is the source of truth and the client uses it to validate the
  //    set returned by StoreKit / Play Billing.
  const backendCatalog = await iapApi.fetchProducts();

  if (env.paymentMethod !== 'iap') {
    // Not in IAP mode — return backend catalog only, no native query.
    return backendCatalog.products;
  }

  try {
    // const RNIap = require('react-native-iap');
    // const skus = backendCatalog.products.map(p => p.id);
    // const native = Platform.OS === 'ios'
    //   ? await RNIap.getSubscriptions({ skus })
    //   : await RNIap.getSubscriptions({ skus });
    // return backendCatalog.products.map(bp => {
    //   const match = native.find(n => n.productId === bp.id);
    //   return { ...bp, localizedPrice: match?.localizedPrice };
    // });
    throw new Error('NOT_IMPLEMENTED');
  } catch {
    // Native unavailable → fall back to backend prices only.
    return backendCatalog.products;
  }
}

/**
 * Start a subscription purchase for the given product. Returns the
 * verification result so the upgrade screen can show success / failure.
 */
export async function purchaseSubscription(productId: string): Promise<PurchaseResult> {
  if (env.paymentMethod !== 'iap') {
    return { kind: 'failed', error: 'IAP mode is not enabled' };
  }

  try {
    // const RNIap = require('react-native-iap');
    // const purchase = await RNIap.requestSubscription({ sku: productId });
    //
    // const verify = await iapApi.verifyReceipt({
    //   platform: Platform.OS === 'ios' ? 'apple' : 'google',
    //   productId,
    //   signedTransaction: Platform.OS === 'ios' ? (purchase as any).transactionReceipt : undefined,
    //   purchaseToken: Platform.OS === 'android' ? (purchase as any).purchaseToken : undefined,
    // });
    //
    // if (verify.ok) {
    //   await RNIap.finishTransaction({ purchase, isConsumable: false });
    //   return { kind: 'success', verify };
    // }
    // return { kind: 'failed', error: verify.error };
    throw new Error('NOT_IMPLEMENTED — install react-native-iap and uncomment iap.service.ts');
  } catch (err: any) {
    if (String(err?.message || '').toLowerCase().includes('cancel')) {
      return { kind: 'cancelled' };
    }
    return { kind: 'failed', error: err?.message || String(err) };
  }
}

/**
 * Restore purchases — call from a "Restore purchases" button so users
 * who re-installed the app, or logged in on a new device, get their
 * Premium back without paying again.
 */
export async function restorePurchases(): Promise<{ restored: number; errors: string[] }> {
  if (env.paymentMethod !== 'iap') return { restored: 0, errors: ['IAP mode disabled'] };

  try {
    // const RNIap = require('react-native-iap');
    // const purchases = await RNIap.getAvailablePurchases();
    // let restored = 0;
    // const errors: string[] = [];
    // for (const p of purchases) {
    //   const verify = await iapApi.verifyReceipt({...});
    //   if (verify.ok) restored++;
    //   else errors.push(verify.error);
    // }
    // return { restored, errors };
    return { restored: 0, errors: ['NOT_IMPLEMENTED'] };
  } catch (err: any) {
    return { restored: 0, errors: [err?.message || String(err)] };
  }
}

// Helper exposed for tests / debug.
export const _iapInternals = {
  resolveProductId(plan: 'monthly' | 'yearly'): string {
    return plan === 'monthly' ? env.iapProductMonthly : env.iapProductYearly;
  },
  platformKey(): 'apple' | 'google' {
    return Platform.OS === 'ios' ? 'apple' : 'google';
  },
};
