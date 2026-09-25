import { Platform } from 'react-native';
import Purchases, { type CustomerInfo, type PurchasesError, type PurchasesPackage } from 'react-native-purchases';

import { PRO_ENTITLEMENT } from './model';
import { usePremiumStore } from './store';

// RevenueCat public SDK keys (Project settings → API keys): appl_… / goog_… / rcb_… (Web Billing).
const apiKey = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  web: process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY,
  default: undefined,
});

/** Buying needs a RevenueCat key for this platform; without one the app stays free (or uses a manual grant). */
export const purchasesEnabled = !!apiKey;

let configured = false;

function applyCustomerInfo(info: CustomerInfo) {
  const ent = info.entitlements.active[PRO_ENTITLEMENT];
  usePremiumStore.setState((s) => ({
    storePro: !!ent,
    manageUrl: info.managementURL,
    ...(ent ? { expiresAt: ent.expirationDate, willRenew: ent.willRenew } : !s.serverPro ? { expiresAt: null, willRenew: null } : {}),
  }));
}

/**
 * RevenueCat's app user id = the Supabase user id, so the webhook (supabase/functions/premium)
 * can map purchases back to the account. Purchases are only offered while signed in.
 */
export async function identifyPurchases(userId: string): Promise<void> {
  if (!purchasesEnabled) return;
  if (!configured) {
    Purchases.configure({ apiKey: apiKey!, appUserID: userId });
    Purchases.addCustomerInfoUpdateListener(applyCustomerInfo);
    configured = true;
  } else {
    await Purchases.logIn(userId);
  }
  applyCustomerInfo(await Purchases.getCustomerInfo());
}

export async function resetPurchases(): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch {
    // Already anonymous — nothing to reset.
  }
}

/** Packages of the current offering (Dashboard → Offerings → default), monthly first. */
export async function getPackages(): Promise<PurchasesPackage[]> {
  if (!configured) return [];
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  if (!current) return [];
  const ordered = [current.monthly, current.annual].filter((p): p is PurchasesPackage => !!p);
  return ordered.length ? ordered : current.availablePackages;
}

export type PurchaseOutcome = 'pro' | 'cancelled' | 'not_pro' | 'error';

export async function buy(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    applyCustomerInfo(customerInfo);
    return customerInfo.entitlements.active[PRO_ENTITLEMENT] ? 'pro' : 'not_pro';
  } catch (e) {
    if ((e as PurchasesError).userCancelled) return 'cancelled';
    console.error('Purchase failed:', e);
    return 'error';
  }
}

export async function restore(): Promise<PurchaseOutcome> {
  if (!configured) return 'error';
  try {
    const info = await Purchases.restorePurchases();
    applyCustomerInfo(info);
    return info.entitlements.active[PRO_ENTITLEMENT] ? 'pro' : 'not_pro';
  } catch (e) {
    console.error('Restore failed:', e);
    return 'error';
  }
}
