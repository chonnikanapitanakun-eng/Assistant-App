/**
 * ai-ask retrieval — the DB half of the pipeline (see model.ts for the pure half).
 *
 * For one question this runs, in parallel:
 *   1. FTS (fts_index, trigram) once per keyword — OR semantics, scored by how many keywords hit
 *   2. date-range queries when the question names a window (tasks by date, events by start, transactions by date)
 *   3. focus queries when it names a kind of data (open tasks, upcoming events, this month's money, bills)
 *   4. a small "now" snapshot (overdue / today) when it names neither, so "what should I do?" still works
 *   5. records linked to the contacts it found (links table), so "งานของคุณสมชาย" crosses data types
 * then renders each row to one line, computes totals locally and trims everything to the prompt budget.
 */
import { and, asc, desc, eq, gte, inArray, isNull, lte, lt, or } from 'drizzle-orm';

import { calendarEvents, categories, contacts, db, notes, recurringBills, tasks, transactions, wallets } from '@/db';
import { fromDateKey } from '@/features/calendar/model';
import { getRelated } from '@/features/links/queries';
import { nextDueDate } from '@/features/money/model';
import { searchAll } from '@/features/search/queries';
import { addDays, toDateKey, toMonthKey } from '@/lib/date';

import type { AskRecord, AskRecordType } from '../types';
import {
  addCandidate,
  budgetFacts,
  moneyFacts,
  planRetrieval,
  rankRecords,
  refKey,
  renderBill,
  renderContact,
  renderEvent,
  renderNote,
  renderTask,
  renderTx,
  taskFacts,
  type Candidate,
  type RetrievalPlan,
  type Window,
} from './model';

export type AskSettings = { locale: 'th' | 'en'; currency: string; name: string; now: Date };

/** What the question resolved to: the records to send, and how to map the model's refs back to rows. */
export type Retrieval = {
  plan: RetrievalPlan;
  records: AskRecord[];
  facts: string[];
  coverage: string[];
  refs: Map<string, { type: AskRecordType; id: string; title: string }>;
};

const SNAPSHOT_DAYS = 7;
/** Rows a date-range query may return before the ranking budget trims them. */
const RANGE_LIMIT = 200;

type Rows = { tasks: typeof tasks.$inferSelect[]; events: typeof calendarEvents.$inferSelect[]; notes: typeof notes.$inferSelect[]; txs: typeof transactions.$inferSelect[]; contacts: typeof contacts.$inferSelect[]; bills: typeof recurringBills.$inferSelect[] };

const eventsBetween = (from: string, to: string) => {
  const a = fromDateKey(from).getTime();
  const b = addDays(fromDateKey(to), 1).getTime();
  return db.select().from(calendarEvents).where(and(isNull(calendarEvents.deletedAt), gte(calendarEvents.start, a), lt(calendarEvents.start, b))).orderBy(asc(calendarEvents.start)).limit(RANGE_LIMIT).all();
};
const tasksBetween = (from: string, to: string) =>
  db.select().from(tasks).where(and(isNull(tasks.deletedAt), gte(tasks.date, from), lte(tasks.date, to))).orderBy(asc(tasks.date), asc(tasks.startTime)).limit(RANGE_LIMIT).all();
const txsBetween = (from: string, to: string) =>
  db.select().from(transactions).where(and(isNull(transactions.deletedAt), gte(transactions.date, from), lte(transactions.date, to))).orderBy(desc(transactions.date)).limit(1000).all();
/** Open tasks that are overdue, due within `days`, or undated. */
const openTasks = (today: string, days: number) =>
  db
    .select()
    .from(tasks)
    .where(and(isNull(tasks.deletedAt), eq(tasks.isDone, false), or(isNull(tasks.date), lte(tasks.date, toDateKey(addDays(fromDateKey(today), days))))))
    .orderBy(asc(tasks.date), asc(tasks.startTime))
    .limit(RANGE_LIMIT)
    .all();
const allBills = () => db.select().from(recurringBills).where(isNull(recurringBills.deletedAt)).all();

/** Rows for the other ends of a contact's links, by type. Areas are skipped (not a record the model cites). */
async function linkedRows(contactId: string, lang: string): Promise<Partial<Rows>> {
  const related = await getRelated({ type: 'contact', id: contactId }, lang);
  const ids = (type: string) => related.filter((r) => r.ref.type === type).map((r) => r.ref.id).slice(0, 10);
  const [t, e, x, n] = await Promise.all([
    ids('task').length ? db.select().from(tasks).where(and(inArray(tasks.id, ids('task')), isNull(tasks.deletedAt))).all() : [],
    ids('event').length ? db.select().from(calendarEvents).where(and(inArray(calendarEvents.id, ids('event')), isNull(calendarEvents.deletedAt))).all() : [],
    ids('transaction').length ? db.select().from(transactions).where(and(inArray(transactions.id, ids('transaction')), isNull(transactions.deletedAt))).all() : [],
    ids('note').length ? db.select().from(notes).where(and(inArray(notes.id, ids('note')), isNull(notes.deletedAt))).all() : [],
  ]);
  return { tasks: t, events: e, txs: x, notes: n };
}

