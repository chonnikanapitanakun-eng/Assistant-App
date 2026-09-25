import { and, desc, eq, inArray, isNull, or, sql, type AnyColumn } from 'drizzle-orm';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { areas, calendarEvents, contacts, db, links, notes, tasks, transactions, useDbQuery, type LinkableType } from '@/db';
import { newId, now } from '@/lib/ids';

import { defaultRelation, describe, likeContains, otherEnd, refKey, sameRef, sortRelated, type Candidate, type LinkRef, type LinkableRow, type RelatedItem } from './model';

const tableFor = {
  task: tasks,
  event: calendarEvents,
  transaction: transactions,
  note: notes,
  contact: contacts,
  area: areas,
} as const;

/** Every live link touching `self`, in either direction. */
function linksTouching(self: LinkRef) {
  return db
    .select()
    .from(links)
    .where(and(isNull(links.deletedAt), or(and(eq(links.fromType, self.type), eq(links.fromId, self.id)), and(eq(links.toType, self.type), eq(links.toId, self.id)))))
    .orderBy(desc(links.createdAt));
}

/** Resolve refs to labels in one query per type. Deleted targets are left out. */
export async function resolveRefs(refs: LinkRef[], lang: string): Promise<Map<string, { title: string; subtitle: string | null }>> {
  const out = new Map<string, { title: string; subtitle: string | null }>();
  const byType = new Map<LinkableType, string[]>();
  for (const r of refs) byType.set(r.type, [...(byType.get(r.type) ?? []), r.id]);
  for (const [type, ids] of byType) {
    const table = tableFor[type];
    const rows = await db.select().from(table).where(and(inArray(table.id, ids), isNull(table.deletedAt))).all();
    for (const row of rows) out.set(refKey({ type, id: row.id }), describe({ type, row } as LinkableRow, lang));
  }
  return out;
}

type LinkRow = typeof links.$inferSelect;

const NONE: RelatedItem[] = [];

async function toRelated(rows: LinkRow[], self: LinkRef, lang: string): Promise<RelatedItem[]> {
  const ends = rows.flatMap((link) => {
    const end = otherEnd(link, self);
    return end ? [{ link, ...end }] : [];
  });
  const labels = await resolveRefs(ends.map((e) => e.ref), lang);
  const items: RelatedItem[] = [];
  const seen = new Set<string>();
  for (const e of ends) {
    const label = labels.get(refKey(e.ref));
    const key = refKey(e.ref);
    if (!label || seen.has(key)) continue; // target deleted, or linked twice
    seen.add(key);
    items.push({ linkId: e.link.id, ref: e.ref, direction: e.direction, relation: e.link.relation, ...label });
  }
  return sortRelated(items);
}

/** Live links going out of any of `from`, optionally only one relation / target type. One-off read. */
export async function outgoingRefs(from: LinkRef[], opts: { relation?: string; toType?: LinkableType } = {}): Promise<LinkRef[]> {
  const byType = new Map<LinkableType, string[]>();
  for (const r of from) byType.set(r.type, [...(byType.get(r.type) ?? []), r.id]);
  const out: LinkRef[] = [];
  for (const [type, ids] of byType) {
    const rows = await db
      .select({ toType: links.toType, toId: links.toId })
      .from(links)
      .where(
        and(
          isNull(links.deletedAt),
          eq(links.fromType, type),
          inArray(links.fromId, ids),
          opts.relation ? eq(links.relation, opts.relation) : undefined,
          opts.toType ? eq(links.toType, opts.toType) : undefined,
        ),
      )
      .all();
    out.push(...rows.map((r) => ({ type: r.toType, id: r.toId })));
  }
  return out;
}

/** One-off read (for actions and AI context outside React). */
export async function getRelated(self: LinkRef, lang = 'th'): Promise<RelatedItem[]> {
  return toRelated(await linksTouching(self).all(), self, lang);
}

/**
 * Live "Related" list for a record. Re-runs after any DB write (links or the linked records),
 * resolving labels on each run (see docs/LINKS.md). Pass `null` for unsaved records — returns [].
 */
export function useRelated(self: LinkRef | null): RelatedItem[] {
  const { i18n } = useTranslation();
  // Depend on the primitive parts so callers can pass an inline `{ type, id }` without re-resolving every render.
  const type = self?.type ?? 'task';
  const id = self?.id ?? '';
  const lang = i18n.language;
  const data = useDbQuery(['related', type, id, lang], async () => (id ? toRelated(await linksTouching({ type, id }).all(), { type, id }, lang) : []));
  return data ?? NONE;
}

/** `col LIKE pat` with `\` as the escape character (pair with `likeContains`, so `%` and `_` match literally). */
const like = (col: AnyColumn, pat: string) => sql`${col} like ${pat} escape '\\'`;

