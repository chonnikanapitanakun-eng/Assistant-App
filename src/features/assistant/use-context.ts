import { useMemo } from 'react';

import { eventToItem } from '@/features/calendar/model';
import { useEventsBetween } from '@/features/calendar/queries';
import { billState, monthTotals, nextDueDate, spendingByCategory } from '@/features/money/model';
import { useBills, useCategories, useTransactions } from '@/features/money/queries';
import { useProfile } from '@/features/profile/store';
import { useAllTasks } from '@/features/tasks/queries';
import { addDays, toDateKey, toMonthKey } from '@/lib/date';

import type { AssistantContext } from './types';

/** Live snapshot of what the assistant can see: tasks, the next 7 days of events, bills and this month's money. */
export function useAssistantContext(): () => AssistantContext {
  const name = useProfile((p) => p.name);
  const currency = useProfile((p) => p.currency);
  const language = useProfile((p) => p.language);
  const tasks = useAllTasks();
  const today = toDateKey();
  const events = useEventsBetween(today, toDateKey(addDays(new Date(), 8)));
  const bills = useBills();
  const txs = useTransactions();
  const categories = useCategories();

  return useMemo(() => {
    const month = toMonthKey();
    const totals = monthTotals(txs, month, currency);
    const spent = new Map(spendingByCategory(txs, month, currency).map((r) => [r.categoryId, r.total]));
    const catName = (c: (typeof categories)[number]) => (language === 'th' ? c.nameTh : c.nameEn);
    // A function so each message sees the current time.
    return () => ({
      now: new Date(),
      name,
      currency,
      tasks: tasks.map((x) => ({ id: x.id, title: x.title, date: x.date, startTime: x.startTime, endTime: x.endTime, isDone: x.isDone, priority: x.priority, durationMin: x.durationMin, energy: x.energy })),
      events: events.map(eventToItem).map((e) => ({ id: e.id, title: e.title, date: e.date, start: e.start, end: e.end, allDay: e.allDay, location: e.location })),
      bills: bills.map((b) => {
        const due = nextDueDate(b);
        return { id: b.id, name: b.name, amount: b.amount, currency: b.currency, due, state: billState(due, b.remindDaysBefore).state };
      }),
      money: {
        income: totals.income,
        expense: totals.expense,
        categories: categories.filter((c) => c.type === 'expense').map((c) => ({ name: catName(c), spent: spent.get(c.id) ?? 0, budget: c.budgetMonthly })),
      },
    });
  }, [name, currency, language, tasks, events, bills, txs, categories]);
}
