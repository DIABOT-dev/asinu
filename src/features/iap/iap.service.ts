/**
 * Native store billing client wrapper around `expo-iap`.
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
import type { Purchase, SubscriptionProduct } from 'expo-iap';
import { env } from '../../lib/env';
import { iapApi } from './iap.api';
import { FALLBACK_IAP_PRODUCTS } from './iap.catalog';
import type { IapProduct, IapVerifyResponse } from './iap.types';

/**
 * expo-iap is a native module and is not included in Expo Go. Keep the
 * runtime import lazy so importing the root layout does not make every route
 * fail validation when the app is opened in Expo Go. A development/release
 * build that includes the expo-iap config plugin will still load it on demand.
 */
type ExpoIapModule = typeof import('expo-iap');
let expoIap: ExpoIapModule | null | undefined;

function getExpoIap(): ExpoIapModule | null {
  if (expoIap !== undefined) return expoIap;

  try {
    // Keep this require inside the function: Metro bundles the dependency but
    // does not evaluate its native module until IAP is actually requested.
    expoIap = require('expo-iap') as ExpoIapModule;
  } catch (error) {
    expoIap = null;
    if (__DEV__) {
      console.warn('[iap] Native module unavailable; use a development build to enable store billing.', error);
    }
  }

  return expoIap;
}

export type LocalProduct = IapProduct & {
  // Localised price formatted by the platform (e.g. "199.000 ₫" on iOS,
  // "₫199,000" on Android). A missing native product means the plan remains
  // visible for reference but cannot open a purchase sheet yet.
  localizedPrice?: string;
  // Kept so Android subscription purchase can pass the right offerToken.
  nativeProduct?: SubscriptionProduct;
};

export type PurchaseResult = { kind: 'success'; verify: IapVerifyResponse } | { kind: 'cancelled' } | { kind: 'failed'; error: string };

const ANDROID_REPLACEMENT_MODE = {
  CHARGE_PRORATED_PRICE: 2,
  DEFERRED: 6,
} as const;

function planSize(productId: string): number {
  const match = productId.match(/\.antam(2|4|8)\./);
  return match ? Number(match[1]) : 0;
}

function androidReplacementMode(currentProductId: string, targetProductId: string): number {
  const currentSize = planSize(currentProductId);
  const targetSize = planSize(targetProductId);
  const movesToSmallerPlan = currentSize > 0 && targetSize > 0 && targetSize < currentSize;
  const movesFromYearlyToMonthly =
    currentSize === targetSize &&
    currentProductId.endsWith('.yearly') &&
    targetProductId.endsWith('.monthly');

  return movesToSmallerPlan || movesFromYearlyToMonthly
    ? ANDROID_REPLACEMENT_MODE.DEFERRED
    : ANDROID_REPLACEMENT_MODE.CHARGE_PRORATED_PRICE;
}

// ─── Connection state ─────────────────────────────────────────────────

