import { and, desc, eq, inArray, isNull, like, or } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { areas, calendarEvents, contacts, db, links, notes, tasks, transactions, type LinkableType } from '@/db';
import type { Writer } from '@/features/contacts/links';
import { newId, now } from '@/lib/ids';

import { defaultRelation, describe, otherEnd, refKey, sameRef, sortRelated, type Candidate, type LinkRef, type LinkableRow, type RelatedItem } from './model';

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
export function resolveRefs(refs: LinkRef[], lang: string): Map<string, { title: string; subtitle: string | null }> {
  const out = new Map<string, { title: string; subtitle: string | null }>();
  const byType = new Map<LinkableType, string[]>();
  for (const r of refs) byType.set(r.type, [...(byType.get(r.type) ?? []), r.id]);
  for (const [type, ids] of byType) {
    const table = tableFor[type];
    const rows = db.select().from(table).where(and(inArray(table.id, ids), isNull(table.deletedAt))).all();
    for (const row of rows) out.set(refKey({ type, id: row.id }), describe({ type, row } as LinkableRow, lang));
  }
  return out;
}

type LinkRow = typeof links.$inferSelect;

function toRelated(rows: LinkRow[], self: LinkRef, lang: string): RelatedItem[] {
  const ends = rows.flatMap((link) => {
    const end = otherEnd(link, self);
    return end ? [{ link, ...end }] : [];
  });
  const labels = resolveRefs(ends.map((e) => e.ref), lang);
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

/** Sync read (for actions and AI context outside React). */
export function getRelated(self: LinkRef, lang = 'th'): RelatedItem[] {
  return toRelated(linksTouching(self).all(), self, lang);
}

/**
 * Live "Related" list for a record. Re-runs when the `links` table changes;
 * labels are resolved on each run (see docs/LINKS.md for the trade-off).
 * Pass `null` for unsaved records — returns [].
 */
export function useRelated(self: LinkRef | null): RelatedItem[] {
  const { i18n } = useTranslation();
  // Depend on the primitive parts so callers can pass an inline `{ type, id }` without re-resolving every render.
  const type = self?.type ?? 'task';
  const id = self?.id ?? '';
  const { data } = useLiveQuery(linksTouching({ type, id }), [type, id]);
  const lang = i18n.language;
  return useMemo(() => (id ? toRelated(data, { type, id }, lang) : []), [data, type, id, lang]);
}

/** Records of `type` matching `q` (substring on the name field), newest first. */
function candidatesQuery(type: LinkableType, q: string, limit: number) {
  const pat = q ? `%${q}%` : null;
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
  const query = useMemo(() => candidatesQuery(type, q.trim(), limit), [type, q, limit]);
  const { data } = useLiveQuery(query as ReturnType<typeof candidatesQuery>, [type, q, limit]);
  const lang = i18n.language;
  const selfType = self.type;
  const selfId = self.id;
  return useMemo(
    () =>
      (data as LinkableRow['row'][])
        .map((row) => ({ ref: { type, id: row.id }, ...describe({ type, row } as LinkableRow, lang) }))
        .filter((c) => !sameRef(c.ref, { type: selfType, id: selfId })),
    [data, type, selfType, selfId, lang],
  );
}

/** Live link between two records in either direction (any relation). */
function findLink(w: Writer, a: LinkRef, b: LinkRef) {
  return w
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

/** Link two records. Idempotent: an existing live link (either direction) is reused. Returns the link id. */
export function addLink(from: LinkRef, to: LinkRef, relation: string = defaultRelation(to.type), w: Writer = db): string {
  if (sameRef(from, to)) throw new Error('Cannot link a record to itself');
  const existing = findLink(w, from, to);
  if (existing) return existing.id;
  const id = newId();
  const t = now();
  w.insert(links).values({ id, fromType: from.type, fromId: from.id, toType: to.type, toId: to.id, relation, createdAt: t, updatedAt: t }).run();
  return id;
}

/** Soft-delete one link (keeps sync history). */
export function removeLink(linkId: string, w: Writer = db) {
  const t = now();
  w.update(links).set({ deletedAt: t, updatedAt: t }).where(eq(links.id, linkId)).run();
}
