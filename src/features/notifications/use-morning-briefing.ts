import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { eventToItem } from '@/features/calendar/model';
import { useEventsBetween } from '@/features/calendar/queries';
import { billState, nextDueDate } from '@/features/money/model';
import { useBills } from '@/features/money/queries';
import { useProfile } from '@/features/profile/store';
import { useAllTasks } from '@/features/tasks/queries';
import { background } from '@/lib/background';
import { addDays, toDateKey } from '@/lib/date';

import { BRIEFING_DAYS, briefingBody, briefingTimes, syncMorningBriefing, type BriefingCounts, type BriefingPlan } from './briefing';

/**
 * Keeps the next 7 morning briefings scheduled from live data (events, open tasks, bills due) —
 * one local notification per morning, rebuilt whenever the rows or the setting change.
 * Mount once, inside the app (after onboarding).
 */
export function useMorningBriefing() {
  const { t } = useTranslation();
  const briefing = useProfile((p) => p.briefing);
  const name = useProfile((p) => p.name);
  const tasks = useAllTasks();
  const today = toDateKey();
  const events = useEventsBetween(today, toDateKey(addDays(new Date(), BRIEFING_DAYS + 1)));
  const bills = useBills();

  const plans = useMemo<BriefingPlan[]>(() => {
    if (!briefing.enabled) return [];
    const items = events.map(eventToItem);
    return briefingTimes(briefing.hour, briefing.minute).map(({ date, at }) => {
      const day = new Date(at);
      const dayEvents = items.filter((e) => e.date === date);
      const first = dayEvents.filter((e) => !e.allDay && e.start).sort((a, b) => a.start!.localeCompare(b.start!))[0];
      const open = tasks.filter((x) => !x.isDone && x.date);
      const counts: BriefingCounts = {
        events: dayEvents.length,
        tasks: open.filter((x) => x.date === date).length,
        overdue: open.filter((x) => x.date! < date).length,
        bills: bills.filter((b) => ['overdue', 'today'].includes(billState(nextDueDate(b, day), b.remindDaysBefore, day).state)).length,
        firstEvent: first ? { title: first.title, start: first.start! } : undefined,
      };
      return { date, at, title: name ? t('review.briefing_title_name', { name }) : t('review.briefing_title'), body: briefingBody(t, counts) };
    });
  }, [briefing, name, tasks, events, bills, t]);

  useEffect(() => {
    background(syncMorningBriefing(plans), 'Morning briefing');
  }, [plans]);
}
