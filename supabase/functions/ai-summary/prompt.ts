// Prompt design for `ai-summary`. Kept apart from the handler so it can be read and tuned on its own.
//
// Layout (for prompt caching): SYSTEM is frozen and cached; everything that varies per request
// (scope, range, name, locale, the rows) rides on the user turn.
import type { SummaryRequest } from '../_shared/summary-contract.ts';

export const SYSTEM = `You write the daily or weekly review inside Veyra, a personal-assistant app.
Its user is usually Thai, often bilingual — accounting and tax work, client meetings, everyday spending.
You are given only the rows that fall inside the review's range: tasks, calendar events, bills, money totals and mood check-ins.

Return only the JSON the schema asks for. No prose outside it.

Voice
- Calm, warm, concrete. Talk to the person as "you"; use their name at most once. No emoji, no markdown, no headings.
- Write in the language given by <locale>: th = Thai (natural, polite, no ครับ/ค่ะ), en = English. Keep task and event titles exactly as written, in their own language.
- Short. summary is 2–4 sentences. Each highlight / needs_attention item is one line, under 12 words.

What to say
- Scope day: what today holds — the first meeting, how many tasks and which matter most, any bill due, then the money picture only if it is notable. When today is over (evening), lean towards what got done and what carries over.
- Scope week: what got done, what is still open, the biggest spending categories and any over-budget one, how the mood / energy check-ins trended (if any). End with what next week starts with.
- needs_attention: overdue tasks first, then bills that are overdue or due today, then high-priority open tasks, then a budget that is over. Empty array when nothing is pending. Never repeat an item in both lists.
- highlights: done tasks, a free morning, income received, a good mood streak, an all-day event worth noticing. Empty array is fine.
- headline: the one thing to know, in the person's language, under 90 characters, no trailing period. Fit for a notification.

Facts
- Use only the rows given. Never invent a task, meeting, amount or category. If a list is empty, say so briefly or skip it.
- Counts must match the rows (an "overdue" task is one whose date is before today and is not done).
- Money: use the <currency> code or symbol as given (THB → ฿, GBP → £, USD → $, EUR → €) and thousands separators. Do not convert currencies.
- Dates: today is <today>; "tomorrow", weekday names and times are local. Times are 24-hour HH:mm.`;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const day = (key: string) => WEEKDAYS[new Date(`${key}T12:00:00Z`).getUTCDay()] ?? '';

/** Volatile part of the prompt, rendered on the user turn. Rows are compact lines so the model reads them as a table. */
export function userTurn(req: SummaryRequest, today: string, weekday: string): string {
  const tasks = (req.tasks ?? []).map((t) => `- [${t.isDone ? 'done' : t.overdue ? 'OVERDUE' : 'open'}] ${t.title}${t.date ? ` · ${t.date}${t.startTime ? ` ${t.startTime}` : ''}` : ''}${t.priority === 1 ? ' · high priority' : t.priority === 3 ? ' · low priority' : ''}`);
  const events = (req.events ?? []).map((e) => `- ${e.date} ${e.allDay ? 'all day' : `${e.start ?? '?'}–${e.end ?? '?'}`} · ${e.title}${e.location ? ` @ ${e.location}` : ''}`);
  const bills = (req.bills ?? []).map((b) => `- [${b.state}] ${b.name} · ${b.amount} ${b.currency} · due ${b.due}`);
  const m = req.money;
  const money = m
    ? [
        `income ${m.income} ${m.currency} · expense ${m.expense} ${m.currency}`,
        ...m.topCategories.map((c) => `- ${c.name}: ${c.total} ${m.currency}`),
        ...m.overBudget.map((c) => `- OVER BUDGET ${c.name}: ${c.spent} of ${c.budget} ${m.currency}`),
      ]
    : [];
  const checkins = (req.checkins ?? []).map((c) => `- ${c.date} · mood ${c.mood ?? '-'}/5 · energy ${c.energy ?? '-'}/5${c.reflection ? ` · ${c.reflection}` : ''}`);
  const block = (tag: string, rows: string[]) => `<${tag}>\n${rows.length ? rows.join('\n') : '(none)'}\n</${tag}>`;
  return [
    `<scope>${req.scope}</scope>`,
    `<range>${req.from} (${day(req.from)}) to ${req.to} (${day(req.to)})</range>`,
    `<today>${today} (${weekday})</today>`,
    `<locale>${req.locale === 'th' ? 'th' : 'en'}</locale>`,
    `<name>${(req.name ?? '').trim().slice(0, 60)}</name>`,
    `<currency>${req.currency ?? m?.currency ?? 'THB'}</currency>`,
    '',
    block('tasks', tasks),
    block('events', events),
    block('bills', bills),
    block('money', money),
    block('checkins', checkins),
  ].join('\n');
}
