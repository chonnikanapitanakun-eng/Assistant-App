import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Storage from 'expo-sqlite/kv-store';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Sign-in and cloud sync need the Supabase project (see docs/SYNC.md). */
export const authEnabled = !!url && !!anonKey;

/**
 * Where the session (refresh token) lives. Native: expo-sqlite's key-value store, same as the
 * profile. Web: supabase-js's default (localStorage). Both survive app restarts.
 */
const nativeStorage = {
  getItem: (key: string) => Storage.getItemAsync(key),
  setItem: (key: string, value: string) => Storage.setItemAsync(key, value),
  removeItem: async (key: string) => {
    await Storage.removeItemAsync(key);
  },
};

let client: SupabaseClient | null = null;

/**
 * The Supabase client, created on first use (not at import — the web build also renders on the
 * server, where there is no window). `null` when the project isn't configured.
 */
export function supabase(): SupabaseClient | null {
  if (!authEnabled) return null;
  client ??= createClient(url!, anonKey!, {
    auth: {
      storage: Platform.OS === 'web' ? undefined : nativeStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Web: the OAuth redirect lands back on /settings?code=… and supabase-js completes it.
      // Native: the code comes back through the in-app browser and store.ts exchanges it itself.
      detectSessionInUrl: Platform.OS === 'web',
      flowType: 'pkce',
    },
  });
  return client;
}
