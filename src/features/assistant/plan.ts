// Pure (no network, no React Native) so the engine and its tests can use it; the Claude call lives in plan-remote.ts.
import { hhmm, toMinutes } from '@/features/calendar/model';
import { toDateKey } from '@/lib/date';

import { planLocally, type PlanRequest, type PlanResponse } from '../../../supabase/functions/_shared/plan-contract';
import type { AssistantContext, Card, ListRow, Proposal, Reply, T } from './types';

export const WORK_START = '09:00';
export const WORK_END = '18:00';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** What "plan my day" sends to the planner: today's fixed blocks + the open backlog (due today or overdue, or undated). */
export function buildPlanRequest(ctx: AssistantContext, locale: string, date = toDateKey(ctx.now)): PlanRequest {
  const isToday = date === toDateKey(ctx.now);
  const events = ctx.events.filter((e) => e.date === date && !e.allDay && e.start && e.end);
  const open = ctx.tasks.filter((x) => !x.isDone);
  const timed = open.filter((x) => x.date === date && x.startTime);
  const backlog = open
    .filter((x) => (x.date === date && !x.startTime) || (x.date && x.date < date) || (!x.date && x.priority === 1))
    .sort((a, b) => a.priority - b.priority);
  return {
    locale: locale === 'th' ? 'th' : 'en',
    date,
    weekday: WEEKDAYS[new Date(`${date}T12:00:00`).getDay()],
    now: isToday ? hhmm(ctx.now) : null,
    workStart: WORK_START,
    workEnd: WORK_END,
    busy: [
      ...events.map((e) => ({ kind: 'event' as const, title: e.title, start: e.start!, end: e.end! })),
      ...timed.map((x) => ({ kind: 'task' as const, title: x.title, start: x.startTime!, end: x.endTime ?? fromEnd(x.startTime!, x.durationMin) })),
    ],
    backlog: backlog.map((x) => ({
      id: x.id,
      title: x.title,
      priority: (x.priority === 1 || x.priority === 3 ? x.priority : 2) as 1 | 2 | 3,
      durationMin: x.durationMin ?? null,
      energy: x.energy ?? null,
      date: x.date,
      overdue: !!x.date && x.date < date,
    })),
    energyPattern: null,
  };
}

const fromEnd = (start: string, durationMin?: number | null) => {
  const m = Math.min(23 * 60 + 59, toMinutes(start) + (durationMin ?? 30));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** Turn a planner answer into the single proposal card the user approves. Null when nothing was placed. */
export function planToProposal(plan: PlanResponse, req: PlanRequest): Extract<Proposal, { kind: 'apply_plan' }> | null {
  const byId = new Map(req.backlog.map((t) => [t.id, t]));
  const slots = plan.schedule
    .map((s) => {
      const task = byId.get(s.taskId);
      return task ? { taskId: s.taskId, title: task.title, startTime: s.startTime, endTime: s.endTime, reason: s.reason, overdue: task.overdue, priority: task.priority } : null;
    })
    .filter((s): s is NonNullable<typeof s> => !!s);
  if (!slots.length) return null;
  const skipped = plan.skipped.map((s) => ({ taskId: s.taskId, title: byId.get(s.taskId)?.title ?? '', reason: s.reason })).filter((s) => s.title);
  return { kind: 'apply_plan', date: req.date, slots, skipped };
}

let counter = 0;
const pid = () => `p${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Today's fixed blocks as a list card (events + timed tasks, in time order). */
export function todayListCard(ctx: AssistantContext, req: PlanRequest, t: T): Card | null {
  const nowMin = req.now ? toMinutes(req.now) : -1;
  const events = ctx.events.filter((e) => e.date === req.date && !e.allDay && e.start && e.end);
  const timed = ctx.tasks.filter((x) => !x.isDone && x.date === req.date && x.startTime);
  const rows: ListRow[] = [
    ...events.map((e) => ({ id: e.id, kind: 'event' as const, title: e.title, meta: `${e.start}–${e.end}${e.location ? ` · ${e.location}` : ''}`, tone: toMinutes(e.end!) <= nowMin ? ('muted' as const) : undefined, sort: toMinutes(e.start!) })),
    ...timed.map((x) => ({ id: x.id, kind: 'task' as const, title: x.title, meta: x.startTime!, sort: toMinutes(x.startTime!) })),
  ]
    .sort((a, b) => a.sort - b.sort)
    .map(({ sort: _s, ...r }) => r);
  return rows.length ? { type: 'list', title: t('assistant.c.today'), rows } : null;
}

/** Assemble the chat reply: list of what's fixed, the plan card, and a sentence about the day. */
export function planReply(ctx: AssistantContext, req: PlanRequest, plan: PlanResponse, t: T, source: 'local' | 'claude'): Reply {
  const list = todayListCard(ctx, req, t);
  const proposal = planToProposal(plan, req);
  const cards: Card[] = [...(list ? [list] : []), ...(proposal ? [{ type: 'proposal' as const, id: pid(), proposal, state: 'pending' as const }] : [])];
  const fixed = req.busy.length;
  const open = req.backlog.length;
  let text = plan.summary.trim();
  if (!text) {
    const key = !fixed && !open ? 'assistant.r.plan_clear' : proposal ? 'assistant.r.plan_slots' : open ? 'assistant.r.plan_full' : 'assistant.r.plan_free';
    text = t(key, { name: ctx.name, events: fixed, tasks: open, count: proposal?.slots.length ?? 0 });
  }
  return { text, cards, suggestions: [t('assistant.s.overdue'), t('assistant.s.bills'), t('assistant.s.focus')], source };
}

/** "Plan my day" on-device: deterministic planner, no network. */
export function planDayLocally(ctx: AssistantContext, t: T, locale = 'en'): Reply {
  const req = buildPlanRequest(ctx, locale);
  return planReply(ctx, req, planLocally(req), t, 'local');
}
