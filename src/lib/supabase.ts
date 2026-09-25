import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { readRaw, removeKey, writeRaw } from '@/features/profile/storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Sign-in and cloud sync need the Supabase project (see docs on `features/auth`, `features/sync`). */
export const supabaseEnabled = !!url && !!anonKey;

/** Session storage for supabase-js — same kv-store as the rest of the app (see profile/storage.ts). */
const authStorage = {
  getItem: async (key: string) => readRaw(key),
  setItem: async (key: string, value: string) => writeRaw(key, value),
  removeItem: async (key: string) => removeKey(key),
};

export const supabase = supabaseEnabled
  ? createClient(url!, anonKey!, {
      auth: { storage: authStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: Platform.OS === 'web', flowType: 'pkce' },
    })
  : null;

export { anonKey as supabaseAnonKey, url as supabaseUrl };
