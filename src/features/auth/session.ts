import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase, supabaseEnabled } from '@/lib/supabase';

/** `providerRefreshToken`: Google's refresh token from the sign-in that just happened (Supabase only has it right then). */
type AuthState = { session: Session | null; ready: boolean; providerRefreshToken: string | null };

/** `ready` is false only while the stored session is still loading (Phase 2 sign-in). */
const useAuthStore = create<AuthState>(() => ({ session: null, ready: !supabaseEnabled, providerRefreshToken: null }));

if (supabase) {
  void supabase.auth.getSession().then(({ data }) => useAuthStore.setState({ session: data.session, ready: true }));
  supabase.auth.onAuthStateChange((event, session) => {
    const fresh = event === 'SIGNED_IN' ? session?.provider_refresh_token : undefined;
    useAuthStore.setState(fresh ? { session, providerRefreshToken: fresh } : { session });
  });
}

export const useSession = () => useAuthStore((s) => s.session);
export const useAuthReady = () => useAuthStore((s) => s.ready);

/** Non-reactive read — for code outside React (the sync engine, remote.ts's bearer token). */
export const getSession = () => useAuthStore.getState().session;

/** Google refresh token from the latest sign-in, until taken — used to link its calendar. */
export const useProviderRefreshToken = () => useAuthStore((s) => s.providerRefreshToken);
export const clearProviderRefreshToken = () => useAuthStore.setState({ providerRefreshToken: null });

/**
 * `local`: forget the session on this device only, without telling the server — for when the
 * server side is already gone (account deletion) or unreachable.
 */
export async function signOut({ local = false } = {}) {
  if (supabase) await supabase.auth.signOut(local ? { scope: 'local' } : undefined);
  // SIGNED_OUT normally lands through onAuthStateChange; setting it here too keeps callers that
  // continue synchronously (erase, delete account) from seeing a stale session.
  useAuthStore.setState({ session: null, providerRefreshToken: null });
}