let connected = false;
let initError: string | null = null;
let initPromise: Promise<void> | null = null;
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
async function initializeIapConnection(): Promise<void> {
  if (env.paymentMethod !== 'iap') {
    return;
  }
  if (connected) {
    logIap('init skipped: already connected');
    return;
  }

  const iap = getExpoIap();
  if (!iap) {
    initError = 'Native IAP module unavailable. Use a development build.';
    logIap('init skipped: native module unavailable');
    return;
  }

  try {
    logIap('init start');
    await iap.initConnection();
    connected = true;
    initError = null;
    logIap('init success');

    purchaseSub = iap.purchaseUpdatedListener(async (purchase: Purchase) => {
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
          signedTransaction: Platform.OS === 'ios' ? purchase.purchaseToken ?? undefined : undefined,
          purchaseToken: Platform.OS === 'android' ? purchase.purchaseToken ?? undefined : undefined,
        });

        if (verify.ok) {
          // Backend activated the selected An Tam plan — finalize the Store transaction.
          try {
            await iap.finishTransaction({ purchase, isConsumable: false });
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

    errorSub = iap.purchaseErrorListener((error: any) => {
      logIap('purchase error event', { error: describeIapError(error) });
      const result: PurchaseResult =
        error.code === iap.ErrorCode.E_USER_CANCELLED
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

export function initializeIap(): Promise<void> {
  if (!initPromise) {
    initPromise = initializeIapConnection().finally(() => {
      initPromise = null;
    });
  }
  return initPromise;
}

export async function teardownIap(): Promise<void> {
  if (!connected) return;
  try {
    purchaseSub?.remove();
    errorSub?.remove();
    await expoIap?.endConnection();
  } finally {
    purchaseSub = null;
    errorSub = null;
    connected = false;
    initError = null;
    initPromise = null;
  }
}

// ─── Catalogue ────────────────────────────────────────────────────────

/**
 * Fetch products for the upgrade screen. Combines the backend's static
 * catalogue (canonical product IDs + VND display price) with the platform
 * store's localized price. The full catalogue always remains visible; only
 * products returned by the native Store are purchasable.
 */
export async function fetchAvailableProducts(): Promise<LocalProduct[]> {
  let catalog: IapProduct[] = [...FALLBACK_IAP_PRODUCTS];
  try {
    const backendCatalog = await iapApi.fetchProducts();
    if (backendCatalog.ok && backendCatalog.products.length > 0) {
      catalog = backendCatalog.products;
    }
  } catch (err) {
    logIap('backend catalogue unavailable; using display fallback', {
      error: describeIapError(err),
    });
  }

  if (env.paymentMethod !== 'iap') {
    return catalog;
  }

  let iap = getExpoIap();
  if (!iap) {
    return catalog;
  }
  if (!connected) {
    await initializeIap();
    iap = getExpoIap();
  }
  if (!connected || !iap) {
    logIap('fetch products unavailable', {
      productIds: catalog.map(p => p.id),
    });
    return catalog;
  }

  try {
    const skus = catalog.map(p => p.id);
    logIap('fetch products start', { skus });
    const native = (await iap.fetchProducts({ skus, type: 'subs' })) ?? [];
    logIap('fetch products success', {
      requestedSkus: skus,
      returnedProducts: native.map((n: any) => n.id ?? n.productId),
    });

    return catalog.map(bp => {
      const match = native.find((n: any) => n.id === bp.id || n.productId === bp.id);
      if (!match) {
        return bp;
      }
      return {
        ...bp,
        localizedPrice: (match as any)?.displayPrice ?? (match as any)?.localizedPrice,
        nativeProduct: match as SubscriptionProduct,
      };
    });
  } catch (err) {
    logIap('fetch products failed', {
      error: describeIapError(err),
    });
    return catalog;
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
export async function purchaseSubscription(productId: string, product?: LocalProduct): Promise<PurchaseResult> {
  logIap('purchase requested', {
    productId,
    hasNativeProduct: Boolean(product?.nativeProduct),
  });

  if (env.paymentMethod !== 'iap') {
    logIap('purchase blocked: payment method disabled', { productId });
    return { kind: 'failed', error: 'IAP mode is not enabled' };
  }
  if (!product?.nativeProduct) {
    logIap('purchase blocked: product unavailable in native Store', { productId });
    return {
      kind: 'failed',
      error: 'This subscription is not available in the Store yet.',
    };
  }
  let iap = getExpoIap();
  if (!iap) {
    return {
      kind: 'failed',
      error: 'Native IAP module unavailable. Use a development build.',
    };
  }
  if (!connected) {
    logIap('purchase retrying init', { productId });
    await initializeIap();
  }
  iap = getExpoIap();
  if (!connected || !iap) {
    logIap('purchase blocked: init unavailable', { productId });
    return {
      kind: 'failed',
      error: initError ? `IAP not initialised: ${initError}` : 'IAP not initialised — restart the app',
    };
  }

  // Android requires an offer token. Prefer the base plan so a promotional
  // offer is never applied accidentally without Store eligibility checks.
  let androidOfferToken: string | undefined;
  let previousPurchaseToken: string | undefined;
  let previousProductId: string | undefined;
  if (Platform.OS === 'android') {
    const np = product.nativeProduct;
    const offers = (np as any)?.subscriptionOfferDetailsAndroid;
    const baseOffer = offers?.find((offer: any) => !offer.offerId) ?? offers?.[0];
    androidOfferToken = baseOffer?.offerToken;
    try {
      const activePurchases = (await iap.getAvailablePurchases()) ?? [];
      const current = activePurchases.find(
        purchase => purchase.productId !== productId && purchase.productId.startsWith('asinu.antam')
      );
      previousPurchaseToken = current?.purchaseToken ?? undefined;
      previousProductId = current?.productId;
    } catch {}
    if (!androidOfferToken) {
      logIap('purchase blocked: missing Android offer token', {
        productId,
        nativeProductKeys: np ? Object.keys(np as any) : [],
        offerCount: Array.isArray(offers) ? offers.length : 0,
      });
      return {
        kind: 'failed',
        error: 'Missing native store offer token — check the subscription configuration.',
      };
    }
  }

  return new Promise<PurchaseResult>(async resolve => {
    pending.push({ productId, resolve });
    try {
      logIap('requestPurchase start', {
        productId,
        androidOfferToken: androidOfferToken ? `${androidOfferToken.slice(0, 6)}...` : undefined,
      });
      await iap.requestPurchase({
        type: 'subs',
        request: {
          ios: { sku: productId },
          android: {
            skus: [productId],
            subscriptionOffers: androidOfferToken ? [{ sku: productId, offerToken: androidOfferToken }] : [],
            purchaseTokenAndroid: previousPurchaseToken,
            replacementModeAndroid:
              previousPurchaseToken && previousProductId
                ? androidReplacementMode(previousProductId, productId)
                : undefined,
          },
        },
      });
      logIap('requestPurchase returned', { productId });
      // Result will arrive via purchaseUpdatedListener / purchaseErrorListener.
    } catch (err: any) {
      // requestPurchase rejected synchronously (e.g. validation), so the
      // listeners won't fire — resolve here ourselves.
      popPending(productId);
      logIap('requestPurchase exception', {
        productId,
        error: describeIapError(err),
      });
      if (
        String(err?.code || '')
          .toLowerCase()
          .includes('cancel')
      ) {
        resolve({ kind: 'cancelled' });
      } else {
        resolve({ kind: 'failed', error: err?.message || String(err) });
      }
    }
  });
}

export async function redeemOfferCode(): Promise<void> {
  if (env.paymentMethod !== 'iap') {
    throw new Error('IAP mode is not enabled');
  }
  const iap = getExpoIap();
  if (!iap) {
    throw new Error('Native IAP module unavailable. Use a development build.');
  }

  if (Platform.OS === 'ios') {
    await iap.presentCodeRedemptionSheetIOS();
    return;
  }
  if (Platform.OS === 'android') {
    await iap.openRedeemOfferCodeAndroid();
    return;
  }
  throw new Error('Offer-code redemption is not supported on this platform');
}

// ─── Restore ─────────────────────────────────────────────────────────

/**
 * Restore purchases — for users who reinstalled the app or signed in on
 * a new device. Iterates platform purchases and re-verifies each with
 * the backend (idempotent: duplicate transaction_id → alreadyProcessed).
 */
export async function restorePurchases(): Promise<{
  restored: number;
  errors: string[];
}> {
  if (env.paymentMethod !== 'iap') return { restored: 0, errors: ['IAP mode disabled'] };
  if (!connected) return { restored: 0, errors: ['IAP not initialised'] };
  const iap = getExpoIap();
  if (!iap)
    return {
      restored: 0,
      errors: ['Native IAP module unavailable. Use a development build.'],
    };

  try {
    const purchases = (await iap.getAvailablePurchases()) ?? [];
    let restored = 0;
    const errors: string[] = [];

    for (const p of purchases) {
      try {
        const verify = await iapApi.verifyReceipt({
          platform: Platform.OS === 'ios' ? 'apple' : 'google',
          productId: p.productId,
          signedTransaction: Platform.OS === 'ios' ? p.purchaseToken ?? undefined : undefined,
          purchaseToken: Platform.OS === 'android' ? p.purchaseToken ?? undefined : undefined,
        });
        if (verify.ok) {
          restored++;
          try {
            await iap.finishTransaction({ purchase: p, isConsumable: false });
          } catch {}
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
  platformKey(): 'apple' | 'google' {
    return Platform.OS === 'ios' ? 'apple' : 'google';
  },
  isConnected: () => connected,
  initError: () => initError,
};
