// Google Calendar import (read-only) — Deno Edge Function (Supabase). P2-07.
//
// Holds each linked Google account's refresh token (encrypted, table `gcal_accounts`) so the app
// never sees one. Several Google accounts can be linked to the same device.
//
//   POST { action: 'start', key, returnUrl, loginHint? }  → { url }       open `url` in a browser
//   GET  /gcal/callback?code&state                        → 302 returnUrl?gcal=<ticket> | ?gcal_error=<code>
//   POST { action: 'finish', key, ticket }                → { account }   claim the ticket (same device only)
//   POST { action: 'sync', key, timeMin, timeMax }        → { accounts: SyncAccount[] }  (src/features/google-calendar/types.ts)
//   POST { action: 'disconnect', key, accountId }         → { ok: true }  revoke at Google + delete
//
// `key` is the device key (src/features/google-calendar/device-key.ts). Accounts belong to
// sha256(key) until Supabase Auth ships.
//
// Secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GCAL_TOKEN_KEY (32+ random bytes, base64),
//          GCAL_RETURN_PREFIXES (comma list of allowed return URLs, default "veyra://"),
//          GCAL_REDIRECT_URI (optional; default <SUPABASE_URL>/functions/v1/gcal/callback)
import { createClient } from 'npm:@supabase/supabase-js@2';

const CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';
const TOKEN_KEY = Deno.env.get('GCAL_TOKEN_KEY') ?? '';
const REDIRECT_URI = Deno.env.get('GCAL_REDIRECT_URI') ?? `${Deno.env.get('SUPABASE_URL')}/functions/v1/gcal/callback`;
const RETURN_PREFIXES = (Deno.env.get('GCAL_RETURN_PREFIXES') ?? 'veyra://')
  .split(',')
  .map((s) => s.trim().replace(/^["']|["']$/g, '')) // tolerate quotes pasted into the dashboard
  .filter(Boolean);

const SCOPES = 'openid email https://www.googleapis.com/auth/calendar.readonly';
const MAX_ACCOUNTS = 10;
const STATE_TTL_MS = 10 * 60_000;
const TICKET_TTL_MS = 10 * 60_000;
const MAX_WINDOW_MS = 400 * 86_400_000;

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

// ── crypto helpers ──
const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (s: string) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const randomToken = () => b64url(crypto.getRandomValues(new Uint8Array(32)));

// One secret, two purpose-bound keys: AES-GCM for tokens at rest, HMAC for the OAuth state.
const secret = TOKEN_KEY ? fromB64url(TOKEN_KEY.replace(/=+$/, '')) : new Uint8Array();
const aesKey = crypto.subtle.digest('SHA-256', new Uint8Array([...enc.encode('gcal-token:'), ...secret])).then((raw) => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']));
const hmacKey = crypto.subtle.digest('SHA-256', new Uint8Array([...enc.encode('gcal-state:'), ...secret])).then((raw) => crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']));

async function seal(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey, enc.encode(plain)));
  return `${b64url(iv)}.${b64url(ct)}`;
}
async function unseal(sealed: string): Promise<string> {
  const [iv, ct] = sealed.split('.');
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64url(iv) }, await aesKey, fromB64url(ct)));
}

type State = { o: string; r: string; e: number };
async function signState(s: State): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(s)));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey, enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}
async function readState(raw: string | null): Promise<State | null> {
  const [body, sig] = (raw ?? '').split('.');
  if (!body || !sig) return null;
  try {
    if (!(await crypto.subtle.verify('HMAC', await hmacKey, fromB64url(sig), enc.encode(body)))) return null;
    const s = JSON.parse(new TextDecoder().decode(fromB64url(body))) as State;
    return s.e > Date.now() && allowedReturn(s.r) ? s : null;
  } catch {
    return null;
  }
}

/** Only redirect back to the app (or a configured web origin) — never an arbitrary URL. */
function allowedReturn(url: unknown): url is string {
  return typeof url === 'string' && url.length < 1000 && RETURN_PREFIXES.some((p) => url.startsWith(p));
}
const withParams = (url: string, params: Record<string, string>) => {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
};

// ── Google ──
class ReauthError extends Error {}

async function googleToken(params: Record<string, string>) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...params }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (data.error === 'invalid_grant') throw new ReauthError(data.error);
    throw new Error(`token ${res.status} ${data.error ?? ''}`);
  }
  return data as { access_token: string; refresh_token?: string; id_token?: string };
}

