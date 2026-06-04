/**
 * StoreKit 2 / Google Play Billing v6 client wrapper around `expo-iap`.
 *
 * The library is event-based (`purchaseUpdatedListener` / `purchaseErrorListener`),
 * but our UI wants Promise-based purchase calls. The flow below uses
 * `requestPurchase()` to *kick off* the native sheet and a pair of
 * one-shot listeners to surface success / failure to the awaiting caller.
 *
 * IMPORTANT lifecycle:
 *   - `initializeIap()` MUST be called once at app entry so the global
 *     purchaseUpdated/Error listeners are alive while the app is in
 *     foreground (needed for renewals + restored purchases).
 *   - Backend verification is the source of truth — never trust the
 *     local receipt before /api/iap/verify returns ok.
 *   - `finishTransaction` is called ONLY after the backend confirms,
 *     so a crash mid-flow leaves the transaction queued and is replayed
 *     on the next app launch.
 */

import { Platform } from 'react-native';
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  getAvailablePurchases,
  purchaseUpdatedListener,
  purchaseErrorListener,
  ErrorCode,
  type Purchase,
  type SubscriptionProduct,
} from 'expo-iap';
import { env } from '../../lib/env';
import { iapApi } from './iap.api';
import type { IapProduct, IapVerifyResponse } from './iap.types';

export type LocalProduct = IapProduct & {
  // Localised price formatted by the platform (e.g. "199.000 ₫" on iOS,
  // "₫199,000" on Android). Falls back to the backend's display price
  // when the native lib is unavailable.
  localizedPrice?: string;
  // Kept so Android subscription purchase can pass the right offerToken.
  nativeProduct?: SubscriptionProduct;
};

export type PurchaseResult =
  | { kind: 'success'; verify: IapVerifyResponse }
  | { kind: 'cancelled' }
  | { kind: 'failed'; error: string };

// ─── Connection state ─────────────────────────────────────────────────

let connected = false;
let initError: string | null = null;
let purchaseSub: { remove: () => void } | null = null;
let errorSub: { remove: () => void } | null = null;

// Queue of awaiting purchasers. When a purchase result lands via the
// global listener we resolve the matching entry by productId. Multiple
// concurrent purchases of the *same* productId would conflict, but the
// UI must already prevent that (the buy button is disabled while a
// purchase is in flight).
type Pending = {
  productId: string;
  resolve: (r: PurchaseResult) => void;
};
const pending: Pending[] = [];

function describeIapError(err: any): Record<string, unknown> {
  return {
    name: err?.name,
    code: err?.code,
    responseCode: err?.responseCode,
    debugMessage: err?.debugMessage,
    message: err?.message,
    productId: err?.productId,
    platform: Platform.OS,
    raw: err ? String(err) : undefined,
  };
}

function logIap(stage: string, details: Record<string, unknown> = {}) {
  console.warn('[iap]', stage, {
    platform: Platform.OS,
    paymentMethod: env.paymentMethod,
    connected,
    initError,
    ...details,
  });
}

function describeNativeProduct(product: any): Record<string, unknown> | null {
  if (!product) return null;
  const offers = product?.subscriptionOfferDetailsAndroid;
  return {
    id: product.id ?? product.productId,
    type: product.type,
    platform: product.platform,
    displayPrice: product.displayPrice ?? product.localizedPrice,
    offerCount: Array.isArray(offers) ? offers.length : 0,
    offers: Array.isArray(offers)
      ? offers.map((offer: any) => ({
          basePlanId: offer?.basePlanId,
          offerId: offer?.offerId,
          hasOfferToken: Boolean(offer?.offerToken),
          pricingPhases: offer?.pricingPhases?.pricingPhaseList?.map((phase: any) => ({
            billingPeriod: phase?.billingPeriod,
            formattedPrice: phase?.formattedPrice,
            recurrenceMode: phase?.recurrenceMode,
          })),
        }))
      : [],
    keys: Object.keys(product),
  };
}

function popPending(productId: string): Pending | undefined {
  const idx = pending.findIndex(p => p.productId === productId);
  if (idx === -1) return undefined;
  const [removed] = pending.splice(idx, 1);
  return removed;
}

function resolveAllPending(result: PurchaseResult) {
  while (pending.length) {
    const p = pending.shift()!;
    p.resolve(result);
  }
}

/**
 * Initialise the platform billing connection + global listeners. Must
 * be called once at app startup (e.g. in /app/_layout.tsx) before any
 * upgrade UI is shown.
 */
