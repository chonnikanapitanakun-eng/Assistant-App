// Account deletion (PDPA, P4-07) — Deno Edge Function (Supabase).
//
//   POST { action: 'delete' }, Authorization: Bearer <user JWT> → { ok: true }
//
// Erases everything the cloud holds about the signed-in user, then the auth user itself:
//   1. Google Calendar links (`gcal_accounts`): the refresh token is revoked at Google (best effort,
//      needs GCAL_TOKEN_KEY to unseal it) and the row deleted — these rows are keyed by device,
//      not only `user_id`, so the FK cascade below would leave the unclaimed ones behind.
//   2. `auth.admin.deleteUser` — every sync table, `ai_usage` and any remaining `gcal_accounts`
//      row reference auth.users with `on delete cascade` (supabase/migrations), so the data goes
//      with the user in one statement. Supabase's own session/refresh tokens go with it too.
//
// The export side of PDPA needs no function: the device holds a superset of the cloud data, so
// the app builds the export locally (src/features/privacy/export.ts).
//
// Secrets: none of its own. GCAL_TOKEN_KEY (shared with `gcal`) is optional — without it the
// Google tokens are deleted but not revoked at Google.
import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors } });

// ── Same sealing scheme as gcal/index.ts (AES-GCM key derived from GCAL_TOKEN_KEY) ──
const enc = new TextEncoder();
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const TOKEN_KEY = Deno.env.get('GCAL_TOKEN_KEY') ?? '';
const secret = TOKEN_KEY ? fromB64url(TOKEN_KEY.replace(/=+$/, '')) : new Uint8Array();
const aesKey =
  secret.length >= 32
    ? crypto.subtle.digest('SHA-256', new Uint8Array([...enc.encode('gcal-token:'), ...secret])).then((raw) => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']))
    : null;

async function unseal(sealed: string): Promise<string | null> {
  if (!aesKey) return null;
  try {
    const [iv, ct] = sealed.split('.');
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64url(iv) }, await aesKey, fromB64url(ct)));
  } catch {
    return null;
  }
}

async function userOf(req: Request): Promise<string | null> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data, error } = await admin.auth.getUser(token);
  return error || !data.user ? null : data.user.id;
}

/** Revoke each linked Google account's refresh token (best effort) and drop the rows. */
async function unlinkGoogle(user: string) {
  const { data: accounts, error } = await admin.from('gcal_accounts').select('id, refresh_token').eq('user_id', user);
  if (error) throw error;
  for (const account of accounts ?? []) {
    const token = await unseal(account.refresh_token);
    if (token) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => undefined);
  }
  if (accounts?.length) {
    const { error: deleteError } = await admin.from('gcal_accounts').delete().eq('user_id', user);
    if (deleteError) throw deleteError;
  }
}

async function deleteAccount(req: Request) {
  const user = await userOf(req);
  if (!user) return json({ error: 'bad_token' }, 401);
  await unlinkGoogle(user);
  const { error } = await admin.auth.admin.deleteUser(user);
  if (error) throw error;
  return json({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'not_found' }, 404);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    switch (body.action) {
      case 'delete':
        return await deleteAccount(req);
      default:
        return json({ error: 'bad_action' }, 400);
    }
  } catch (err) {
    console.error('account', err);
    return json({ error: 'failed' }, 500);
  }
});
