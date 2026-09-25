import type { SummaryBill, SummaryCheckin, SummaryEvent, SummaryMoney, SummaryRequest, SummaryResponse, SummaryScope, SummaryTask } from '@/features/ai/summary';
import { addDays, toDateKey } from '@/lib/date';

/** Translation function (i18next-compatible) so the model stays pure and testable. */
export type T = (key: string, opts?: Record<string, unknown>) => string;

// ── Range ──────────────────────────────────────────────────────────────

/** Day = today; week = Monday to Sunday of the week containing `today`. Both ends inclusive. */
export function summaryRange(scope: SummaryScope, today: Date = new Date()): { from: string; to: string } {
  if (scope === 'day') {
    const key = toDateKey(today);
    return { from: key, to: key };
  }
  const monday = addDays(today, -((today.getDay() + 6) % 7));
  return { from: toDateKey(monday), to: toDateKey(addDays(monday, 6)) };
}

// ── Request (retrieval before the call: only rows in range, reduced to what the summary needs) ──

type TaskRow = { title: string; date: string | null; startTime: string | null; isDone: boolean; doneAt: number | null; priority: number };
type EventItem = { title: string; date: string; start?: string; end?: string; allDay: boolean; location?: string | null };
type BillItem = { name: string; amount: number; currency: string; due: string; state: 'overdue' | 'today' | 'soon' | 'later'; days: number };
type TxRow = { amount: number; currency: string; type: 'income' | 'expense' | 'transfer'; date: string; categoryId: string | null };
type CategoryRow = { id: string; name: string; type: 'income' | 'expense'; budgetMonthly: number | null };
type CheckinRow = { date: string; mood: number | null; energy: number | null; reflection: string | null };