export async function initializeIap(): Promise<void> {
  if (env.paymentMethod !== 'iap') {
    logIap('init skipped: payment method disabled');
    return;
  }
  if (connected) {
    logIap('init skipped: already connected');
    return;
  }

  try {
    logIap('init start');
    await initConnection();
    connected = true;
    initError = null;
    logIap('init success');

    purchaseSub = purchaseUpdatedListener(async (purchase: Purchase) => {
      const productId = purchase.productId;
      const slot = popPending(productId);
      logIap('purchase updated', {
        productId,
        transactionId: purchase.transactionId,
        hasPurchaseToken: Boolean(purchase.purchaseToken),
      });

      try {
        const verify = await iapApi.verifyReceipt({
          platform: Platform.OS === 'ios' ? 'apple' : 'google',
          productId,
          // Unified token: iOS = JWS string, Android = purchaseToken.
          signedTransaction: Platform.OS === 'ios' ? (purchase.purchaseToken ?? undefined) : undefined,
          purchaseToken: Platform.OS === 'android' ? (purchase.purchaseToken ?? undefined) : undefined,
        });

        if (verify.ok) {
          // Backend activated Premium — safe to finalize the platform tx.
          try {
            await finishTransaction({ purchase, isConsumable: false });
          } catch (e) {
            // Don't fail the purchase result if finishTransaction throws —
            // the transaction will be re-delivered on next app launch and
            // backend will mark it `alreadyProcessed`.
            console.warn('[iap] finishTransaction failed:', e);
          }
          logIap('verify success', { productId });
          slot?.resolve({ kind: 'success', verify });
        } else {
          logIap('verify failed', { productId, verify });
          slot?.resolve({ kind: 'failed', error: verify.error });
        }
      } catch (err: any) {
        logIap('verify exception', { productId, error: describeIapError(err) });
        slot?.resolve({ kind: 'failed', error: err?.message || String(err) });
      }
    });

    errorSub = purchaseErrorListener((error: any) => {
      logIap('purchase error event', { error: describeIapError(error) });
      const result: PurchaseResult =
        error.code === ErrorCode.E_USER_CANCELLED
          ? { kind: 'cancelled' }
          : { kind: 'failed', error: error.message || String(error.code) };

      // expo-iap doesn't always tell us which productId the error belongs
      // to. When productId is present, resolve only that slot; otherwise
      // resolve all pending (safest: the user is in front of one sheet).
      const productId = (error as any).productId as string | undefined;
      if (productId) {
        popPending(productId)?.resolve(result);
      } else {
        resolveAllPending(result);
      }
    });
  } catch (err: any) {
    initError = err?.message || String(err);
    logIap('init failed', { error: describeIapError(err) });
  }
}

export async function teardownIap(): Promise<void> {
  if (!connected) return;
  try {
    purchaseSub?.remove();
    errorSub?.remove();
    await endConnection();
  } finally {
    purchaseSub = null;
    errorSub = null;
    connected = false;
    initError = null;
  }
}

// ─── Catalogue ────────────────────────────────────────────────────────

/**
 * Fetch products for the upgrade screen. Combines the backend's static
 * catalogue (canonical product IDs + VND display price) with the platform
 * store's localized price. Falls back to backend-only when expo-iap is
 * unavailable so the UI can still render a price.
 */
export async function fetchAvailableProducts(): Promise<LocalProduct[]> {
  const backendCatalog = await iapApi.fetchProducts();

  if (env.paymentMethod !== 'iap' || !connected) {
    logIap('fetch products skipped: using backend catalog', {
      productIds: backendCatalog.products.map(p => p.id),
    });
    return backendCatalog.products;
  }

  try {
    const skus = backendCatalog.products.map(p => p.id);
    logIap('fetch products start', { skus });
    const native = (await fetchProducts({ skus, type: 'subs' })) ?? [];
    logIap('fetch products success', {
      requestedSkus: skus,
      returnedProducts: native.map((n: any) => n.id ?? n.productId),
      nativeProducts: native.map(describeNativeProduct),
    });

    return backendCatalog.products.map(bp => {
      const match = native.find((n: any) => n.id === bp.id || n.productId === bp.id);
      return {
        ...bp,
        localizedPrice: (match as any)?.displayPrice ?? (match as any)?.localizedPrice,
        nativeProduct: match as SubscriptionProduct | undefined,
      };
    });
  } catch (err) {
    logIap('fetch products failed: falling back to backend prices', { error: describeIapError(err) });
    return backendCatalog.products;
  }
}

// ─── Purchase ────────────────────────────────────────────────────────

/**
 * Start a subscription purchase. Awaits the global purchaseUpdated /
 * purchaseError listener via the `pending` queue. Returns a normalized
 * result the upgrade screen can render directly.
 *
 * NOTE: the caller is responsible for re-fetching subscription status
 * after `kind: 'success'` — this function does not touch local cache.
 */
