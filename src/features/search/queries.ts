import { and, inArray, isNull } from 'drizzle-orm';
import { useEffect, useState } from 'react';

import { calendarEvents, categories, contacts, db, notes, tasks, transactions, useDbQuery, withSqlite } from '@/db';
import type { CalendarEvent, Category, Contact, Note, Task, Transaction } from '@/db';

import { bucketHits, likeFallbackQuery, orderByIds, planSearch, type SearchPlan, type SearchType } from './model';

/** Enough hits that every group still fills after soft-deleted rows are dropped. */
const HIT_LIMIT = 300;
const DEBOUNCE_MS = 150;

export type SearchGroups = {
  task: Task[];
  event: CalendarEvent[];
  note: Note[];
  transaction: { id: string; tx: Transaction; category?: Category }[];
  contact: Contact[];
};
export type SearchResults = { terms: string[]; groups: SearchGroups; total: number };

const empty = (): SearchGroups => ({ task: [], event: [], note: [], transaction: [], contact: [] });

/**
 * Ranked (type, id) hits from fts_index. expo-sqlite's web build has no FTS5 (see db/use-database.ts),
 * so when the index is missing this falls back to a plain LIKE scan of the same fields (unranked, newest first).
 */
async function findHits(plan: SearchPlan): Promise<{ type: string; id: string }[]> {
  const where: string[] = [];
  const params: string[] = [];
  if (plan.match) {
    where.push('fts_index MATCH ?');
    params.push(plan.match);
  }
  for (const like of plan.likes) {
    where.push(`(title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\')`);
    params.push(like, like, like);
  }
  const order = plan.match ? 'ORDER BY rank' : '';
  try {
    return await withSqlite((sqlite) => sqlite.getAllAsync<{ type: string; id: string }>(`SELECT type, id FROM fts_index WHERE ${where.join(' AND ')} ${order} LIMIT ${HIT_LIMIT}`, params));
  } catch (e) {
    if (!String(e).includes('no such table')) return [];
    const like = likeFallbackQuery(plan.terms, HIT_LIMIT);
    return withSqlite((sqlite) => sqlite.getAllAsync<{ type: string; id: string }>(like.sql, like.params)).catch(() => []);
  }
}

/** Search every indexed type and load the live (non-deleted) rows, grouped by type in rank order. */
export async function searchAll(query: string): Promise<SearchResults | null> {
  const plan = planSearch(query);
  if (!plan) return null;
  const ids = bucketHits(await findHits(plan));
  const groups = empty();

  if (ids.task.length) groups.task = orderByIds(await db.select().from(tasks).where(and(inArray(tasks.id, ids.task), isNull(tasks.deletedAt))).all(), ids.task);
  if (ids.note.length) groups.note = orderByIds(await db.select().from(notes).where(and(inArray(notes.id, ids.note), isNull(notes.deletedAt))).all(), ids.note);
  if (ids.contact.length) groups.contact = orderByIds(await db.select().from(contacts).where(and(inArray(contacts.id, ids.contact), isNull(contacts.deletedAt))).all(), ids.contact);
  if (ids.event.length) {
    groups.event = orderByIds(await db.select().from(calendarEvents).where(and(inArray(calendarEvents.id, ids.event), isNull(calendarEvents.deletedAt))).all(), ids.event);
  }
  if (ids.transaction.length) {
    const txs = orderByIds(await db.select().from(transactions).where(and(inArray(transactions.id, ids.transaction), isNull(transactions.deletedAt))).all(), ids.transaction);
    const catIds = [...new Set(txs.flatMap((tx) => tx.categoryId ?? []))];
    const cats = catIds.length ? new Map((await db.select().from(categories).where(inArray(categories.id, catIds)).all()).map((c) => [c.id, c])) : new Map<string, Category>();
    groups.transaction = txs.map((tx) => ({ id: tx.id, tx, category: tx.categoryId ? cats.get(tx.categoryId) : undefined }));
  }

  const total = (Object.keys(groups) as SearchType[]).reduce((n, k) => n + groups[k].length, 0);
  return { terms: plan.terms, groups, total };
}

/** Debounced search that re-runs after any DB write (e.g. an item edited from a result). */
export function useSearch(query: string): SearchResults | null {
  const [debounced, setDebounced] = useState(query);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);
  // Clearing is instant; typing waits for a pause.
  const effective = query.trim() ? debounced : '';

  // Keep the previous results on screen while the next query runs (no flash of "no results").
  const results = useDbQuery(['search', effective], () => searchAll(effective), { keepPrevious: true });
  return effective ? (results ?? null) : null;
}
