import { getSession } from '@/features/auth';
import { supabaseAnonKey, supabaseEnabled, supabaseUrl } from '@/lib/supabase';

import { isProRow } from './model';
import { usePremiumStore } from './store';

/** `POST /premium/status|refresh` — see supabase/functions/premium/index.ts. */
type StatusResponse = { pro: boolean; used: number; limit: number; entitlement: { active?: boolean; expires_at?: string | null; will_renew?: boolean | null; source?: string } | null };

/**
 * Ask the `premium` function for this user's Pro flag and AI calls this month.
 * `refresh: true` first re-reads RevenueCat (right after a purchase / restore, before the webhook lands).
 */
export async function loadServerStatus({ refresh = false } = {}): Promise<void> {
  const session = getSession();
  if (!supabaseEnabled || !session) return;
  const res = await fetch(`${supabaseUrl}/functions/v1/premium/${refresh ? 'refresh' : 'status'}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${session.access_token}`, apikey: supabaseAnonKey! },
  });
  if (!res.ok) throw new Error(`premium ${res.status}`);
  const data = (await res.json()) as StatusResponse;
  if (usePremiumStore.getState().userId !== session.user.id) return; // signed out / switched meanwhile
  const ent = data.entitlement;
  usePremiumStore.setState((s) => ({
    serverPro: data.pro,
    used: data.used,
    limit: data.limit,
    blocked: null,
    // RevenueCat's own expiry wins when the store says Pro; a manual grant has none.
    expiresAt: s.storePro ? s.expiresAt : isProRow(ent) ? (ent?.expires_at ?? null) : null,
    willRenew: s.storePro ? s.willRenew : (ent?.will_renew ?? null),
  }));
}
