import { deviceKey } from './device-key';
import type { AccountStatus, SyncAccount } from './types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Google Calendar import needs the Supabase project (see supabase/functions/gcal). */
export const gcalEnabled = !!url && !!anonKey;

/** Error code from the function, e.g. `not_configured`, `too_many_accounts`, `bad_ticket`. */
export class GcalError extends Error {}

async function call<T>(action: string, body: Record<string, unknown> = {}, bearer = anonKey): Promise<T> {
  const res = await fetch(`${url}/functions/v1/gcal`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${bearer}`, apikey: anonKey! },
    body: JSON.stringify({ action, key: deviceKey(), ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new GcalError(typeof data.error === 'string' ? data.error : `http_${res.status}`);
  return data as T;
}

export const startAuth = (returnUrl: string, loginHint?: string) => call<{ url: string }>('start', { returnUrl, loginHint });
export const finishAuth = (ticket: string) => call<{ account: { id: string; email: string; status: AccountStatus } }>('finish', { ticket });
export const fetchSync = (from: number, to: number) =>
  call<{ accounts: SyncAccount[] }>('sync', { timeMin: new Date(from).toISOString(), timeMax: new Date(to).toISOString() }).then((r) => r.accounts);
export const revokeAccount = (accountId: string) => call<{ ok: true }>('disconnect', { accountId });

/** Attach this device's Google Calendar accounts to the signed-in user (features/sync/auto-sync.tsx). */
export const claimGoogleAccounts = (accessToken: string) =>
  gcalEnabled ? call<{ ok: true }>('claim', {}, accessToken).then(() => undefined) : Promise.resolve();

/** Link the Google account used to sign in, from the refresh token Supabase Auth returned (connect.ts). */
export const linkSignInAccount = (accessToken: string, refreshToken: string) =>
  call<{ account: { id: string; email: string; status: AccountStatus } }>('link', { refreshToken }, accessToken);
