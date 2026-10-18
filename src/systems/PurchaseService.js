/**
 * PurchaseService.js
 * Real-money gem packs. The web/artifact build never charges anyone: it
 * reports that purchases live in the store app. In the Capacitor build, wire
 * a billing plugin here, e.g. cordova-plugin-purchase / RevenueCat:
 *
 *   import { Purchases } from '@revenuecat/purchases-capacitor';
 *   const { customerInfo } = await Purchases.purchaseStoreProduct({ product });
 *   // verify the receipt on your server, THEN grant gems:
 *   Services.save.addCurrency('gems', bundle.gems, `iap:${bundle.id}`);
 *
 * Kids' games must put purchases behind a parental gate and follow the
 * store's family policies (Apple Kids Category / Google Families).
 */
import { Capacitor } from '@capacitor/core';

/** True when a native billing integration is available. */
export function canPurchase() {
  return Capacitor.isNativePlatform?.() === true && typeof window !== 'undefined' && Boolean(window.__LABUBU_IAP__);
}

/**
 * Attempts to buy a gem bundle. Resolves { ok, reason }.
 * reason: 'web' (not available here) | 'cancelled' | 'failed'.
 */
export async function purchaseGems(bundle) {
  if (!canPurchase()) return { ok: false, reason: 'web' };
  try {
    const ok = await window.__LABUBU_IAP__.buy(bundle.id);
    return ok ? { ok: true } : { ok: false, reason: 'cancelled' };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
