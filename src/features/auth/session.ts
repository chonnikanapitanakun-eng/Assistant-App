import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase, supabaseEnabled } from '@/lib/supabase';

type AuthState = { session: Session | null; ready: boolean };

/** `ready` is false only while the stored session is still loading (Phase 2 sign-in). */
const useAuthStore = create<AuthState>(() => ({ session: null, ready: !supabaseEnabled }));

if (supabase) {
  void supabase.auth.getSession().then(({ data }) => useAuthStore.setState({ session: data.session, ready: true }));
  supabase.auth.onAuthStateChange((_event, session) => useAuthStore.setState({ session }));
}

export const useSession = () => useAuthStore((s) => s.session);
export const useAuthReady = () => useAuthStore((s) => s.ready);

/** Non-reactive read — for code outside React (the sync engine, remote.ts's bearer token). */
export const getSession = () => useAuthStore.getState().session;

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}
