import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { finishAuth, startAuth } from './remote';

/** Google redirects back to the Inbox with `?gmail=<ticket>` or `?gmail_error=<code>`. */
export type GmailReturn = { gmail?: string; gmail_error?: string };
export type GmailConnectResult = { email: string } | { error: string } | null;

const returnUrl = () => (Platform.OS === 'web' ? `${window.location.origin}/inbox` : Linking.createURL('inbox'));
const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

/**
 * Link a Google account for Gmail (or re-link one, via `loginHint`) — Gmail's own consent screen,
 * separate from sign-in and Calendar. Web: the page leaves for Google and the Inbox finishes on
 * return (resolves null). Native: an in-app auth browser; resolves once linked, or null if cancelled.
 */
export async function connectGmail(loginHint?: string): Promise<GmailConnectResult> {
  const { url } = await startAuth(returnUrl(), loginHint);
  if (Platform.OS === 'web') {
    window.location.assign(url);
    return null;
  }
  const result = await WebBrowser.openAuthSessionAsync(url, returnUrl());
  if (result.type !== 'success') return null;
  const { queryParams } = Linking.parse(result.url);
  return completeGmailConnect({ gmail: str(queryParams?.gmail), gmail_error: str(queryParams?.gmail_error) });
}

// Android can deliver the same redirect twice (auth session + deep link into the Inbox).
const claimed = new Map<string, Promise<GmailConnectResult>>();

/** Claim the ticket from the redirect (same device only). */
export function completeGmailConnect(ret: GmailReturn): Promise<GmailConnectResult> {
  if (ret.gmail_error) return Promise.resolve({ error: ret.gmail_error });
  const ticket = ret.gmail;
  if (!ticket) return Promise.resolve(null);
  let p = claimed.get(ticket);
  if (!p) {
    p = finishAuth(ticket).then(({ account }) => ({ email: account.email }));
    claimed.set(ticket, p);
  }
  return p;
}