/** The id_token comes straight from Google's token endpoint over TLS, so its payload is trusted as-is. */
function idClaims(idToken: string | undefined): { sub: string; email: string } | null {
  try {
    const p = JSON.parse(new TextDecoder().decode(fromB64url(idToken!.split('.')[1])));
    return typeof p.sub === 'string' && typeof p.email === 'string' ? { sub: p.sub, email: p.email } : null;
  } catch {
    return null;
  }
}

async function gget<T>(accessToken: string, path: string, query: Record<string, string>): Promise<T> {
  const res = await fetch(`https://www.googleapis.com/calendar/v3/${path}?${new URLSearchParams(query)}`, { headers: { authorization: `Bearer ${accessToken}` } });
  if (res.status === 401) throw new ReauthError('unauthorized');
  if (!res.ok) throw new Error(`calendar ${res.status}`);
  return (await res.json()) as T;
}

type GDate = { date?: string; dateTime?: string };
type GEvent = {
  id: string;
  iCalUID?: string;
  status?: string;
  summary?: string;
  location?: string;
  start?: GDate;
  end?: GDate;
  attendees?: { self?: boolean; responseStatus?: string }[];
};
type GCalendar = { id: string; summary?: string; summaryOverride?: string; selected?: boolean; hidden?: boolean; primary?: boolean };

/** Events from every calendar the person has ticked in Google Calendar, minus cancelled / declined ones. */
async function fetchEvents(accessToken: string, timeMin: string, timeMax: string) {
  const list = await gget<{ items?: GCalendar[] }>(accessToken, 'users/me/calendarList', { minAccessRole: 'reader', maxResults: '250' });
  const calendars = (list.items ?? []).filter((c) => c.primary || (c.selected && !c.hidden));
  const out: Record<string, unknown>[] = [];
  for (const cal of calendars) {
    let pageToken: string | undefined;
    do {
      const page = await gget<{ items?: GEvent[]; nextPageToken?: string }>(accessToken, `calendars/${encodeURIComponent(cal.id)}/events`, {
        singleEvents: 'true',
        timeMin,
        timeMax,
        maxResults: '2500',
        fields: 'nextPageToken,items(id,iCalUID,status,summary,location,start,end,attendees(self,responseStatus))',
        ...(pageToken ? { pageToken } : {}),
      });
      for (const e of page.items ?? []) {
        if (e.status === 'cancelled' || !e.start || !e.end) continue;
        if (e.attendees?.some((a) => a.self && a.responseStatus === 'declined')) continue;
        out.push({ id: `${cal.id}/${e.id}`, iCalUID: e.iCalUID ?? null, calendarName: cal.summaryOverride ?? cal.summary ?? null, title: e.summary ?? '', location: e.location ?? null, start: e.start, end: e.end });
      }
      pageToken = page.nextPageToken;
    } while (pageToken);
  }
  return out;
}

// ── handlers ──
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors } });
const redirect = (url: string) => new Response(null, { status: 302, headers: { location: url } });

async function ownerOf(key: unknown): Promise<string | null> {
  return typeof key === 'string' && /^[0-9a-f]{64}$/.test(key) ? await sha256(key) : null;
}

async function start(owner: string, body: Record<string, unknown>) {
  if (!allowedReturn(body.returnUrl)) return json({ error: 'bad_return_url' }, 400);
  await admin.from('gcal_pending').delete().lt('expires_at', new Date().toISOString());
  const state = await signState({ o: owner, r: body.returnUrl, e: Date.now() + STATE_TTL_MS });
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    // consent: always hand back a refresh token, even for an account linked before.
    prompt: 'consent select_account',
    state,
  });
  if (typeof body.loginHint === 'string' && body.loginHint.includes('@')) params.set('login_hint', body.loginHint);
  return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
}

async function callback(url: URL) {
  const state = await readState(url.searchParams.get('state'));
  if (!state) return new Response('This sign-in link has expired. Go back to Veyra and try again.', { status: 400 });
  const back = (params: Record<string, string>) => redirect(withParams(state.r, params));

  const code = url.searchParams.get('code');
  if (!code) return back({ gcal_error: url.searchParams.get('error') === 'access_denied' ? 'denied' : 'failed' });
  try {
    const tokens = await googleToken({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI });
    const who = idClaims(tokens.id_token);
    if (!who || !tokens.refresh_token) return back({ gcal_error: 'failed' });
    if (!(await grantedCalendar(tokens.access_token))) return back({ gcal_error: 'scope' });
    const ticket = randomToken();
    const { error } = await admin.from('gcal_pending').insert({
      ticket_hash: await sha256(ticket),
      owner: state.o,
      google_sub: who.sub,
      email: who.email,
      refresh_token: await seal(tokens.refresh_token),
      expires_at: new Date(Date.now() + TICKET_TTL_MS).toISOString(),
    });
    if (error) throw error;
    return back({ gcal: ticket });
  } catch (err) {
    console.error('gcal callback', err);
    return back({ gcal_error: 'failed' });
  }
}