export async function purchaseSubscription(
  productId: string,
  product?: LocalProduct,
): Promise<PurchaseResult> {
  logIap('purchase requested', {
    productId,
    hasNativeProduct: Boolean(product?.nativeProduct),
  });

  if (env.paymentMethod !== 'iap') {
    logIap('purchase blocked: payment method disabled', { productId });
    return { kind: 'failed', error: 'IAP mode is not enabled' };
  }
  if (!connected) {
    logIap('purchase retrying init', { productId });
    await initializeIap();
  }
  if (!connected) {
    logIap('purchase blocked: init unavailable', { productId });
    return {
      kind: 'failed',
      error: initError ? `IAP not initialised: ${initError}` : 'IAP not initialised — restart the app',
    };
  }

  // Android subscription requires the offerToken from the product's
  // subscriptionOfferDetailsAndroid[0].offerToken. Pull it from the
  // cached native product fetched earlier; if missing, try a fresh fetch.
  let androidOfferToken: string | undefined;
  if (Platform.OS === 'android') {
    let np = product?.nativeProduct;
    if (!np) {
      try {
        const native = (await fetchProducts({ skus: [productId], type: 'subs' })) ?? [];
        np = native[0] as SubscriptionProduct | undefined;
        logIap('purchase fresh Android product fetch', {
          productId,
          nativeProducts: native.map(describeNativeProduct),
        });
      } catch {}
    }
    const offers = (np as any)?.subscriptionOfferDetailsAndroid;
    androidOfferToken = offers?.[0]?.offerToken;
    if (!androidOfferToken) {
      logIap('purchase blocked: missing Android offer token', {
        productId,
        nativeProduct: describeNativeProduct(np),
        offerCount: Array.isArray(offers) ? offers.length : 0,
      });
      return {
        kind: 'failed',
        error: 'Missing Play Billing offerToken — check the subscription has a base plan published.',
      };
    }
  }

  return new Promise<PurchaseResult>(async (resolve) => {
    pending.push({ productId, resolve });
    try {
      logIap('requestPurchase start', {
        productId,
        androidOfferToken: androidOfferToken ? `${androidOfferToken.slice(0, 6)}...` : undefined,
      });
      await requestPurchase({
        type: 'subs',
        request: {
          ios: { sku: productId },
          android: {
            skus: [productId],
            subscriptionOffers: androidOfferToken ? [{ sku: productId, offerToken: androidOfferToken }] : [],
          },
        },
      });
      logIap('requestPurchase returned', { productId });
      // Result will arrive via purchaseUpdatedListener / purchaseErrorListener.
    } catch (err: any) {
      // requestPurchase rejected synchronously (e.g. validation), so the
      // listeners won't fire — resolve here ourselves.
      popPending(productId);
      logIap('requestPurchase exception', { productId, error: describeIapError(err) });
      if (String(err?.code || '').toLowerCase().includes('cancel')) {
        resolve({ kind: 'cancelled' });
      } else {
        resolve({ kind: 'failed', error: err?.message || String(err) });
      }
    }
  });
}

// ─── Restore ─────────────────────────────────────────────────────────

/**
 * Restore purchases — for users who reinstalled the app or signed in on
 * a new device. Iterates platform purchases and re-verifies each with
 * the backend (idempotent: duplicate transaction_id → alreadyProcessed).
 */
export async function restorePurchases(): Promise<{ restored: number; errors: string[] }> {
  if (env.paymentMethod !== 'iap') return { restored: 0, errors: ['IAP mode disabled'] };
  if (!connected) return { restored: 0, errors: ['IAP not initialised'] };

  try {
    const purchases = (await getAvailablePurchases()) ?? [];
    let restored = 0;
    const errors: string[] = [];

    for (const p of purchases) {
      try {
        const verify = await iapApi.verifyReceipt({
          platform: Platform.OS === 'ios' ? 'apple' : 'google',
          productId: p.productId,
          signedTransaction: Platform.OS === 'ios' ? (p.purchaseToken ?? undefined) : undefined,
          purchaseToken: Platform.OS === 'android' ? (p.purchaseToken ?? undefined) : undefined,
        });
        if (verify.ok) {
          restored++;
          try { await finishTransaction({ purchase: p, isConsumable: false }); } catch {}
        } else {
          errors.push(verify.error);
        }
      } catch (err: any) {
        errors.push(err?.message || String(err));
      }
    }

    return { restored, errors };
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
  isConnected: () => connected,
  initError: () => initError,
};
