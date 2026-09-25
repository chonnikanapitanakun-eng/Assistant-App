// premium — Deno Edge Function (Supabase). Phase 4 (P4-06): Veyra Pro via RevenueCat.
//
//   POST /premium/status    The app, with the user's JWT → { pro, used, limit, entitlement } (no RevenueCat call).
//   POST /premium/webhook   RevenueCat → here. Authorization header must equal REVENUECAT_WEBHOOK_AUTH
//                           (the value typed in RevenueCat Dashboard → Integrations → Webhooks).
//   POST /premium/refresh   The app, right after a purchase / restore, with the user's JWT — so the
//                           AI gate (_shared/quota.ts) sees Pro before the webhook arrives.
//
// webhook / refresh re-read `GET /v1/subscribers/{user id}` with REVENUECAT_SECRET_KEY and upsert `entitlements`:
// the subscriber endpoint is the source of truth, so webhook order / retries / transfers never matter.
// Rows with source = 'manual' (granted by hand in SQL) are never overwritten.
//
// Deploy:  supabase secrets set REVENUECAT_SECRET_KEY=sk_... REVENUECAT_WEBHOOK_AUTH=$(openssl rand -hex 24)
//          supabase functions deploy premium        (verify_jwt = false — see supabase/config.toml)
import { createClient } from 'npm:@supabase/supabase-js@2';

import { entitlementFromSubscriber, userIdsFromEvent, type RcSubscriber } from '../_shared/entitlement.ts';
import { quotaStatus } from '../_shared/quota.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const rcKey = Deno.env.get('REVENUECAT_SECRET_KEY');
const webhookAuth = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...CORS } });

/** Constant-time compare for the webhook secret. */
function sameSecret(a: string, b: string) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

async function fetchSubscriber(userId: string): Promise<RcSubscriber | null> {
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, { headers: { authorization: `Bearer ${rcKey}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`revenuecat ${res.status}`);
  const data = (await res.json()) as { subscriber?: RcSubscriber };
  return data.subscriber ?? null;
}

/** Re-read one user from RevenueCat and store the result. Returns the stored row (or the manual one). */
async function syncUser(userId: string) {
  const existing = await admin.from('entitlements').select('*').eq('user_id', userId).maybeSingle();
  if (existing.data?.source === 'manual') return existing.data;
  const row = entitlementFromSubscriber(userId, await fetchSubscriber(userId));
  const { data, error } = await admin.from('entitlements').upsert({ ...row, updated_at: new Date().toISOString() }).select().single();
  if (error?.code === '23503') {
    // FK: RevenueCat knows an id this project has no user for (deleted account / other project) — nothing to store.
    console.warn('premium: no auth user for', userId);
    return null;
  }
  if (error) throw new Error(error.message);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const route = new URL(req.url).pathname.split('/').filter(Boolean).pop();

  if (route === 'webhook') {
    if (!rcKey) return json({ error: 'not_configured' }, 503);
    if (!webhookAuth || !sameSecret(req.headers.get('authorization') ?? '', webhookAuth)) return json({ error: 'unauthorized' }, 401);
    const ids = userIdsFromEvent(await req.json().catch(() => null));
    const failed: string[] = [];
    for (const id of ids) {
      try {
        await syncUser(id);
      } catch (err) {
        console.warn('premium webhook: sync failed', id, err);
        failed.push(id);
      }
    }
    // 5xx makes RevenueCat retry later (e.g. a RevenueCat API blip).
    return failed.length ? json({ error: 'partial', failed }, 500) : json({ ok: true, users: ids.length });
  }

  if (route === 'status' || route === 'refresh') {
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: auth } = await admin.auth.getUser(token);
    if (!auth.user) return json({ error: 'sign_in_required' }, 401);
    // Without the RevenueCat key a refresh is just a status read (manual grants still work).
    if (route === 'refresh' && rcKey) {
      try {
        await syncUser(auth.user.id);
      } catch (err) {
        console.warn('premium refresh failed', err);
        return json({ error: 'upstream' }, 502);
      }
    }
    return json(await quotaStatus(auth.user.id));
  }

  return json({ error: 'not_found' }, 404);
});