const windowLabel = (w: Window) => (w.from === w.to ? `${w.label} (${w.from})` : `${w.label} (${w.from} to ${w.to})`);

/** Run the retrieval plan for `question` against the local database. Never throws on a missing FTS index (web). */
export async function retrieve(question: string, settings: AskSettings): Promise<Retrieval> {
  const { now, locale, currency } = settings;
  const today = toDateKey(now);
  const plan = planRetrieval(question, now);
  const { terms, window, focus } = plan;
  const has = (f: RetrievalPlan['focus'][number]) => focus.includes(f);
  const candidates = new Map<string, Candidate>();
  const coverage: string[] = [];
  const facts: string[] = [];

  // 1. FTS per keyword. A row found by several keywords scores higher; earlier ranks score a little higher.
  const ftsResults = await Promise.all(terms.map((term) => searchAll(term).catch(() => null)));
  const found = { tasks: new Map<string, Rows['tasks'][number]>(), events: new Map<string, Rows['events'][number]>(), notes: new Map<string, Rows['notes'][number]>(), txs: new Map<string, Rows['txs'][number]>(), contacts: new Map<string, Rows['contacts'][number]>() };
  const ftsScore = new Map<string, number>();
  for (const res of ftsResults) {
    if (!res) continue;
    const bump = (type: AskRecordType, id: string, pos: number) => ftsScore.set(refKey(type, id), (ftsScore.get(refKey(type, id)) ?? 0) + 1 + 0.5 / (1 + pos));
    res.groups.task.forEach((r, i) => (found.tasks.set(r.id, r), bump('task', r.id, i)));
    res.groups.event.forEach((r, i) => (found.events.set(r.id, r), bump('event', r.id, i)));
    res.groups.note.forEach((r, i) => (found.notes.set(r.id, r), bump('note', r.id, i)));
    res.groups.transaction.forEach((r, i) => (found.txs.set(r.id, r.tx), bump('transaction', r.id, i)));
    res.groups.contact.forEach((r, i) => (found.contacts.set(r.id, r), bump('contact', r.id, i)));
  }
  if (terms.length) coverage.push(`Keyword search across tasks, events, notes, transactions and contacts for: ${terms.join(', ')}`);

  // 2–4. Structured queries: by window, by focus, or the "now" snapshot.
  const wantMoney = has('money') || has('bills');
  const moneyWindow: Window | null = window ?? (wantMoney ? { from: `${toMonthKey(now)}-01`, to: toDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0)), label: 'this month' } : null);
  const snapshot = !window && !focus.length;

  const [rangeTasks, rangeEvents, rangeTxs, openList, bills, cats, wals] = await Promise.all([
    window ? tasksBetween(window.from, window.to) : [],
    window ? eventsBetween(window.from, window.to) : has('events') || snapshot ? eventsBetween(today, toDateKey(addDays(now, SNAPSHOT_DAYS))) : [],
    moneyWindow ? txsBetween(moneyWindow.from, moneyWindow.to) : [],
    !window && (has('tasks') || snapshot) ? openTasks(today, has('tasks') ? 14 : 0) : [],
    wantMoney || has('bills') ? allBills() : [],
    db.select().from(categories).where(isNull(categories.deletedAt)).all(),
    db.select().from(wallets).where(isNull(wallets.deletedAt)).all(),
  ]);
  const catName = (id: string | null) => {
    const c = id ? cats.find((x) => x.id === id) : undefined;
    return c ? (locale === 'th' ? c.nameTh : c.nameEn) : locale === 'th' ? 'ไม่ระบุหมวด' : 'Uncategorised';
  };
  const walName = (id: string | null) => (id ? wals.find((w) => w.id === id)?.name : undefined);

  if (window) {
    coverage.push(`Tasks, events and transactions dated ${windowLabel(window)}`);
    facts.push(...taskFacts(rangeTasks, windowLabel(window), now));
  } else if (openList.length || has('tasks') || snapshot) {
    const label = has('tasks') ? `open (overdue, undated or due within 14 days of ${today})` : `overdue or due today (${today})`;
    coverage.push(`Open tasks ${label}`);
    facts.push(...taskFacts(openList, label, now));
  }
  if (!window && (has('events') || snapshot)) coverage.push(`Events from ${today} for the next ${SNAPSHOT_DAYS} days`);
  if (moneyWindow) {
    coverage.push(`Transactions ${windowLabel(moneyWindow)}`);
    facts.push(...moneyFacts(rangeTxs, windowLabel(moneyWindow), currency, catName));
    if (moneyWindow.from.slice(0, 7) === moneyWindow.to.slice(0, 7)) {
      const spent = new Map<string | null, number>();
      for (const t of rangeTxs) if (t.type === 'expense' && t.currency === currency) spent.set(t.categoryId, (spent.get(t.categoryId) ?? 0) + t.amount);
      facts.push(...budgetFacts(cats.filter((c) => c.type === 'expense').map((c) => ({ name: catName(c.id), spent: spent.get(c.id) ?? 0, budget: c.budgetMonthly })), currency, windowLabel(moneyWindow)));
    }
  }
  if (bills.length) coverage.push('All recurring bills and subscriptions');

  // 5. Records linked to the contacts the keywords found (top 3 contacts).
  const topContacts = [...found.contacts.values()].sort((a, b) => (ftsScore.get(refKey('contact', b.id)) ?? 0) - (ftsScore.get(refKey('contact', a.id)) ?? 0)).slice(0, 3);
  const linked = await Promise.all(topContacts.map((c) => linkedRows(c.id, locale).catch(() => ({}) as Partial<Rows>)));
  if (topContacts.length) coverage.push(`Records linked to ${topContacts.map((c) => c.name).join(', ')}`);

  // Render + score. FTS hits carry their keyword score; range/focus rows 0.6; linked rows 0.8; snapshot rows 0.4.
  const add = (type: AskRecordType, id: string, title: string, text: string, base: number, recency: number) =>
    addCandidate(candidates, { type, id, title, text, score: base + (ftsScore.get(refKey(type, id)) ?? 0), recency });
  const catNames = (t: Rows['txs'][number]) => ({ category: t.categoryId ? catName(t.categoryId) : undefined, wallet: walName(t.walletId), toWallet: walName(t.toWalletId) });

  const taskRows = new Map<string, { row: Rows['tasks'][number]; base: number }>();
  const eventRows = new Map<string, { row: Rows['events'][number]; base: number }>();
  const txRows = new Map<string, { row: Rows['txs'][number]; base: number }>();
  const noteRows = new Map<string, { row: Rows['notes'][number]; base: number }>();
  const put = <T extends { id: string }>(map: Map<string, { row: T; base: number }>, rows: T[] | undefined, base: number) => {
    for (const row of rows ?? []) if (!map.has(row.id) || map.get(row.id)!.base < base) map.set(row.id, { row, base });
  };
  put(taskRows, [...found.tasks.values()], 0);
  put(eventRows, [...found.events.values()], 0);
  put(txRows, [...found.txs.values()], 0);
  put(noteRows, [...found.notes.values()], 0);
  put(taskRows, rangeTasks, 0.6);
  put(taskRows, openList, snapshot ? 0.4 : 0.6);
  put(eventRows, rangeEvents, window || has('events') ? 0.6 : 0.4);
  put(txRows, rangeTxs, 0.6);
  for (const l of linked) {
    put(taskRows, l.tasks, 0.8);
    put(eventRows, l.events, 0.8);
    put(txRows, l.txs, 0.8);
    put(noteRows, l.notes, 0.8);
  }

  for (const { row, base } of taskRows.values()) add('task', row.id, row.title, renderTask({ ...row, checklist: row.checklist ?? null }, now), base, row.date ? fromDateKey(row.date).getTime() : row.updatedAt);
  for (const { row, base } of eventRows.values()) add('event', row.id, row.title, renderEvent(row), base, row.start);
  for (const { row, base } of txRows.values()) add('transaction', row.id, row.note ?? `${row.type} ${row.amount} ${row.currency}`, renderTx(row, catNames(row)), base, fromDateKey(row.date).getTime());
  for (const { row, base } of noteRows.values()) add('note', row.id, row.title || row.body.slice(0, 40), renderNote(row), base, row.updatedAt);
  for (const row of found.contacts.values()) add('contact', row.id, row.name, renderContact(row), 0, row.updatedAt);
  for (const b of bills) {
    const due = nextDueDate(b, now);
    add('bill', b.id, b.name, renderBill({ ...b, due }, now), 0.5, -fromDateKey(due).getTime());
  }

  const ranked = rankRecords(candidates.values());
  return {
    plan,
    records: ranked.map((r) => ({ ref: r.ref, type: r.type, text: r.text })),
    facts,
    coverage,
    refs: new Map(ranked.map((r) => [r.ref, { type: r.type, id: r.id, title: r.title }])),
  };
}
