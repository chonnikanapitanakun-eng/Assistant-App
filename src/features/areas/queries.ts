import { and, eq, inArray, isNull, or } from 'drizzle-orm';

import { areas, commit, contacts, db, links, notes, routines, tasks, transactions, useRows, type Area } from '@/db';
import { newId, now } from '@/lib/ids';

/** Single area for area/[id]. `loaded` separates "still loading" from "not found". */
export function useArea(id: string): { area: Area | undefined; loaded: boolean } {
  const { data, loaded } = useRows(db.select().from(areas).where(and(eq(areas.id, id), isNull(areas.deletedAt))));
  return { area: data[0], loaded };
}

export type AreaFormValues = Pick<Area, 'nameTh' | 'nameEn' | 'parentId'>;

/** Top-level areas with their children, both in sort order. */
export function groupAreas(list: Area[]): { parent: Area; children: Area[] }[] {
  const sorted = [...list].sort((a, b) => a.sortOrder - b.sortOrder);
  return sorted.filter((a) => !a.parentId).map((parent) => ({ parent, children: sorted.filter((a) => a.parentId === parent.id) }));
}

export async function createArea(values: AreaFormValues, sortOrder: number): Promise<string> {
  const id = newId();
  const t = now();
  await db.insert(areas).values({ id, createdAt: t, updatedAt: t, sortOrder, ...values });
  return id;
}

export async function updateArea(id: string, values: AreaFormValues) {
  await db.update(areas).set({ ...values, updatedAt: now() }).where(eq(areas.id, id));
}

/**
 * Soft delete an area and its children. Records filed under them keep existing, just without an area,
 * and links to the areas are removed.
 */
export async function deleteArea(id: string) {
  const t = now();
  const children = await db.select({ id: areas.id }).from(areas).where(and(eq(areas.parentId, id), isNull(areas.deletedAt))).all();
  const ids = [id, ...children.map((c) => c.id)];
  const clear = { areaId: null, updatedAt: t };
  await commit([
    db.update(areas).set({ deletedAt: t, updatedAt: t }).where(inArray(areas.id, ids)),
    db.update(tasks).set(clear).where(inArray(tasks.areaId, ids)),
    db.update(routines).set(clear).where(inArray(routines.areaId, ids)),
    db.update(notes).set(clear).where(inArray(notes.areaId, ids)),
    db.update(transactions).set(clear).where(inArray(transactions.areaId, ids)),
    db.update(contacts).set(clear).where(inArray(contacts.areaId, ids)),
    db
      .update(links)
      .set({ deletedAt: t, updatedAt: t })
      .where(and(isNull(links.deletedAt), or(and(eq(links.fromType, 'area'), inArray(links.fromId, ids)), and(eq(links.toType, 'area'), inArray(links.toId, ids))))),
  ]);
}
