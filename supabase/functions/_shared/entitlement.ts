// Premium tier (P4-06) — pure helpers shared by the `premium` Edge Function and the app's tests.
// No Deno / npm imports here so vitest can load it (src/features/premium/__tests__).

/** RevenueCat entitlement identifier that unlocks Veyra Pro (Dashboard → Product catalog → Entitlements). */
export const PRO_ENTITLEMENT = 'pro';

/** Fair-use cap for Pro: AI calls per calendar month (UTC), all AI functions together. */
export const DEFAULT_PRO_MONTHLY_AI_LIMIT = 1000;

/** Row shape of `public.entitlements` (supabase/migrations/20260927000000_premium.sql). */
export type EntitlementRow = {
  user_id: string;
  entitlement: string;
  source: 'revenuecat' | 'manual';
  active: boolean;
  expires_at: string | null;
  product_id: string | null;
  store: string | null;
  period_type: string | null;
  will_renew: boolean | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

/**
 * Supabase user ids touched by one RevenueCat webhook event. The app logs in to RevenueCat with the
 * Supabase user id, so anonymous ids (`$RCAnonymousID:…`) are skipped — they own no Supabase account.
 */
export function userIdsFromEvent(body: unknown): string[] {
  const event = (body as { event?: Record<string, unknown> } | null)?.event;
  if (!event || typeof event !== 'object') return [];
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  const ids = [event.app_user_id, event.original_app_user_id, ...list(event.aliases), ...list(event.transferred_from), ...list(event.transferred_to)];
  return [...new Set(ids.filter(isUuid).map((id) => id.toLowerCase()))];
}

type RcEntitlement = { expires_date?: string | null; grace_period_expires_date?: string | null; product_identifier?: string; period_type?: string };
type RcSubscription = { store?: string; period_type?: string; unsubscribe_detected_at?: string | null };
export type RcSubscriber = { entitlements?: Record<string, RcEntitlement>; subscriptions?: Record<string, RcSubscription> };

/**
 * `GET /v1/subscribers/{id}` → the entitlements row. The subscriber endpoint is the source of truth,
 * so webhook ordering / retries never matter: every event just re-reads it.
 * `expires_date: null` = lifetime (non-subscription) purchase. A billing-grace period counts as active.
 */
export function entitlementFromSubscriber(userId: string, subscriber: RcSubscriber | null | undefined, now = Date.now()): EntitlementRow {
  const ent = subscriber?.entitlements?.[PRO_ENTITLEMENT];
  const productId = ent?.product_identifier ?? null;
  const sub = productId ? subscriber?.subscriptions?.[productId] : undefined;
  const ms = (v: string | null | undefined) => (v ? Date.parse(v) : NaN);
  const expiry = ms(ent?.expires_date);
  const grace = ms(ent?.grace_period_expires_date);
  const end = Math.max(Number.isNaN(expiry) ? -Infinity : expiry, Number.isNaN(grace) ? -Infinity : grace);
  const lifetime = !!ent && !ent.expires_date;
  return {
    user_id: userId,
    entitlement: PRO_ENTITLEMENT,
    source: 'revenuecat',
    active: !!ent && (lifetime || end > now),
    expires_at: ent && !lifetime && Number.isFinite(end) ? new Date(end).toISOString() : null,
    product_id: productId,
    store: sub?.store ?? null,
    period_type: sub?.period_type ?? ent?.period_type ?? null,
    will_renew: sub ? !sub.unsubscribe_detected_at : null,
  };
}

/** Same rule as `public.is_pro()` in SQL: active and not past its expiry (null expiry = no end). */
export function isProRow(row: Pick<EntitlementRow, 'active' | 'expires_at'> | null | undefined, now = Date.now()): boolean {
  if (!row?.active) return false;
  return !row.expires_at || Date.parse(row.expires_at) > now;
}

/** First instant of the current calendar month in UTC — the quota window, same on server and app. */
export function monthStartUtc(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export type QuotaDecision =
  | { ok: true; used: number; limit: number }
  | { ok: false; status: 402 | 429; body: { error: 'premium_required' | 'quota_exceeded'; reason?: 'sign_in' | 'not_pro'; used?: number; limit?: number } };

/** Free = no AI (the app keeps its on-device parser / engine). Pro = AI up to the monthly fair-use cap. */
export function decideQuota(input: { userId: string | null; pro: boolean; used: number; limit: number }): QuotaDecision {
  if (!input.userId) return { ok: false, status: 402, body: { error: 'premium_required', reason: 'sign_in' } };
  if (!input.pro) return { ok: false, status: 402, body: { error: 'premium_required', reason: 'not_pro' } };
  if (input.used >= input.limit) return { ok: false, status: 429, body: { error: 'quota_exceeded', used: input.used, limit: input.limit } };
  return { ok: true, used: input.used, limit: input.limit };
}
