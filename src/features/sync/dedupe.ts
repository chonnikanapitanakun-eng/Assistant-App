import { and, eq, inArray, isNull } from 'drizzle-orm';

import { areas, categories, commit, contacts, db, links, notes, recurringBills, routines, tasks, transactions, wallets, type Write } from '@/db';
import { defaultAreas, defaultCategories, defaultWallets } from '@/db/defaults';
import { now } from '@/lib/ids';

/**
 * Every install seeds its own copy of the default areas / categories / wallets (db/seed.ts, random
 * ids), so signing in on a second device — or after an erase — syncs a second set into the account.
 * After each pull this folds every extra copy of a default into the oldest one: references move to
 * the keeper, the copy is soft-deleted, and the next push carries both to the cloud. Every device
 * picks the same keeper (oldest createdAt, then id), so two devices merging at once agree.
 *
 * Only rows still named like a default are touched, so a wallet the user created or renamed is never merged.
 * A wallet copy with its own opening balance is left alone rather than losing that balance.
 */
export async function mergeDuplicateDefaults(): Promise<boolean> {
  const t = now();
  const writes: Write[] = [];
  const retire = (table: typeof areas | typeof categories | typeof wallets, ids: string[]) =>
    writes.push(db.update(table).set({ deletedAt: t, updatedAt: t }).where(inArray(table.id, ids)));
  const move = <T extends { id: unknown; updatedAt: unknown }>(table: T, column: keyof T, keeper: string, ids: string[]) =>
    // Generic over the referencing tables; drizzle can't type a column picked by name.
    writes.push(db.update(table as never).set({ [column]: keeper, updatedAt: t } as never).where(inArray(table[column] as never, ids)));

  // Wallets
  const walletKeys = new Set(defaultWallets.map((w) => `${w.name}|${w.type}|${w.currency}`));
  const liveWallets = await db.select().from(wallets).where(isNull(wallets.deletedAt)).all();
  for (const [keeper, dupes] of groups(liveWallets, (w) => keyIf(walletKeys, `${w.name}|${w.type}|${w.currency}`))) {
    const ids = dupes.filter((w) => w.balance === 0 || w.balance === keeper.balance).map((w) => w.id);
    if (!ids.length) continue;
    move(transactions, 'walletId', keeper.id, ids);
    move(transactions, 'toWalletId', keeper.id, ids);
    move(recurringBills, 'walletId', keeper.id, ids);
    retire(wallets, ids);
  }

  // Categories
  const categoryKeys = new Set(defaultCategories.map((c) => `${c.nameEn}|${c.type}`));
  const liveCategories = await db.select().from(categories).where(isNull(categories.deletedAt)).all();
  for (const [keeper, dupes] of groups(liveCategories, (c) => keyIf(categoryKeys, `${c.nameEn}|${c.type}`))) {
    const ids = dupes.map((c) => c.id);
    move(transactions, 'categoryId', keeper.id, ids);
    move(recurringBills, 'categoryId', keeper.id, ids);
    // Keep a budget set on any copy.
    const budget = keeper.budgetMonthly ?? dupes.find((c) => c.budgetMonthly != null)?.budgetMonthly;
    if (budget != null && keeper.budgetMonthly == null) writes.push(db.update(categories).set({ budgetMonthly: budget, updatedAt: t }).where(eq(categories.id, keeper.id)));
    retire(categories, ids);
  }

  // Areas: top level first, then children grouped under their (merged) parent.
  const liveAreas = await db.select().from(areas).where(isNull(areas.deletedAt)).all();
  const topKeys = new Set(defaultAreas.map((a) => a.nameEn));
  const childKeys = new Set(defaultAreas.flatMap((a) => a.children.map((c) => `${a.nameEn}>${c.nameEn}`)));
  const mergedInto = new Map<string, string>();
  const tops = liveAreas.filter((a) => !a.parentId);
  for (const [keeper, dupes] of groups(tops, (a) => (topKeys.has(a.nameEn) ? a.nameEn : null))) {
    for (const d of dupes) mergedInto.set(d.id, keeper.id);
  }
  const topName = new Map(tops.map((a) => [a.id, a.nameEn]));
  const childKey = (a: (typeof liveAreas)[number]) => {
    const parent = topName.get(a.parentId ?? '');
    if (!parent || !childKeys.has(`${parent}>${a.nameEn}`)) return null;
    return `${mergedInto.get(a.parentId!) ?? a.parentId}>${a.nameEn}`;
  };
  for (const [keeper, dupes] of groups(liveAreas.filter((a) => a.parentId), childKey)) {
    for (const d of dupes) mergedInto.set(d.id, keeper.id);
  }
  // Group the merged ids by keeper and move every reference over.
  const byKeeper = new Map<string, string[]>();
  for (const [dupe, keeper] of mergedInto) byKeeper.set(keeper, [...(byKeeper.get(keeper) ?? []), dupe]);
  for (const [keeper, ids] of byKeeper) {
    // Children of a retired top-level copy that are not themselves merged move under the keeper.
    const orphans = liveAreas.filter((a) => a.parentId && ids.includes(a.parentId) && !mergedInto.has(a.id)).map((a) => a.id);
    if (orphans.length) writes.push(db.update(areas).set({ parentId: keeper, updatedAt: t }).where(inArray(areas.id, orphans)));
    for (const table of [tasks, notes, routines, contacts, transactions]) move(table, 'areaId', keeper, ids);
    writes.push(db.update(links).set({ fromId: keeper, updatedAt: t }).where(and(eq(links.fromType, 'area'), inArray(links.fromId, ids))));
    writes.push(db.update(links).set({ toId: keeper, updatedAt: t }).where(and(eq(links.toType, 'area'), inArray(links.toId, ids))));
    retire(areas, ids);
  }

  if (writes.length) await commit(writes);
  return writes.length > 0;
}

const keyIf = (allowed: Set<string>, key: string) => (allowed.has(key) ? key : null);

/** [keeper, extra copies] for every key (null = skip) shared by more than one row; keeper = oldest, then lowest id. */
function groups<R extends { id: string; createdAt: number }>(rows: R[], key: (r: R) => string | null): [R, R[]][] {
  const byKey = new Map<string, R[]>();
  for (const r of rows) {
    const k = key(r);
    if (k !== null) byKey.set(k, [...(byKey.get(k) ?? []), r]);
  }
  const out: [R, R[]][] = [];
  for (const list of byKey.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    out.push([list[0], list.slice(1)]);
  }
  return out;
}
