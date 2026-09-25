import { getSession } from '@/features/auth';
import { deviceKey } from '@/features/google-calendar/device-key';

import type { GmailStatus, InboxAccount, ThreadInsight } from './types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Gmail is personal-use only until Google verifies its restricted scopes (docs/GMAIL_OAUTH_VERIFICATION.md):
 * builds show the Inbox only with `EXPO_PUBLIC_GMAIL=1`, and the `gmail` function has its own OAuth client.
 */
export const gmailEnabled = !!url && !!anonKey && process.env.EXPO_PUBLIC_GMAIL === '1';

/** Error code from the function: `reauth`, `scope`, `not_found`, `rate_limited`, `failed`, … */
export class GmailError extends Error {}

async function call<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${url}/functions/v1/gmail`, {
    method: 'POST',
    // Signed in: the user's JWT, so ai_usage logs the real user_id.
    headers: { 'content-type': 'application/json', authorization: `Bearer ${getSession()?.access_token ?? anonKey}`, apikey: anonKey! },
    body: JSON.stringify({ action, key: deviceKey(), ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new GmailError(typeof data.error === 'string' ? data.error : `http_${res.status}`);
  return data as T;
}

export type LinkedAccount = { id: string; email: string; status: GmailStatus };

export const startAuth = (returnUrl: string, loginHint?: string) => call<{ url: string }>('start', { returnUrl, loginHint });
export const finishAuth = (ticket: string) => call<{ account: LinkedAccount }>('finish', { ticket });
export const revokeAccount = (accountId: string) => call<{ ok: true }>('disconnect', { accountId });
export const fetchInbox = () => call<{ accounts: InboxAccount[] }>('inbox').then((r) => r.accounts);
export const fetchInsight = (accountId: string, threadId: string, locale: 'th' | 'en') =>
  call<{ insight: ThreadInsight }>('insight', { accountId, threadId, locale }).then((r) => r.insight);
export const saveDraft = (accountId: string, threadId: string, body: string) => call<{ draftId: string }>('draft', { accountId, threadId, body });
