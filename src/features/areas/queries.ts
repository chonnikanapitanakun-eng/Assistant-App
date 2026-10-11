import { and, eq, inArray, isNull, or } from 'drizzle-orm';

import { areas, commit, contacts, db, links, notes, routines, tasks, transactions, useRows, type Area } from '@/db';
import { newId, now } from '@/lib/ids';

/** Single area for area/[id]. `loaded` separates "still loading" from "not found". */
export function useArea(id: string): { area: Area | undefined; loaded: boolean } {
  const { data, loaded } = useRows(db.select().from(areas).where(and(eq(areas.id, id), isNull(areas.deletedAt))));
  return { area: data[0], loaded };
}

export type AreaFormValues = Pick<Area, 'nameTh' | 'nameEn' | 'parentId' | 'color' | 'icon'>;

/** Swatches offered in the area editor (the seeded areas use the first four). */
export const AREA_COLORS = ['#1F4A85', '#2E9E6B', '#7B5CC7', '#C9A227', '#D9534F', '#E07B39', '#2A9BB5', '#C2477F', '#5B6B7F'] as const;
/** Icons offered in the area editor (Feather names). */
export const AREA_ICONS = ['folder', 'briefcase', 'heart', 'book', 'trending-up', 'home', 'users', 'star', 'coffee', 'globe', 'dollar-sign', 'activity', 'award', 'code', 'shopping-bag', 'music'] as const;
export type AreaIcon = (typeof AREA_ICONS)[number];

/** The area's icon, or its parent's, or a folder (also covers icons stored that are not in the set). */
export function areaIcon(area: Pick<Area, 'icon'>, parent?: Pick<Area, 'icon'> | null): AreaIcon {
  const ok = (v: string | null | undefined): v is AreaIcon => !!v && (AREA_ICONS as readonly string[]).includes(v);
  return ok(area.icon) ? area.icon : ok(parent?.icon) ? parent.icon : 'folder';
}

/**
 * New sort orders after moving `id` one step up (-1) or down (+1) among its siblings, renumbered
 * 0..n so ties from older data don't stall the move. Empty when it is already at that end.
 */
export function reorderSiblings(list: Area[], id: string, dir: -1 | 1): { id: string; sortOrder: number }[] {
  const self = list.find((a) => a.id === id);
  if (!self) return [];
  const siblings = list.filter((a) => (a.parentId ?? null) === (self.parentId ?? null)).sort((a, b) => a.sortOrder - b.sortOrder);
  const i = siblings.findIndex((a) => a.id === id);
  const j = i + dir;
  if (j < 0 || j >= siblings.length) return [];
  [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
  return siblings.map((a, k) => ({ id: a.id, sortOrder: k })).filter((r) => list.find((a) => a.id === r.id)!.sortOrder !== r.sortOrder);
}

export async function moveArea(list: Area[], id: string, dir: -1 | 1) {
  const t = now();
  const changes = reorderSiblings(list, id, dir);
  if (changes.length) await commit(changes.map((c) => db.update(areas).set({ sortOrder: c.sortOrder, updatedAt: t }).where(eq(areas.id, c.id))));
}

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