/** Google lets people untick the calendar permission on the consent screen. */
async function grantedCalendar(accessToken: string) {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
  const info = await res.json().catch(() => ({}));
  return typeof info.scope === 'string' && info.scope.split(' ').includes('https://www.googleapis.com/auth/calendar.readonly');
}

async function finish(owner: string, body: Record<string, unknown>) {
  if (typeof body.ticket !== 'string') return json({ error: 'bad_ticket' }, 400);
  const ticketHash = await sha256(body.ticket);
  const { data: pending } = await admin.from('gcal_pending').select('*').eq('ticket_hash', ticketHash).maybeSingle();
  if (!pending || pending.owner !== owner || new Date(pending.expires_at).getTime() < Date.now()) return json({ error: 'bad_ticket' }, 400);
  await admin.from('gcal_pending').delete().eq('ticket_hash', ticketHash);

  const { data: existing } = await admin.from('gcal_accounts').select('id, google_sub').eq('owner', owner);
  const isNew = !(existing ?? []).some((a) => a.google_sub === pending.google_sub);
  if (isNew && (existing?.length ?? 0) >= MAX_ACCOUNTS) return json({ error: 'too_many_accounts' }, 400);

  const { data: account, error } = await admin
    .from('gcal_accounts')
    .upsert({ owner, google_sub: pending.google_sub, email: pending.email, refresh_token: pending.refresh_token, status: 'ok', updated_at: new Date().toISOString() }, { onConflict: 'owner,google_sub' })
    .select('id, email, status')
    .single();
  if (error) throw error;
  return json({ account });
}

async function sync(owner: string, body: Record<string, unknown>) {
  const min = Date.parse(String(body.timeMin));
  const max = Date.parse(String(body.timeMax));
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min || max - min > MAX_WINDOW_MS) return json({ error: 'bad_window' }, 400);

  const { data: rows, error } = await admin.from('gcal_accounts').select('id, email, status, refresh_token').eq('owner', owner).order('created_at');
  if (error) throw error;

  const accounts = await Promise.all(
    (rows ?? []).map(async (a) => {
      const base = { id: a.id as string, email: a.email as string };
      if (a.status === 'reauth') return { ...base, status: 'reauth' };
      try {
        const { access_token } = await googleToken({ grant_type: 'refresh_token', refresh_token: await unseal(a.refresh_token) });
        const events = await fetchEvents(access_token, new Date(min).toISOString(), new Date(max).toISOString());
        return { ...base, status: 'ok', events };
      } catch (err) {
        if (err instanceof ReauthError) {
          await admin.from('gcal_accounts').update({ status: 'reauth', updated_at: new Date().toISOString() }).eq('id', a.id);
          return { ...base, status: 'reauth' };
        }
        console.error('gcal sync', a.id, err);
        return { ...base, status: 'error' };
      }
    }),
  );
  return json({ accounts });
}

async function disconnect(owner: string, body: Record<string, unknown>) {
  const { data: account } = await admin.from('gcal_accounts').select('id, refresh_token').eq('owner', owner).eq('id', String(body.accountId)).maybeSingle();
  if (account) {
    // Best effort: an already-expired token can't be revoked, but the row still goes.
    const token = await unseal(account.refresh_token).catch(() => null);
    if (token) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => undefined);
    await admin.from('gcal_accounts').delete().eq('id', account.id);
  }
  return json({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (!CLIENT_ID || !CLIENT_SECRET || secret.length < 32) return json({ error: 'not_configured' }, 503);

  const url = new URL(req.url);
  if (req.method === 'GET' && url.pathname.endsWith('/callback')) return callback(url);
  if (req.method !== 'POST') return json({ error: 'not_found' }, 404);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const owner = await ownerOf(body?.key);
  if (!body || !owner) return json({ error: 'bad_key' }, 400);

  try {
    switch (body.action) {
      case 'start':
        return await start(owner, body);
      case 'finish':
        return await finish(owner, body);
      case 'sync':
        return await sync(owner, body);
      case 'disconnect':
        return await disconnect(owner, body);
    }
    return json({ error: 'unknown_action' }, 400);
  } catch (err) {
    console.error('gcal', body.action, err);
    return json({ error: 'failed' }, 500);
  }
});