export type SummarySource = {
  scope: SummaryScope;
  locale: 'th' | 'en';
  name: string;
  currency: string;
  now: Date;
  tasks: TaskRow[];
  events: EventItem[];
  bills: BillItem[];
  transactions: TxRow[];
  categories: CategoryRow[];
  checkins: CheckinRow[];
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const inRange = (key: string, from: string, to: string) => key >= from && key <= to;
const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildSummaryRequest(src: SummarySource): SummaryRequest {
  const today = toDateKey(src.now);
  const { from, to } = summaryRange(src.scope, src.now);

  const tasks: SummaryTask[] = src.tasks
    .filter((t) => {
      if (t.isDone) return (t.date && inRange(t.date, from, to)) || (t.doneAt !== null && inRange(toDateKey(new Date(t.doneAt)), from, to));
      return !!t.date && t.date <= to; // open: in range or overdue
    })
    .map((t) => ({ title: t.title, date: t.date, startTime: t.startTime, isDone: t.isDone, priority: t.priority, overdue: !t.isDone && !!t.date && t.date < today }))
    .sort((a, b) => Number(a.isDone) - Number(b.isDone) || Number(b.overdue) - Number(a.overdue) || (a.date ?? '').localeCompare(b.date ?? '') || (a.startTime ?? '').localeCompare(b.startTime ?? ''))
    .slice(0, 60);

  const events: SummaryEvent[] = src.events.filter((e) => inRange(e.date, from, to)).slice(0, 40);

  // Bills that are already late, due in the range, or inside their reminder window.
  const bills: SummaryBill[] = src.bills
    .filter((b) => b.state !== 'later' || inRange(b.due, from, to))
    .map(({ name, amount, currency, due, state }) => ({ name, amount, currency, due, state }))
    .slice(0, 20);

  let income = 0;
  let expense = 0;
  const byCategory = new Map<string | null, number>();
  for (const tx of src.transactions) {
    if (tx.currency !== src.currency || !inRange(tx.date, from, to)) continue;
    if (tx.type === 'income') income += tx.amount;
    else if (tx.type === 'expense') {
      expense += tx.amount;
      byCategory.set(tx.categoryId, (byCategory.get(tx.categoryId) ?? 0) + tx.amount);
    }
  }
  const catName = new Map(src.categories.map((c) => [c.id, c.name]));
  const topCategories = [...byCategory.entries()]
    .map(([id, total]) => ({ name: (id && catName.get(id)) || '—', total: round2(total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
  // Budgets are monthly: compare month-to-date spend against them, whatever the scope.
  const month = today.slice(0, 7);
  const monthSpend = new Map<string, number>();
  for (const tx of src.transactions) if (tx.type === 'expense' && tx.currency === src.currency && tx.date.startsWith(month) && tx.categoryId) monthSpend.set(tx.categoryId, (monthSpend.get(tx.categoryId) ?? 0) + tx.amount);
  const overBudget = src.categories
    .filter((c) => c.type === 'expense' && c.budgetMonthly && (monthSpend.get(c.id) ?? 0) > c.budgetMonthly)
    .map((c) => ({ name: c.name, spent: round2(monthSpend.get(c.id) ?? 0), budget: c.budgetMonthly! }))
    .slice(0, 6);
  const money: SummaryMoney = { income: round2(income), expense: round2(expense), currency: src.currency, topCategories, overBudget };

  const checkins: SummaryCheckin[] = src.checkins.filter((c) => inRange(c.date, from, to)).slice(0, 7);

  return { scope: src.scope, locale: src.locale, name: src.name, today, weekday: WEEKDAYS[src.now.getDay()], from, to, currency: src.currency, tasks, events, bills, money, checkins };
}

// ── Local fallback (offline / no Supabase / Claude declined) ───────────

/** Rule-based review in the same shape as Claude's, built from the request only. */
export function localSummary(req: SummaryRequest, t: T): SummaryResponse {
  const open = req.tasks.filter((x) => !x.isDone);
  const done = req.tasks.filter((x) => x.isDone);
  const overdue = open.filter((x) => x.overdue);
  const high = open.filter((x) => !x.overdue && x.priority === 1);
  const dueBills = req.bills.filter((b) => b.state === 'overdue' || b.state === 'today');
  const first = [...req.events].filter((e) => !e.allDay && e.start).sort((a, b) => a.date.localeCompare(b.date) || a.start!.localeCompare(b.start!))[0];

  const sentences = [
    t(`review.local_${req.scope}_counts`, { events: req.events.length, count: open.length, done: done.length }),
    first ? t('review.local_first_event', { title: first.title, time: first.start }) : null,
    req.money.expense > 0 || req.money.income > 0 ? t('review.local_money', { expense: fmt(req.money.expense), income: fmt(req.money.income), currency: req.currency }) : null,
  ].filter((x): x is string => !!x);

  const highlights = [
    ...done.slice(0, 3).map((x) => t('review.local_done', { title: x.title })),
    ...(req.money.income > 0 ? [t('review.local_income', { amount: fmt(req.money.income), currency: req.currency })] : []),
    ...(req.events.length === 0 && req.scope === 'day' ? [t('review.local_free_day')] : []),
  ].slice(0, 5);

  const needsAttention = [
    ...overdue.slice(0, 3).map((x) => t('review.local_overdue', { title: x.title })),
    ...dueBills.slice(0, 2).map((b) => t('review.local_bill', { name: b.name, amount: fmt(b.amount), currency: b.currency })),
    ...high.slice(0, 2).map((x) => t('review.local_high', { title: x.title })),
    ...req.money.overBudget.slice(0, 1).map((c) => t('review.local_over_budget', { name: c.name })),
  ].slice(0, 5);

  const headline = overdue.length
    ? t('review.local_headline_overdue', { count: overdue.length })
    : dueBills.length
      ? t('review.local_headline_bill', { name: dueBills[0].name })
      : first
        ? t('review.local_headline_event', { title: first.title, time: first.start })
        : open.length
          ? t('review.local_headline_tasks', { count: open.length })
          : t('review.local_headline_clear');

  return { headline, summary: sentences.join(' '), highlights, needsAttention };
}

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
