import { getSession } from '@/features/auth';
import { checkAiResponse } from '@/features/premium';

import type { CaptureItem, CaptureResponse } from './types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Claude capture runs only when the Supabase project is configured (see supabase/functions/ai-capture). */
export const captureRemoteEnabled = !!url && !!anonKey;

export type CaptureContext = {
  locale: 'th' | 'en';
  today: Date;
  defaultCurrency: string;
  contacts: string[];
  areas: string[];
  wallets: string[];
  categories: { expense: string[]; income: string[] };
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isTime = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

/**
 * Ask the `ai-capture` Edge Function to split text into items. Throws on network / HTTP errors and
 * resolves to an empty list when Claude found nothing, so the caller keeps the local parse either way.
 */
export async function captureRemote(text: string, ctx: CaptureContext, signal?: AbortSignal): Promise<CaptureResponse> {
  const res = await fetch(`${url}/functions/v1/ai-capture`, {
    method: 'POST',
    // Signed in: the user's JWT, so ai_usage logs the real user_id (supabase/functions/_shared/usage.ts).
    headers: { 'content-type': 'application/json', authorization: `Bearer ${getSession()?.access_token ?? anonKey}`, apikey: anonKey! },
    signal,
    body: JSON.stringify({
      text,
      locale: ctx.locale,
      today: localDate(ctx.today),
      weekday: WEEKDAYS[ctx.today.getDay()],
      defaultCurrency: ctx.defaultCurrency,
      contacts: ctx.contacts.slice(0, 60),
      areas: ctx.areas.slice(0, 30),
      wallets: ctx.wallets.slice(0, 20),
      categories: ctx.categories,
    }),
  });
  await checkAiResponse(res, 'ai-capture'); // 402 / quota 429 → PremiumGateError, local parse stays
  const data = (await res.json()) as Partial<CaptureResponse>;
  const items = Array.isArray(data.items) ? data.items.filter(isValidItem) : [];
  return { items, confidence: typeof data.confidence === 'number' ? data.confidence : 0 };
}

/** The function already normalises its output; this is the app's last line of defence before rendering. */
function isValidItem(item: unknown): item is CaptureItem {
  if (!item || typeof item !== 'object') return false;
  const it = item as Record<string, unknown>;
  const okTimes = (it.startTime === undefined || isTime(it.startTime)) && (it.endTime === undefined || isTime(it.endTime));
  switch (it.type) {
    case 'task':
      return typeof it.title === 'string' && !!it.title && (it.date === undefined || isDate(it.date)) && okTimes;
    case 'event':
      return typeof it.title === 'string' && !!it.title && isDate(it.date) && okTimes;
    case 'expense':
    case 'income':
      return typeof it.amount === 'number' && it.amount > 0 && typeof it.currency === 'string' && (it.date === undefined || isDate(it.date));
    case 'note':
      return typeof it.body === 'string' && !!it.body;
    case 'contact':
      return typeof it.name === 'string' && !!it.name;
  }
  return false;
}
