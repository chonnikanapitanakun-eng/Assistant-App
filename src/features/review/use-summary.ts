import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { summaryRemote, summaryRemoteEnabled, type SummaryRequest, type SummaryResponse, type SummaryScope } from '@/features/ai/summary';
import { eventToItem } from '@/features/calendar/model';
import { useEventsBetween } from '@/features/calendar/queries';
import { billState, nextDueDate } from '@/features/money/model';
import { useBills, useCategories, useTransactions } from '@/features/money/queries';
import { readJSON, writeJSON } from '@/features/profile/storage';
import { useProfile } from '@/features/profile/store';
import { useAllTasks } from '@/features/tasks/queries';
import { addDays, toDateKey } from '@/lib/date';

import { buildSummaryRequest, localSummary, summaryRange } from './model';
import { useCheckinsBetween } from './queries';

/** Everything `ai-summary` needs for the range, from live rows (SPEC §6.4: retrieval first, never the whole DB). */
export function useSummaryRequest(scope: SummaryScope): SummaryRequest {
  const name = useProfile((p) => p.name);
  const currency = useProfile((p) => p.currency);
  const locale = useProfile((p) => p.language);
  const today = toDateKey();
  const { from, to } = summaryRange(scope, new Date());
  const tasks = useAllTasks();
  const eventRows = useEventsBetween(from, toDateKey(addDays(new Date(`${to}T12:00:00`), 1)));
  const billRows = useBills();
  const transactions = useTransactions();
  const categoryRows = useCategories();
  const checkins = useCheckinsBetween(from, to);

  return useMemo(() => {
    const now = new Date();
    const events = eventRows.map(eventToItem);
    const bills = billRows.map((b) => {
      const due = nextDueDate(b, now);
      return { name: b.name, amount: b.amount, currency: b.currency, due, ...billState(due, b.remindDaysBefore, now) };
    });
    const categories = categoryRows.map((c) => ({ id: c.id, name: locale === 'th' ? c.nameTh : c.nameEn, type: c.type, budgetMonthly: c.budgetMonthly }));
    return buildSummaryRequest({ scope, locale, name, currency, now, tasks, events, bills, transactions, categories, checkins });
    // `today` stands in for `now`: the request only changes when the day (or the rows) change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, locale, name, currency, today, tasks, eventRows, billRows, transactions, categoryRows, checkins]);
}

type Cached = { fingerprint: string; generatedAt: number; response: SummaryResponse };
const cacheKey = (req: SummaryRequest) => `veyra.summary.${req.scope}.${req.from}`;
const REUSE_MS = 30 * 60_000; // same range, rows changed: keep Claude's text for half an hour before asking again

/** The cached review for this range, when it still fits: same data, or newer than REUSE_MS. */
function readCached(key: string, fp: string): Cached | null {
  const c = readJSON<Cached>(key);
  return c && (c.fingerprint === fp || Date.now() - c.generatedAt < REUSE_MS) ? c : null;
}

/** Cheap stable digest of the request so a cached summary is reused until the data behind it changes. */
export function fingerprint(req: SummaryRequest): string {
  const s = JSON.stringify(req);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `${s.length}:${h}`;
}

export type SummaryState = {
  request: SummaryRequest;
  /** What to show: Claude's review when available, else the rule-based one. */
  review: SummaryResponse;
  source: 'claude' | 'local';
  status: 'idle' | 'loading' | 'ready' | 'error';
  generatedAt: number | null;
  refresh: () => void;
};

/**
 * The review for a scope. Renders the local summary at once; asks Claude when Supabase is configured,
 * caching the answer per range on device so reopening the screen does not spend another call.
 */
export function useSummary(scope: SummaryScope): SummaryState {
  const { t } = useTranslation();
  const request = useSummaryRequest(scope);
  const local = useMemo(() => localSummary(request, t), [request, t]);
  const key = cacheKey(request);
  const fp = fingerprint(request);
  // A refresh is tied to the request it was asked for; new data starts from the cache rules again.
  const [force, setForce] = useState<{ fp: string; n: number } | null>(null);
  const forced = force?.fp === fp ? force.n : 0;

  const cached = useMemo(() => readCached(key, fp), [key, fp]);

  const query = useQuery({
    queryKey: ['ai-summary', key, fp, forced],
    enabled: summaryRemoteEnabled && (forced > 0 || !cached),
    queryFn: async ({ signal }) => {
      const response = await summaryRemote(request, signal);
      if (!response) return null;
      const generatedAt = Date.now();
      writeJSON(key, { fingerprint: fp, generatedAt, response } satisfies Cached);
      return { response, generatedAt };
    },
  });

  const ai = query.data ?? (cached ? { response: cached.response, generatedAt: cached.generatedAt } : null);
  return {
    request,
    review: ai?.response ?? local,
    source: ai ? 'claude' : 'local',
    status: query.isFetching ? 'loading' : query.isError ? 'error' : ai ? 'ready' : 'idle',
    generatedAt: ai?.generatedAt ?? null,
    refresh: () => setForce({ fp, n: forced + 1 }),
  };
}
