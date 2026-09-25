import { getSession } from '@/features/auth';

import type { BreakdownResponse, BreakdownSubtask } from './types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** AI task breakdown runs only when the Supabase project is configured (see supabase/functions/ai-breakdown). */
export const breakdownRemoteEnabled = !!url && !!anonKey;

/**
 * Ask the `ai-breakdown` Edge Function to split a task into checklist steps. Throws on network / HTTP
 * errors; resolves to an empty list when Claude found nothing worth adding (already atomic, or a refusal).
 * `existing` is the task's current checklist text, so Claude doesn't suggest what's already there.
 */
export async function breakdownRemote(
  title: string,
  opts: { notes?: string; locale?: 'th' | 'en'; existing?: string[] } = {},
  signal?: AbortSignal,
): Promise<BreakdownResponse> {
  const res = await fetch(`${url}/functions/v1/ai-breakdown`, {
    method: 'POST',
    // Signed in: the user's JWT, so ai_usage logs the real user_id (supabase/functions/_shared/usage.ts).
    headers: { 'content-type': 'application/json', authorization: `Bearer ${getSession()?.access_token ?? anonKey}`, apikey: anonKey! },
    signal,
    body: JSON.stringify({ title, notes: opts.notes, locale: opts.locale, existing: opts.existing?.slice(0, 20) }),
  });
  if (!res.ok) throw new Error(`ai-breakdown ${res.status}`);
  const data = (await res.json()) as Partial<BreakdownResponse>;
  const subtasks = Array.isArray(data.subtasks) ? data.subtasks.filter(isValidSubtask) : [];
  return { subtasks };
}

/** The function already normalises its output; this is the app's last line of defence before rendering. */
function isValidSubtask(item: unknown): item is BreakdownSubtask {
  return !!item && typeof item === 'object' && typeof (item as Record<string, unknown>).text === 'string' && !!(item as Record<string, unknown>).text;
}
