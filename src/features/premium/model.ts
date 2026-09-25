/**
 * Premium tier constants on the app side — mirror of supabase/functions/_shared/entitlement.ts
 * (the test in __tests__/premium.test.ts fails if they drift apart).
 */

/** RevenueCat entitlement identifier that unlocks Veyra Pro. */
export const PRO_ENTITLEMENT = 'pro';

/** Fair-use cap shown before the server has answered; the `premium` function sends the real one. */
export const DEFAULT_PRO_MONTHLY_AI_LIMIT = 1000;

/** Same rule as `public.is_pro()`: active and not past its expiry (null expiry = no end). */
export function isProRow(row: { active?: boolean | null; expires_at?: string | null } | null | undefined, now = Date.now()): boolean {
  if (!row?.active) return false;
  return !row.expires_at || Date.parse(row.expires_at) > now;
}
