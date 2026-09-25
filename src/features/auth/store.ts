import type { Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';

import { authEnabled, supabase } from './client';

export type Provider = 'apple' | 'google';
export type AuthUser = { id: string; email: string | null; provider: Provider | null };
export type AuthStatus = 'loading' | 'signed_out' | 'signed_in';

/** Who is signed in. `loading` until supabase-js has read the stored session (a few ms). */
export const useAuth = create<{ status: AuthStatus; user: AuthUser | null }>(() => ({ status: authEnabled ? 'loading' : 'signed_out', user: null }));

/** Code for i18n: `cancelled`, `apple_unavailable`, `not_configured`, `failed`. */
export class AuthError extends Error {
  constructor(public code: 'cancelled' | 'apple_unavailable' | 'not_configured' | 'failed', detail?: string) {
    super(detail ?? code);
  }
}

const toUser = (session: Session | null): AuthUser | null => {
  if (!session) return null;
  const provider = session.user.app_metadata?.provider;
  return { id: session.user.id, email: session.user.email ?? null, provider: provider === 'apple' || provider === 'google' ? provider : null };
};

let started = false;

/**
 * Follow the Supabase session for the life of the app: fills `useAuth`, and on native keeps the
 * access token fresh while the app is in the foreground (the browser does this by itself on web).
 * Safe to call more than once; only the first call does anything.
 */
export function startAuth(): void {
  const client = supabase();
  if (!client || started) return;
  started = true;

  client.auth.onAuthStateChange((_event, session) => {
    useAuth.setState({ status: session ? 'signed_in' : 'signed_out', user: toUser(session) });
  });

  if (Platform.OS !== 'web') {
    const onState = (state: string) => (state === 'active' ? client.auth.startAutoRefresh() : client.auth.stopAutoRefresh());
    AppState.addEventListener('change', onState);
    void onState(AppState.currentState);
  }
}

/** The URL the OAuth provider sends the user back to: this site on web, the app (or Expo Go) on native. */
export const authReturnUrl = () => (Platform.OS === 'web' ? `${window.location.origin}/settings` : Linking.createURL('/settings'));

/**
 * Sign in with Apple or Google. Resolves once the session exists (native) or never (web, where the
 * page navigates to the provider and supabase-js completes the sign-in when it comes back).
 * Throws `AuthError`; `cancelled` when the user backed out.
 */
export async function signIn(provider: Provider): Promise<void> {
  const client = supabase();
  if (!client) throw new AuthError('not_configured');

  if (Platform.OS === 'ios' && provider === 'apple') return signInWithAppleNative();

  const redirectTo = authReturnUrl();
  const { data, error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: Platform.OS !== 'web' } });
  if (error) throw new AuthError('failed', error.message);
  if (Platform.OS === 'web') return; // the browser is on its way to the provider

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') throw new AuthError('cancelled');
  const { queryParams } = Linking.parse(result.url);
  const code = typeof queryParams?.code === 'string' ? queryParams.code : null;
  if (!code) {
    const reason = typeof queryParams?.error_description === 'string' ? queryParams.error_description : typeof queryParams?.error === 'string' ? queryParams.error : 'no code';
    throw new AuthError(/denied|cancel/i.test(reason) ? 'cancelled' : 'failed', reason);
  }
  const exchanged = await client.auth.exchangeCodeForSession(code);
  if (exchanged.error) throw new AuthError('failed', exchanged.error.message);
}

/** iOS: the system Sign in with Apple sheet, then the identity token goes to Supabase. */
async function signInWithAppleNative(): Promise<void> {
  const client = supabase()!;
  if (!(await AppleAuthentication.isAvailableAsync())) throw new AuthError('apple_unavailable');
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
  } catch (e) {
    const code = (e as { code?: string }).code;
    throw new AuthError(code === 'ERR_REQUEST_CANCELED' ? 'cancelled' : 'failed', String(e));
  }
  if (!credential.identityToken) throw new AuthError('failed', 'no identity token');
  const { error } = await client.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken });
  if (error) throw new AuthError('failed', error.message);
}

/** Signs out on this device only. Local data stays; signing in again as the same user carries on syncing. */
export async function signOut(): Promise<void> {
  const client = supabase();
  if (!client) return;
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) throw new AuthError('failed', error.message);
}
