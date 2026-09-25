import { isValidItem } from '@/features/ai/remote';
import { toDateKey } from '@/lib/date';

import type { AssistantContext, Card, Proposal, Reply } from './types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Claude answers only when the Supabase project is configured (see supabase/functions/assistant). */
export const remoteEnabled = !!url && !!anonKey;

/** A hung request must not lock the chat; after this the caller falls back to the on-device engine. */
export const ASSISTANT_TIMEOUT_MS = 60_000;

/** Messages of history sent per request (odd, so a full window starts and ends with a user turn). */
const HISTORY_WINDOW = 13;

type ChatTurn = { role: 'user' | 'assistant'; text: string };
type RemoteResponse = { text: string; proposals: Proposal[]; suggestions?: string[] };

/**
 * The slice of the conversation sent to Claude. The Messages API needs the first message to be a
 * `user` turn, so the window never starts with an `assistant` message; it always ends with the new
 * user message. Empty turns are dropped first (the Edge Function drops them too).
 */
export function windowHistory(history: ChatTurn[], max = HISTORY_WINDOW): ChatTurn[] {
  const window = history.filter((m) => m.text.trim()).slice(-max);
  const firstUser = window.findIndex((m) => m.role === 'user');
  return firstUser < 0 ? [] : window.slice(firstUser);
}

/** Local wall-clock time with its UTC offset, e.g. 2026-09-25T06:30:00+07:00 (not UTC like toISOString). */
export function localIsoString(d: Date): string {
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  return `${toDateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(offset / 60)}:${pad(offset % 60)}`;
}

/** Keep only proposals whose shape the app can run; a `create` keeps only its valid items. */
export function sanitizeProposals(raw: unknown): Proposal[] {
  if (!Array.isArray(raw)) return [];
  const out: Proposal[] = [];
  for (const p of raw as Record<string, unknown>[]) {
    if (!p || typeof p !== 'object') continue;
    const str = (v: unknown) => typeof v === 'string' && !!v;
    switch (p.kind) {
      case 'create': {
        const items = Array.isArray(p.items) ? p.items.filter(isValidItem) : [];
        if (items.length) out.push({ kind: 'create', items });
        break;
      }
      case 'complete_task':
      case 'reschedule_task':
        if (str(p.taskId) && (p.kind === 'complete_task' || str(p.date))) out.push(p as unknown as Proposal);
        break;
      case 'pay_bill':
        if (str(p.billId)) out.push(p as unknown as Proposal);
        break;
    }
  }
  return out;
}

/**
 * Ask Veyra AI (Claude, via the `assistant` Edge Function). The function only proposes
 * actions; the app still asks the user to confirm each one. Throws on network/HTTP errors and
 * after ASSISTANT_TIMEOUT_MS so the caller can fall back to the on-device engine.
 */
export async function askRemote(history: ChatTurn[], ctx: AssistantContext, locale: string): Promise<Reply> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ASSISTANT_TIMEOUT_MS);
  try {
    const res = await fetch(`${url}/functions/v1/assistant`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${anonKey}`, apikey: anonKey! },
      signal: controller.signal,
      body: JSON.stringify({
        locale,
        messages: windowHistory(history).map((m) => ({ role: m.role, content: m.text })),
        // Local date and wall-clock time: a UTC date is "yesterday" in Thailand before 07:00.
        context: { ...ctx, now: localIsoString(ctx.now), today: toDateKey(ctx.now) },
      }),
    });
    if (!res.ok) throw new Error(`assistant ${res.status}`);
    const data = (await res.json()) as Partial<RemoteResponse>;
    const cards: Card[] = sanitizeProposals(data.proposals).map((p, i) => ({ type: 'proposal', id: `r${Date.now().toString(36)}${i}`, proposal: p, state: 'pending' }));
    return { text: typeof data.text === 'string' ? data.text : '', cards, suggestions: Array.isArray(data.suggestions) ? data.suggestions.filter((s) => typeof s === 'string') : [], source: 'claude' };
  } finally {
    clearTimeout(timer);
  }
}