/** Records of `type` matching `q` (substring on the name field), newest first. */
function candidatesQuery(type: LinkableType, q: string, limit: number) {
  const pat = q ? likeContains(q) : null;
  switch (type) {
    case 'task':
      return db.select().from(tasks).where(and(isNull(tasks.deletedAt), pat ? like(tasks.title, pat) : undefined)).orderBy(desc(tasks.updatedAt)).limit(limit);
    case 'event':
      return db.select().from(calendarEvents).where(and(isNull(calendarEvents.deletedAt), pat ? like(calendarEvents.title, pat) : undefined)).orderBy(desc(calendarEvents.start)).limit(limit);
    case 'transaction':
      return db.select().from(transactions).where(and(isNull(transactions.deletedAt), pat ? like(transactions.note, pat) : undefined)).orderBy(desc(transactions.date)).limit(limit);
    case 'note':
      return db.select().from(notes).where(and(isNull(notes.deletedAt), pat ? or(like(notes.title, pat), like(notes.body, pat)) : undefined)).orderBy(desc(notes.updatedAt)).limit(limit);
    case 'contact':
      return db.select().from(contacts).where(and(isNull(contacts.deletedAt), pat ? or(like(contacts.name, pat), like(contacts.company, pat)) : undefined)).orderBy(desc(contacts.updatedAt)).limit(limit);
    case 'area':
      return db.select().from(areas).where(and(isNull(areas.deletedAt), pat ? or(like(areas.nameTh, pat), like(areas.nameEn, pat)) : undefined)).orderBy(areas.sortOrder).limit(limit);
  }
}

/** Live picker results for the "Link…" flow. Excludes `self`. */
export function useLinkCandidates(type: LinkableType, q: string, self: LinkRef, limit = 12): Candidate[] {
  const { i18n } = useTranslation();
  const term = q.trim();
  // Keep the previous results on screen while the next keystroke's query runs; they carry their
  // own type so rows are never described as the newly selected type.
  const data = useDbQuery(
    ['link-candidates', type, term, limit],
    async () => ({ type, rows: (await candidatesQuery(type, term, limit).all()) as LinkableRow['row'][] }),
    { keepPrevious: true },
  );
  const lang = i18n.language;
  const selfType = self.type;
  const selfId = self.id;
  return useMemo(() => {
    if (!data) return [];
    const rowType = data.type;
    return data.rows
      .map((row) => ({ ref: { type: rowType, id: row.id }, ...describe({ type: rowType, row } as LinkableRow, lang) }))
      .filter((c) => !sameRef(c.ref, { type: selfType, id: selfId }));
  }, [data, selfType, selfId, lang]);
}

/** Live link between two records in either direction (any relation). */
function findLink(a: LinkRef, b: LinkRef) {
  return db
    .select({ id: links.id })
    .from(links)
    .where(
      and(
        isNull(links.deletedAt),
        or(
          and(eq(links.fromType, a.type), eq(links.fromId, a.id), eq(links.toType, b.type), eq(links.toId, b.id)),
          and(eq(links.fromType, b.type), eq(links.fromId, b.id), eq(links.toType, a.type), eq(links.toId, a.id)),
        ),
      ),
    )
    .get();
}

/** SQL condition on an unqualified `links` row: it joins `a` and `b`, in either direction. */
const samePair = (a: LinkRef, b: LinkRef) =>
  sql`((from_type = ${a.type} and from_id = ${a.id} and to_type = ${b.type} and to_id = ${b.id}) or (from_type = ${b.type} and from_id = ${b.id} and to_type = ${a.type} and to_id = ${a.id}))`;

/**
 * Link two records. Idempotent: an existing live link (either direction) is reused. Returns the link id.
 * The existence check and the insert are one statement, so two quick taps can't create two live links.
 */
export async function addLink(from: LinkRef, to: LinkRef, relation: string = defaultRelation(to.type)): Promise<string> {
  if (sameRef(from, to)) throw new Error('Cannot link a record to itself');
  const id = newId();
  const t = now();
  await db.run(sql`
    insert into links (id, from_type, from_id, to_type, to_id, relation, created_at, updated_at)
    select ${id}, ${from.type}, ${from.id}, ${to.type}, ${to.id}, ${relation}, ${t}, ${t}
    where not exists (select 1 from links where deleted_at is null and ${samePair(from, to)})`);
  return (await findLink(from, to))?.id ?? id;
}

/**
 * Unlink: soft-delete the link and every other live link between the same two records (either
 * direction, any relation). The Related list shows one row per record, so removing only one of
 * several links would leave the row on screen. Keeps sync history.
 */
export async function removeLink(linkId: string) {
  const t = now();
  await db.run(sql`
    update links set deleted_at = ${t}, updated_at = ${t}
    where deleted_at is null and exists (
      select 1 from links l where l.id = ${linkId} and (
        (l.from_type = links.from_type and l.from_id = links.from_id and l.to_type = links.to_type and l.to_id = links.to_id) or
        (l.from_type = links.to_type and l.from_id = links.to_id and l.to_type = links.from_type and l.to_id = links.from_id)))`);
}
