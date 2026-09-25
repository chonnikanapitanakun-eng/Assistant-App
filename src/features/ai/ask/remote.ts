import { getSession } from '@/features/auth';

import type { AskRecordType, AskResponse, AskSuggestedAction } from '../types';
import type { Retrieval } from './retrieve';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Q&A runs only when the Supabase project is configured (see supabase/functions/ai-ask). */
export const askRemoteEnabled = !!url && !!anonKey;

/** A cited record, resolved back from the model's ref to a row the app can open. */
export type AskSource = { ref: string; type: AskRecordType; id: string; title: string };
export type AskResult = { answer: string; sources: AskSource[]; suggestedActions: AskSuggestedAction[]; followUps: string[]; status: 'ok' | 'refusal' | 'invalid' };

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isTime = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

/**
 * Send the question and what `retrieve()` found to the `ai-ask` Edge Function. Throws on network / HTTP
 * errors; resolves with `status !== 'ok'` and an empty answer when Claude declined or produced no usable JSON.
 */
export async function askRemote(question: string, retrieval: Retrieval, ctx: { locale: 'th' | 'en'; currency: string; name: string; now: Date }, signal?: AbortSignal): Promise<AskResult> {
  const res = await fetch(`${url}/functions/v1/ai-ask`, {
    method: 'POST',
    // Signed in: the user's JWT, so ai_usage logs the real user_id (supabase/functions/_shared/usage.ts).
    headers: { 'content-type': 'application/json', authorization: `Bearer ${getSession()?.access_token ?? anonKey}`, apikey: anonKey! },
    signal,
    body: JSON.stringify({
      question,
      locale: ctx.locale,
      today: localDate(ctx.now),
      weekday: WEEKDAYS[ctx.now.getDay()],
      currency: ctx.currency,
      name: ctx.name || undefined,
      facts: retrieval.facts,
      records: retrieval.records,
      coverage: retrieval.coverage,
    }),
  });
  if (!res.ok) throw new Error(`ai-ask ${res.status}`);
  const data = (await res.json()) as Partial<AskResponse>;
  const answer = typeof data.answer === 'string' ? data.answer.trim() : '';
  const status: AskResult['status'] = data.status === 'refusal' || data.status === 'invalid' ? data.status : answer ? 'ok' : 'invalid';

  // The function already dropped unknown refs; resolving through `refs` is the app's last line of defence.
  const sources: AskSource[] = [];
  for (const s of Array.isArray(data.sources) ? data.sources : []) {
    const hit = s && typeof s === 'object' && typeof (s as { ref?: unknown }).ref === 'string' ? retrieval.refs.get((s as { ref: string }).ref) : undefined;
    if (hit && !sources.some((x) => x.id === hit.id)) sources.push({ ref: (s as { ref: string }).ref, ...hit });
  }
  const suggestedActions = (Array.isArray(data.suggestedActions) ? data.suggestedActions : []).filter(isValidAction).slice(0, 3);
  const followUps = (Array.isArray(data.followUps) ? data.followUps : []).filter((q): q is string => typeof q === 'string' && !!q.trim()).slice(0, 3);
  return { answer, sources, suggestedActions, followUps, status };
}

function isValidAction(a: unknown): a is AskSuggestedAction {
  if (!a || typeof a !== 'object') return false;
  const it = a as Record<string, unknown>;
  const kind = it.type === 'task' || it.type === 'event' || it.type === 'note';
  const okDate = it.date === undefined || isDate(it.date);
  const okTime = it.startTime === undefined || isTime(it.startTime);
  return kind && typeof it.label === 'string' && !!it.label && typeof it.title === 'string' && !!it.title && okDate && okTime && (it.type !== 'event' || isDate(it.date));
}
