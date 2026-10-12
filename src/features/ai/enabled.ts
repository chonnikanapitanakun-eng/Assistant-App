import { useProfile } from '@/features/profile/store';

/** The Edge Functions that call Claude exist only when the Supabase project is configured. */
export const aiRemoteAvailable = !!process.env.EXPO_PUBLIC_SUPABASE_URL && !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Features that call Claude through the Edge Functions bill the Anthropic API, so they run only when
 * the user turns on "Claude API" in Settings (off by default). Off, the app uses its on-device engines
 * and Claude reaches the data through the MCP connector instead (supabase/functions/mcp).
 */
export const isAiRemoteOn = (): boolean => aiRemoteAvailable && useProfile.getState().claudeApi;

/** `isAiRemoteOn` as a hook, so screens re-render when the setting changes. */
export const useAiRemote = (): boolean => useProfile((p) => aiRemoteAvailable && p.claudeApi);
