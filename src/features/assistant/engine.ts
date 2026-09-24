import { parseCaptureLocally } from '@/features/ai/capture';
import { fromMinutes, toMinutes } from '@/features/calendar/model';
import { formatMoney } from '@/lib/currency';
import { addDays, toDateKey } from '@/lib/date';

import type { AssistantContext, Card, ListRow, Proposal, Reply, T } from './types';

/**
 * On-device assistant. Recognises a handful of intents in English and Thai and
 * answers from the user's own data. Anything that changes data is returned as a
 * proposal card for the user to confirm.
 */
export type Intent = 'greeting' | 'help' | 'plan_day' | 'overdue' | 'expenses' | 'bills' | 'summarise_tasks' | 'emails' | 'complete' | 'capture' | 'unknown';

const patterns: [Intent, RegExp][] = [
  ['plan_day', /\b(plan (my )?(day|today)|what('s| is) (on )?(my day|today)|my day|schedule today|agenda)\b|วางแผน(วันนี้)?|วันนี้มีอะไร|ตารางวันนี้/i],
  ['overdue', /\b(overdue|late tasks?|behind|missed)\b|เลยกำหนด|ค้าง/i],
  ['expenses', /\b(expenses?|spending|spent|budget|money this month|review my expenses)\b|ค่าใช้จ่าย|ใช้เงิน|ใช้จ่าย|งบ/i],
  ['bills', /\b(bills?|due|payments?|pay)\b|บิล|ค่าน้ำ|ค่าไฟ|ครบกำหนด/i],
  ['summarise_tasks', /\b(summar(y|ise|ize)( my)? tasks?|my tasks|task summary|what('s| is) left)\b|สรุปงาน|งานของฉัน|งานเหลือ/i],
  ['emails', /\b(e-?mails?|inbox|gmail)\b|อีเมล/i],
  ['help', /\b(help|what can you do|how do(es)? (this|you) work)\b|ช่วยอะไรได้|ทำอะไรได้/i],
  ['greeting', /^(hi|hello|hey|good (morning|afternoon|evening)|yo)\b|^สวัสดี|^หวัดดี/i],
];

const completeRe = [/^(?:mark|tick|set)\s+(.+?)\s+(?:as\s+)?(?:done|complete(?:d)?|finished)$/i, /^(?:done|finished|completed?)[:\s]+(.+)$/i, /^(.+?)\s+(?:is\s+)?(?:done|finished)$/i, /^(.+?)\s*เสร็จแล้ว$/, /^ทำ(.+?)เสร็จแล้ว$/];

export function detectIntent(text: string, ctx?: AssistantContext): { intent: Intent; target?: string } {
  const s = text.trim();
  for (const re of completeRe) {
    const m = s.match(re);
    if (m) return { intent: 'complete', target: m[1].trim() };
  }
  for (const [intent, re] of patterns) if (re.test(s)) return { intent };
  const captured = parseCaptureLocally(s, ctx?.now).filter((i) => i.type !== 'note');
  if (captured.length) return { intent: 'capture' };
  return { intent: 'unknown' };
}

let counter = 0;
const pid = () => `p${Date.now().toString(36)}${(counter++).toString(36)}`;
const proposal = (p: Proposal): Card => ({ type: 'proposal', id: pid(), proposal: p, state: 'pending' });

export function respond(text: string, ctx: AssistantContext, t: T): Reply {
  const { intent, target } = detectIntent(text, ctx);
  const reply = (r: Omit<Reply, 'source'>): Reply => ({ ...r, source: 'local' });
  switch (intent) {
    case 'plan_day':
      return reply(planDay(ctx, t));
    case 'overdue':
      return reply(overdue(ctx, t));
    case 'expenses':
      return reply(expenses(ctx, t));
    case 'bills':
      return reply(bills(ctx, t));
    case 'summarise_tasks':
      return reply(summariseTasks(ctx, t));
    case 'complete':
      return reply(complete(target ?? '', ctx, t));
    case 'emails':
      return reply({ text: t('assistant.r.emails'), cards: [], suggestions: [t('assistant.s.plan'), t('assistant.s.tasks')] });
    case 'capture': {
      const items = parseCaptureLocally(text, ctx.now);
      return reply({ text: t('assistant.r.capture', { count: items.length }), cards: [proposal({ kind: 'create', items })], suggestions: [t('assistant.s.plan')] });
    }
    case 'greeting':
    case 'help':
      return reply({
        text: intent === 'greeting' ? t(ctx.name ? 'assistant.r.greeting' : 'assistant.r.greeting_anon', { name: ctx.name }) : t('assistant.r.help'),
        cards: [],
        suggestions: defaultSuggestions(t),
      });
    default:
      return reply({
        text: t('assistant.r.unknown'),
        cards: text.trim().length > 3 ? [proposal({ kind: 'create', items: [{ type: 'note', body: text.trim() }] })] : [],
        suggestions: defaultSuggestions(t),
      });
  }
}

export const defaultSuggestions = (t: T) => [t('assistant.s.plan'), t('assistant.s.overdue'), t('assistant.s.expenses'), t('assistant.s.bills'), t('assistant.s.tasks')];

// ── Intents ────────────────────────────────────────────────────────────

const WORK_START = 9 * 60;
const WORK_END = 18 * 60;

/** Free gaps (minutes) between busy intervals inside the working window, starting no earlier than `from`. */
export function freeSlots(busy: { start: number; end: number }[], from: number, minLength = 45): { start: number; end: number }[] {
  const sorted = [...busy].sort((a, b) => a.start - b.start);
  const out: { start: number; end: number }[] = [];
  let cursor = Math.max(WORK_START, Math.ceil(from / 30) * 30);
  for (const b of sorted) {
    if (b.end <= cursor) continue;
    if (b.start - cursor >= minLength && cursor < WORK_END) out.push({ start: cursor, end: Math.min(b.start, WORK_END) });
    cursor = Math.max(cursor, b.end);
  }
  if (WORK_END - cursor >= minLength) out.push({ start: cursor, end: WORK_END });
  return out.filter((s) => s.end - s.start >= minLength);
}

function planDay(ctx: AssistantContext, t: T): Omit<Reply, 'source'> {
  const today = toDateKey(ctx.now);
  const nowMin = ctx.now.getHours() * 60 + ctx.now.getMinutes();
  const events = ctx.events.filter((e) => e.date === today && !e.allDay && e.start && e.end);
  const openToday = ctx.tasks.filter((x) => !x.isDone && x.date && x.date <= today);
  const timedTasks = openToday.filter((x) => x.date === today && x.startTime);
  const untimed = openToday.filter((x) => !x.startTime || x.date! < today).sort((a, b) => a.priority - b.priority);

  const busy = [
    ...events.map((e) => ({ start: toMinutes(e.start!), end: toMinutes(e.end!) })),
    ...timedTasks.map((x) => ({ start: toMinutes(x.startTime!), end: x.endTime ? toMinutes(x.endTime) : toMinutes(x.startTime!) + 30 })),
  ];
  const slots = freeSlots(busy, nowMin);

  const rows: ListRow[] = [
    ...events.map((e) => ({ id: e.id, kind: 'event' as const, title: e.title, meta: `${e.start}–${e.end}${e.location ? ` · ${e.location}` : ''}`, tone: toMinutes(e.end!) <= nowMin ? ('muted' as const) : undefined, sort: toMinutes(e.start!) })),
    ...timedTasks.map((x) => ({ id: x.id, kind: 'task' as const, title: x.title, meta: x.startTime!, sort: toMinutes(x.startTime!) })),
  ]
    .sort((a, b) => a.sort - b.sort)
    .map(({ sort: _s, ...r }) => r);

  // Offer to slot the most important unscheduled tasks into the first free gaps.
  const cards: Card[] = rows.length ? [{ type: 'list', title: t('assistant.c.today'), rows }] : [];
  const placed: string[] = [];
  untimed.slice(0, 2).forEach((task, i) => {
    const slot = slots[i];
    if (!slot) return;
    const len = Math.min(60, slot.end - slot.start);
    cards.push(proposal({ kind: 'reschedule_task', taskId: task.id, title: task.title, date: today, startTime: fromMinutes(slot.start), endTime: fromMinutes(slot.start + len) }));
    placed.push(task.title);
  });

  const key = !events.length && !openToday.length ? 'assistant.r.plan_clear' : placed.length ? 'assistant.r.plan_slots' : slots.length ? 'assistant.r.plan_free' : 'assistant.r.plan_full';
  return {
    text: t(key, { name: ctx.name, events: events.length, tasks: openToday.length, count: placed.length, free: slots.length }),
    cards,
    suggestions: [t('assistant.s.overdue'), t('assistant.s.bills'), t('assistant.s.focus')],
  };
}

function overdue(ctx: AssistantContext, t: T): Omit<Reply, 'source'> {
  const today = toDateKey(ctx.now);
  const late = ctx.tasks.filter((x) => !x.isDone && x.date && x.date < today).sort((a, b) => a.priority - b.priority || a.date!.localeCompare(b.date!));
  if (!late.length) return { text: t('assistant.r.overdue_none'), cards: [], suggestions: [t('assistant.s.plan'), t('assistant.s.tasks')] };
  return {
    text: t('assistant.r.overdue', { count: late.length }),
    cards: late.slice(0, 5).map((x) => proposal({ kind: 'reschedule_task', taskId: x.id, title: x.title, date: today })),
    suggestions: [t('assistant.s.plan'), t('assistant.s.tasks')],
  };
}

function expenses(ctx: AssistantContext, t: T): Omit<Reply, 'source'> {
  const fmt = (n: number) => formatMoney(n, ctx.currency, 'en-GB');
  const { income, expense, categories } = ctx.money;
  const top = [...categories].filter((c) => c.spent > 0).sort((a, b) => b.spent - a.spent);
  const over = top.filter((c) => c.budget && c.spent > c.budget);
  const near = top.filter((c) => c.budget && c.spent <= c.budget && c.spent >= c.budget * 0.85);
  if (!expense && !income) return { text: t('assistant.r.expenses_none'), cards: [], suggestions: [t('assistant.s.bills')] };
  const cards: Card[] = [
    {
      type: 'stats',
      rows: [
        { label: t('money.expense'), value: fmt(expense) },
        { label: t('money.income'), value: fmt(income) },
        { label: t('assistant.c.net'), value: fmt(income - expense), tone: income - expense >= 0 ? 'good' : 'danger' },
      ],
    },
    {
      type: 'stats',
      rows: top.slice(0, 4).map((c) => ({
        label: c.name,
        value: fmt(c.spent),
        hint: c.budget ? t('assistant.c.of_budget', { budget: fmt(c.budget) }) : undefined,
        tone: c.budget && c.spent > c.budget ? 'danger' : c.budget && c.spent >= c.budget * 0.85 ? 'warning' : undefined,
      })),
    },
  ];
  const key = over.length ? 'assistant.r.expenses_over' : near.length ? 'assistant.r.expenses_near' : 'assistant.r.expenses_ok';
  return { text: t(key, { spent: fmt(expense), top: top[0]?.name ?? '', over: over.map((c) => c.name).join(', '), near: near.map((c) => c.name).join(', ') }), cards, suggestions: [t('assistant.s.bills'), t('assistant.s.plan')] };
}

function bills(ctx: AssistantContext, t: T): Omit<Reply, 'source'> {
  const due = ctx.bills.filter((b) => b.state !== 'later').sort((a, b) => a.due.localeCompare(b.due));
  const next = ctx.bills.filter((b) => b.state === 'later').sort((a, b) => a.due.localeCompare(b.due)).slice(0, 2);
  if (!due.length && !next.length) return { text: t('assistant.r.bills_none'), cards: [], suggestions: [t('assistant.s.expenses')] };
  const payable = due.filter((b) => b.state === 'overdue' || b.state === 'today');
  const rows: ListRow[] = [...due, ...next].map((b) => ({
    id: b.id,
    kind: 'bill',
    title: b.name,
    meta: `${formatMoney(b.amount, b.currency, 'en-GB')} · ${t(`assistant.bill_${b.state}`, { date: b.due })}`,
    tone: b.state === 'overdue' ? 'danger' : b.state === 'today' ? 'warning' : undefined,
  }));
  return {
    text: payable.length ? t('assistant.r.bills_due', { count: payable.length }) : t('assistant.r.bills_upcoming', { count: rows.length }),
    cards: [{ type: 'list', rows }, ...payable.map((b) => proposal({ kind: 'pay_bill', billId: b.id, name: b.name, amount: b.amount, currency: b.currency }))],
    suggestions: [t('assistant.s.expenses'), t('assistant.s.plan')],
  };
}

function summariseTasks(ctx: AssistantContext, t: T): Omit<Reply, 'source'> {
  const today = toDateKey(ctx.now);
  const weekEnd = toDateKey(addDays(ctx.now, 7));
  const open = ctx.tasks.filter((x) => !x.isDone);
  const late = open.filter((x) => x.date && x.date < today).length;
  const todays = open.filter((x) => x.date === today).length;
  const week = open.filter((x) => x.date && x.date > today && x.date <= weekEnd).length;
  const doneToday = ctx.tasks.filter((x) => x.isDone && x.date === today).length;
  const top = open.filter((x) => x.date && x.date <= today).sort((a, b) => a.priority - b.priority).slice(0, 3);
  if (!open.length) return { text: t('assistant.r.tasks_none'), cards: [], suggestions: [t('assistant.s.plan')] };
  return {
    text: t('assistant.r.tasks', { today: todays, late, week, done: doneToday }),
    cards: top.length ? [{ type: 'list', title: t('assistant.c.priorities'), rows: top.map((x) => ({ id: x.id, kind: 'task', title: x.title, meta: x.date! < today ? t('assistant.c.overdue') : t('capture.today'), tone: x.date! < today ? 'danger' : undefined })) }] : [],
    suggestions: [t('assistant.s.plan'), late ? t('assistant.s.overdue') : t('assistant.s.focus')],
  };
}

/** Word-overlap score between a query and a task title (case-insensitive). */
export function matchScore(query: string, title: string): number {
  const q = query.toLowerCase().trim();
  const tl = title.toLowerCase();
  if (!q) return 0;
  if (tl === q) return 100;
  if (tl.includes(q)) return 50 + q.length;
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  return words.filter((w) => tl.includes(w)).length * 10;
}

function complete(target: string, ctx: AssistantContext, t: T): Omit<Reply, 'source'> {
  const ranked = ctx.tasks
    .filter((x) => !x.isDone)
    .map((x) => ({ x, score: matchScore(target, x.title) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!ranked.length) return { text: t('assistant.r.complete_none', { target }), cards: [], suggestions: [t('assistant.s.tasks')] };
  const best = ranked[0].score >= 50 ? ranked.slice(0, 1) : ranked.slice(0, 2);
  return {
    text: best.length === 1 ? t('assistant.r.complete_one', { title: best[0].x.title }) : t('assistant.r.complete_many'),
    cards: best.map((r) => proposal({ kind: 'complete_task', taskId: r.x.id, title: r.x.title })),
    suggestions: [t('assistant.s.tasks')],
  };
}
