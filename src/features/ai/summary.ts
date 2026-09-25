import { getSession } from '@/features/auth';

/**
 * Contract ของ ai-summary (SPEC §6.4)
 * ใช้ร่วมกันระหว่าง app กับ Edge Function — เปลี่ยนที่นี่ต้องเปลี่ยนที่ supabase/functions/_shared/summary-contract.ts ด้วย
 */
export type SummaryScope = 'day' | 'week';

export type SummaryTask = { title: string; date: string | null; startTime: string | null; isDone: boolean; priority: number; overdue?: boolean };
export type SummaryEvent = { title: string; date: string; start?: string; end?: string; allDay: boolean; location?: string | null };
export type SummaryBill = { name: string; amount: number; currency: string; due: string; state: 'overdue' | 'today' | 'soon' | 'later' };
export type SummaryMoney = { income: number; expense: number; currency: string; topCategories: { name: string; total: number }[]; overBudget: { name: string; spent: number; budget: number }[] };
export type SummaryCheckin = { date: string; mood: number | null; energy: number | null; reflection: string | null };

export type SummaryRequest = {
  scope: SummaryScope;
  locale: 'th' | 'en';
  name: string;
  today: string; // YYYY-MM-DD
  weekday: string;
  from: string; // inclusive
  to: string; // inclusive
  currency: string;
  tasks: SummaryTask[];
  events: SummaryEvent[];
  bills: SummaryBill[];
  money: SummaryMoney;
  checkins: SummaryCheckin[];
};

export type SummaryResponse = {
  headline: string;
  summary: string;
  highlights: string[];
  needsAttention: string[];
};

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Claude summaries run only when the Supabase project is configured (see supabase/functions/ai-summary). */
export const summaryRemoteEnabled = !!url && !!anonKey;

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, 5) : []);

/**
 * Ask the `ai-summary` Edge Function for a written review. Throws on network / HTTP errors and resolves
 * to `null` when Claude declined or returned nothing usable, so the caller shows the local summary either way.
 */
export async function summaryRemote(req: SummaryRequest, signal?: AbortSignal): Promise<SummaryResponse | null> {
  const res = await fetch(`${url}/functions/v1/ai-summary`, {
    method: 'POST',
    // Signed in: the user's JWT, so ai_usage logs the real user_id (supabase/functions/_shared/usage.ts).
    headers: { 'content-type': 'application/json', authorization: `Bearer ${getSession()?.access_token ?? anonKey}`, apikey: anonKey! },
    signal,
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`ai-summary ${res.status}`);
  const data = (await res.json()) as { summary?: Partial<SummaryResponse> | null };
  const s = data.summary;
  if (!s || typeof s.summary !== 'string' || !s.summary.trim()) return null;
  return {
    headline: typeof s.headline === 'string' && s.headline.trim() ? s.headline.trim() : s.summary.trim().split(/(?<=[.!?。])\s/)[0],
    summary: s.summary.trim(),
    highlights: strings(s.highlights),
    needsAttention: strings(s.needsAttention),
  };
}
