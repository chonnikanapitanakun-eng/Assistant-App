/**
 * Features that call Claude through the Edge Functions bill the Anthropic API, so they are off unless
 * `EXPO_PUBLIC_AI_REMOTE=on`. Off, the app uses its on-device engines and Claude reaches the data through
 * the MCP connector instead (supabase/functions/mcp — runs on the owner's Claude subscription).
 */
export const aiRemoteEnabled =
  !!process.env.EXPO_PUBLIC_SUPABASE_URL && !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY && process.env.EXPO_PUBLIC_AI_REMOTE === 'on';
