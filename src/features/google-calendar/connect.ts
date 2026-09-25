import { isNull } from 'drizzle-orm';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { calendarAccounts, commit, db } from '@/db';

import { pickColor } from './model';
import { finishAuth, gcalEnabled, linkSignInAccount, revokeAccount, startAuth } from './remote';
import { removeLocal, syncGoogleCalendars, upsertAccount } from './sync';
import type { AccountStatus } from './types';

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
    p = finishAuth(ticket).then(({ account }) => saveLinked(account));
    claimed.set(ticket, p);
  }
  return p;
}

/**
 * Right after Google sign-in (which also asked for Calendar + Gmail access): link that same account.
 * Already linked on this device → still hand the server the fresh refresh token, which carries the
 * Gmail scopes an older link may lack (P4-01). Adding more accounts stays in Settings (`connectGoogle`).
 */
export async function linkFromSignIn(accessToken: string, refreshToken: string, email: string | undefined): Promise<ConnectResult> {
  if (!gcalEnabled) return null;
  const linked = await db.select({ email: calendarAccounts.email }).from(calendarAccounts).where(isNull(calendarAccounts.deletedAt)).all();
  const { account } = await linkSignInAccount(accessToken, refreshToken);
  if (email && linked.some((a) => a.email.toLowerCase() === email.toLowerCase())) return null;
  return saveLinked(account);
}

/** Save a newly linked account locally and pull its events. */
async function saveLinked(account: { id: string; email: string; status: AccountStatus }): Promise<ConnectResult> {
  const used = await db.select({ color: calendarAccounts.color }).from(calendarAccounts).where(isNull(calendarAccounts.deletedAt)).all();
  await commit([upsertAccount(account.id, account.email, account.status, pickColor(used.map((u) => u.color)))]);
  await syncGoogleCalendars({ force: true });
  return { email: account.email };
}

/** Unlink: revoke on the server first (so the token is gone), then hide it locally. */
export async function disconnectGoogle(accountId: string) {
  await revokeAccount(accountId);
  await commit(removeLocal(accountId));
}
