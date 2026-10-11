import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => import('@/db/__tests__/mock-db'));

const { resetDb } = await import('@/db/__tests__/mock-db');
const { db, areas, categories, tasks, transactions, wallets, links } = await import('@/db');
const { defaultAreas, defaultCategories, defaultWallets } = await import('@/db/defaults');
const { mergeDuplicateDefaults } = await import('../dedupe');
const { isNull } = await import('drizzle-orm');

beforeEach(() => {
  resetDb();
});

/** One install's worth of default rows, ids prefixed so tests can tell copies apart. */
async function seedCopy(prefix: string, createdAt: number) {
  const stamp = { createdAt, updatedAt: createdAt };
  for (const a of defaultAreas) {
    const parentId = `${prefix}-area-${a.nameEn}`;
    await db.insert(areas).values({ id: parentId, nameTh: a.nameTh, nameEn: a.nameEn, ...stamp });
    for (const c of a.children) await db.insert(areas).values({ id: `${prefix}-area-${a.nameEn}-${c.nameEn}`, nameTh: c.nameTh, nameEn: c.nameEn, parentId, ...stamp });
  }
  for (const c of defaultCategories) await db.insert(categories).values({ id: `${prefix}-cat-${c.nameEn}`, ...c, ...stamp });
  for (const w of defaultWallets) await db.insert(wallets).values({ id: `${prefix}-wallet-${w.name}`, ...w, ...stamp });
}

const live = <T extends typeof areas | typeof categories | typeof wallets>(table: T) => db.select().from(table as typeof wallets).where(isNull((table as typeof wallets).deletedAt)).all();

describe('mergeDuplicateDefaults', () => {
  it('folds every extra copy of the defaults into the oldest one', async () => {
    await seedCopy('old', 1000);
    await seedCopy('new', 2000);
    await seedCopy('newer', 3000);

    expect(await mergeDuplicateDefaults()).toBe(true);

    const areaCount = defaultAreas.reduce((n, a) => n + 1 + a.children.length, 0);
    expect((await live(areas)).length).toBe(areaCount);
    expect((await live(categories)).length).toBe(defaultCategories.length);
    expect((await live(wallets)).length).toBe(defaultWallets.length);
    for (const table of [areas, categories, wallets]) expect((await live(table)).every((r) => r.id.startsWith('old-'))).toBe(true);
  });

  it('moves references from a copy to the keeper', async () => {
    await seedCopy('old', 1000);
    await seedCopy('new', 2000);
    const stamp = { createdAt: 5000, updatedAt: 5000 };
    await db.insert(transactions).values({ id: 't1', walletId: 'new-wallet-เงินสด', toWalletId: 'new-wallet-บัญชีธนาคาร (THB)', categoryId: 'new-cat-Food', areaId: 'new-area-Work', amount: 10, type: 'transfer', date: '2026-10-01', ...stamp });
    await db.insert(tasks).values({ id: 'task1', title: 'CIMA SCS', areaId: 'new-area-Learning-CIMA', ...stamp });
    await db.insert(links).values({ id: 'l1', fromType: 'task', fromId: 'task1', toType: 'area', toId: 'new-area-Business', ...stamp });

    await mergeDuplicateDefaults();

    const [tx] = await db.select().from(transactions).all();
    expect(tx).toMatchObject({ walletId: 'old-wallet-เงินสด', toWalletId: 'old-wallet-บัญชีธนาคาร (THB)', categoryId: 'old-cat-Food', areaId: 'old-area-Work' });
    expect(tx.updatedAt).toBeGreaterThan(5000); // dirty, so the next push carries it
    expect((await db.select().from(tasks).all())[0].areaId).toBe('old-area-Learning-CIMA');
    expect((await db.select().from(links).all())[0].toId).toBe('old-area-Business');
  });

  it('keeps a budget set only on a copy', async () => {
    await seedCopy('old', 1000);
    await seedCopy('new', 2000);
    const { eq } = await import('drizzle-orm');
    await db.update(categories).set({ budgetMonthly: 8000 }).where(eq(categories.id, 'new-cat-Food'));

    await mergeDuplicateDefaults();

    const food = (await db.select().from(categories).where(isNull(categories.deletedAt)).all()).find((c) => c.nameEn === 'Food');
    expect(food).toMatchObject({ id: 'old-cat-Food', budgetMonthly: 8000 });
  });

  it('leaves renamed rows and wallet copies with their own opening balance alone', async () => {
    await seedCopy('old', 1000);
    const stamp = { createdAt: 2000, updatedAt: 2000 };
    await db.insert(wallets).values({ id: 'mine', name: 'เงินสด (ร้าน)', type: 'cash', currency: 'THB', ...stamp });
    await db.insert(wallets).values({ id: 'funded', name: 'เงินสด', type: 'cash', currency: 'THB', balance: 500, ...stamp });

    expect(await mergeDuplicateDefaults()).toBe(false);
    expect((await live(wallets)).map((w) => w.id).sort()).toEqual(['funded', 'mine', 'old-wallet-UK Bank (GBP)', 'old-wallet-บัญชีธนาคาร (THB)', 'old-wallet-เงินสด'].sort());
  });

  it('is a no-op once merged', async () => {
    await seedCopy('old', 1000);
    await seedCopy('new', 2000);
    expect(await mergeDuplicateDefaults()).toBe(true);
    expect(await mergeDuplicateDefaults()).toBe(false);
  });
});
