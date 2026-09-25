import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

import type { SignInResult } from './google';

/**
 * Sign in with Apple (App Store guideline 4.8: required next to Google sign-in on iOS).
 * iOS: the system Apple sheet (`expo-apple-authentication`), then its identity token goes to
 * Supabase (`signInWithIdToken`) — no browser. Android / web: Supabase's hosted Apple OAuth, same
 * shape as `signInWithGoogle` (web leaves the page and resolves null; native exchanges the PKCE code).
 * Resolves null when the user cancelled; `{ error: 'apple_unavailable' }` on an iPhone without it.
 */
export async function signInWithApple(): Promise<SignInResult> {
  if (!supabase) return { error: 'not_configured' };
  if (Platform.OS === 'ios') return signInWithAppleNative();

  const redirectTo = Platform.OS === 'web' ? `${window.location.origin}/settings` : Linking.createURL('settings');
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'apple', options: { redirectTo, skipBrowserRedirect: Platform.OS !== 'web' } });
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

async function signInWithAppleNative(): Promise<SignInResult> {
  if (!(await AppleAuthentication.isAvailableAsync())) return { error: 'apple_unavailable' };
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null;
    return { error: e instanceof Error ? e.message : 'failed' };
  }
  if (!credential.identityToken) return { error: 'no identity token' };
  const { error } = await supabase!.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken });
  return error ? { error: error.message } : { ok: true };
}
