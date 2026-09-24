import type { AssistantContext, Card, Proposal, Reply } from './types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Claude answers only when the Supabase project is configured (see supabase/functions/assistant). */
export const remoteEnabled = !!url && !!anonKey;

type RemoteResponse = { text: string; proposals: Proposal[]; suggestions?: string[] };

/**
 * Ask Veyra AI (Claude, via the `assistant` Edge Function). The function only proposes
 * actions; the app still asks the user to confirm each one. Throws on network/HTTP errors
 * so the caller can fall back to the on-device engine.
 */
export async function askRemote(history: { role: 'user' | 'assistant'; text: string }[], ctx: AssistantContext, locale: string): Promise<Reply> {
  const res = await fetch(`${url}/functions/v1/assistant`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${anonKey}`, apikey: anonKey! },
    body: JSON.stringify({
      locale,
      messages: history.slice(-12).map((m) => ({ role: m.role, content: m.text })),
      context: { ...ctx, now: ctx.now.toISOString(), today: ctx.now.toISOString().slice(0, 10) },
    }),
  });
  if (!res.ok) throw new Error(`assistant ${res.status}`);
  const data = (await res.json()) as RemoteResponse;
  const cards: Card[] = (data.proposals ?? []).map((p, i) => ({ type: 'proposal', id: `r${Date.now().toString(36)}${i}`, proposal: p, state: 'pending' }));
  return { text: data.text ?? '', cards, suggestions: data.suggestions ?? [], source: 'claude' };
}
