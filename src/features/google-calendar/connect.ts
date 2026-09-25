import { isNull } from 'drizzle-orm';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { calendarAccounts, commit, db } from '@/db';

import { pickColor } from './model';
import { finishAuth, revokeAccount, startAuth } from './remote';
import { removeLocal, syncGoogleCalendars, upsertAccount } from './sync';

/** Google redirects back to Settings with `?gcal=<ticket>` or `?gcal_error=<code>`. */
export type AuthReturn = { gcal?: string; gcal_error?: string };
export type ConnectResult = { email: string } | { error: string } | null;

const returnUrl = () => (Platform.OS === 'web' ? `${window.location.origin}/settings` : Linking.createURL('settings'));

/**
 * Link a Google account (or re-link one that needs it, via `loginHint`).
 * Web: the page leaves for Google and Settings finishes the job on return (resolves null).
 * Native: an in-app auth browser; resolves when the account is linked, or null if cancelled.
 */
export async function connectGoogle(loginHint?: string): Promise<ConnectResult> {
  const { url } = await startAuth(returnUrl(), loginHint);
  if (Platform.OS === 'web') {
    window.location.assign(url);
    return null;
  }
  const result = await WebBrowser.openAuthSessionAsync(url, returnUrl());
  if (result.type !== 'success') return null;
  const { queryParams } = Linking.parse(result.url);
  return completeGoogleConnect({ gcal: str(queryParams?.gcal), gcal_error: str(queryParams?.gcal_error) });
}

const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

// Android can deliver the same redirect twice (auth session + deep link into Settings).
const claimed = new Map<string, Promise<ConnectResult>>();

/** Claim the ticket from the redirect, save the account locally and pull its events. */
export function completeGoogleConnect(ret: AuthReturn): Promise<ConnectResult> {
  if (ret.gcal_error) return Promise.resolve({ error: ret.gcal_error });
  const ticket = ret.gcal;
  if (!ticket) return Promise.resolve(null);
  let p = claimed.get(ticket);
  if (!p) {
    p = (async () => {
      const { account } = await finishAuth(ticket);
      const used = await db.select({ color: calendarAccounts.color }).from(calendarAccounts).where(isNull(calendarAccounts.deletedAt)).all();
      await commit([upsertAccount(account.id, account.email, account.status, pickColor(used.map((u) => u.color)))]);
      await syncGoogleCalendars({ force: true });
      return { email: account.email };
    })();
    claimed.set(ticket, p);
  }
  return p;
}

/** Unlink: revoke on the server first (so the token is gone), then hide it locally. */
export async function disconnectGoogle(accountId: string) {
  await revokeAccount(accountId);
  await commit(removeLocal(accountId));
}
