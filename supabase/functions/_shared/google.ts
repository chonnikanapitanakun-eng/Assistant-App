// Google OAuth helpers shared by `gcal` and `gmail`: the at-rest token cipher, signed OAuth state,
// the token endpoint and tokeninfo. Each function has its own OAuth client (own Google Cloud
// project) and its own tables — Gmail's restricted scopes stay out of the verified Calendar app.
//
// Secret: GCAL_TOKEN_KEY (32+ random bytes, base64) — encrypts both functions' refresh tokens.

export type OAuthClient = { id: string; secret: string };

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

// One secret, purpose-bound keys: AES-GCM for tokens at rest, HMAC per function for OAuth state.
export const secret = TOKEN_KEY ? fromB64url(TOKEN_KEY.replace(/=+$/, '')) : new Uint8Array();
export const deriveKey = (purpose: string) => crypto.subtle.digest('SHA-256', new Uint8Array([...enc.encode(purpose), ...secret]));
const aesKey = deriveKey('gcal-token:').then((raw) => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']));

/** Server has everything it needs to talk to Google and read stored tokens. */
export const googleConfigured = (client: OAuthClient) => !!client.id && !!client.secret && secret.length >= 32;

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

export const randomToken = () => b64url(crypto.getRandomValues(new Uint8Array(32)));

/** Comma list from a secret, tolerating quotes pasted into the dashboard. */
export const envList = (value: string | undefined, fallback: string) =>
  (value ?? fallback)
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);

/**
 * HMAC-signed OAuth `state` (owner device + return URL + expiry) for one function's consent flow.
 * `returnPrefixes` are the only URLs Google may send the person back to — never an arbitrary URL.
 */
export function oauthState(purpose: string, returnPrefixes: string[]) {
  type State = { o: string; r: string; e: number };
  const hmacKey = deriveKey(`${purpose}-state:`).then((raw) => crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']));
  const allowedReturn = (url: unknown): url is string => typeof url === 'string' && url.length < 1000 && returnPrefixes.some((p) => url.startsWith(p));
  return {
    allowedReturn,
    async sign(s: State): Promise<string> {
      const body = b64url(enc.encode(JSON.stringify(s)));
      const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey, enc.encode(body)));
      return `${body}.${b64url(sig)}`;
    },
    async read(raw: string | null): Promise<State | null> {
      const [body, sig] = (raw ?? '').split('.');
      if (!body || !sig) return null;
      try {
        if (!(await crypto.subtle.verify('HMAC', await hmacKey, fromB64url(sig), enc.encode(body)))) return null;
        const s = JSON.parse(new TextDecoder().decode(fromB64url(body))) as State;
        return s.e > Date.now() && allowedReturn(s.r) ? s : null;
      } catch {
        return null;
      }
    },
  };
}

export const withParams = (url: string, params: Record<string, string>) => {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
};

// ── Google ──
/** The refresh token is dead (revoked, expired in Testing mode) — the person has to link again. */
export class ReauthError extends Error {}

export async function googleToken(client: OAuthClient, params: Record<string, string>) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: client.id, client_secret: client.secret, ...params }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (data.error === 'invalid_grant') throw new ReauthError(data.error);
    throw new Error(`token ${res.status} ${data.error ?? ''}`);
  }
  return data as { access_token: string; refresh_token?: string; id_token?: string; scope?: string };
}

/** The id_token comes straight from Google's token endpoint over TLS, so its payload is trusted as-is. */
export function idClaims(idToken: string | undefined): { sub: string; email: string } | null {
  try {
    const p = JSON.parse(new TextDecoder().decode(fromB64url(idToken!.split('.')[1])));
    return typeof p.sub === 'string' && typeof p.email === 'string' ? { sub: p.sub, email: p.email } : null;
  } catch {
    return null;
  }
}

export type TokenInfo = { scope?: string; sub?: string; email?: string };
export const tokenInfo = async (accessToken: string): Promise<TokenInfo> =>
  (await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`)).json().catch(() => ({}));
export const hasScope = (info: TokenInfo, scope: string) => typeof info.scope === 'string' && info.scope.split(' ').includes(scope);
