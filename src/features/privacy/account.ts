import { getSession } from '@/features/auth';
import { supabaseAnonKey, supabaseEnabled, supabaseUrl } from '@/lib/supabase';

import { eraseLocalData } from './erase';

export const accountDeleteEnabled = supabaseEnabled;

/** Error code from the function (`bad_token`, `failed`) or `http_<status>` / `not_signed_in`. */
export class AccountError extends Error {}

/**
 * PDPA erasure, all of it: the `account` Edge Function deletes the auth user (every synced table,
 * AI usage log and Google Calendar link cascade with it), then this device is wiped too
 * (`eraseLocalData`, signed out locally — the server-side session no longer exists).
 */
export async function deleteAccount(): Promise<void> {
  const token = getSession()?.access_token;
  if (!token || !supabaseEnabled) throw new AccountError('not_signed_in');
  const res = await fetch(`${supabaseUrl}/functions/v1/account`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, apikey: supabaseAnonKey! },
    body: JSON.stringify({ action: 'delete' }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: unknown };
    throw new AccountError(typeof data.error === 'string' ? data.error : `http_${res.status}`);
  }
  await eraseLocalData({ local: true });
}
