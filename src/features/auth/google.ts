import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase, supabaseEnabled } from '@/lib/supabase';

export const authEnabled = supabaseEnabled;

export type SignInResult = { ok: true } | { error: string } | null;

/**
 * Sign-in also asks for read-only Calendar access (offline, so Google hands back a refresh token) —
 * one consent screen links the calendar too; see `linkFromSignIn` in `features/google-calendar/connect.ts`.
 */
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

/**
 * Google sign-in via Supabase's hosted OAuth (same shape as `google-calendar/connect.ts`'s Google flow).
 * Web: the page leaves for Google; on return `detectSessionInUrl` (src/lib/supabase.ts) picks up the
 * session on its own — resolves null. Native: an in-app auth browser; the redirect carries a PKCE
 * `code` this function exchanges directly, no server round trip needed.
 */
export async function signInWithGoogle(): Promise<SignInResult> {
  if (!supabase) return { error: 'not_configured' };
  const redirectTo = Platform.OS === 'web' ? `${window.location.origin}/settings` : Linking.createURL('settings');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: Platform.OS !== 'web',
      scopes: CALENDAR_SCOPE,
      // consent: Google only returns a refresh token on a fresh consent.
      queryParams: { access_type: 'offline', prompt: 'consent select_account' },
    },
  });
  if (error || !data.url) return { error: error?.message ?? 'failed' };
  if (Platform.OS === 'web') {
    window.location.assign(data.url);
    return null;
  }
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return null;
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(result.url);
  return exchangeError ? { error: exchangeError.message } : { ok: true };
}
