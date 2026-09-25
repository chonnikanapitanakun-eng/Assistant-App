// Google OAuth helpers shared by `gcal` and `gmail`: the at-rest token cipher, the token endpoint
// and tokeninfo. Both functions read the same `gcal_accounts` rows — one Google account, one
// refresh token, whatever scopes it was granted (calendar.readonly, gmail.readonly, gmail.compose).
//
// Secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GCAL_TOKEN_KEY (32+ random bytes, base64).

export const CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
export const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';
const TOKEN_KEY = Deno.env.get('GCAL_TOKEN_KEY') ?? '';

export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
export const GMAIL_READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
export const GMAIL_COMPOSE_SCOPE = 'https://www.googleapis.com/auth/gmail.compose';

// ── crypto helpers ──
export const enc = new TextEncoder();
export const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
export const sha256 = async (s: string) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));

// One secret, purpose-bound keys: AES-GCM for tokens at rest here, HMAC for gcal's OAuth state.
export const secret = TOKEN_KEY ? fromB64url(TOKEN_KEY.replace(/=+$/, '')) : new Uint8Array();
export const deriveKey = (purpose: string) => crypto.subtle.digest('SHA-256', new Uint8Array([...enc.encode(purpose), ...secret]));
const aesKey = deriveKey('gcal-token:').then((raw) => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']));

/** Server has everything it needs to talk to Google and read stored tokens. */
export const googleConfigured = () => !!CLIENT_ID && !!CLIENT_SECRET && secret.length >= 32;

export async function seal(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey, enc.encode(plain)));
  return `${b64url(iv)}.${b64url(ct)}`;
}
export async function unseal(sealed: string): Promise<string> {
  const [iv, ct] = sealed.split('.');
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64url(iv) }, await aesKey, fromB64url(ct)));
}

/** The device key the app sends → the `owner` its accounts are stored under. */
export async function ownerOf(key: unknown): Promise<string | null> {
  return typeof key === 'string' && /^[0-9a-f]{64}$/.test(key) ? await sha256(key) : null;
}

// ── Google ──
/** The refresh token is dead (revoked, expired in Testing mode) — the person has to link again. */
export class ReauthError extends Error {}

export async function googleToken(params: Record<string, string>) {
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
  return data as { access_token: string; refresh_token?: string; id_token?: string; scope?: string };
}

export type TokenInfo = { scope?: string; sub?: string; email?: string };
export const tokenInfo = async (accessToken: string): Promise<TokenInfo> =>
  (await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`)).json().catch(() => ({}));
export const hasScope = (info: TokenInfo, scope: string) => typeof info.scope === 'string' && info.scope.split(' ').includes(scope);
