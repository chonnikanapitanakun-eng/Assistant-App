import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => import('@/db/__tests__/mock-db'));

const { resetDb } = await import('@/db/__tests__/mock-db');
const { db, wallets, transactions, categories } = await import('@/db');
const {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  createBill,
  updateBill,
  deleteBill,
  markBillPaid,
  undoBillPaid,
  createWallet,
  updateWallet,
  deleteWallet,
  setBudget,
  getBill,
} = await import('../queries');
const { eq } = await import('drizzle-orm');

beforeEach(() => {
  resetDb();
});

async function seedWallet(over: Partial<{ name: string; type: 'cash' | 'bank' | 'card' | 'investment'; currency: string; balance: number }> = {}) {
  return createWallet({ name: 'กระเป๋าเงินสด', type: 'cash', currency: 'THB', balance: 0, ...over });
}

describe('createWallet / updateWallet / deleteWallet', () => {
  it('assigns increasing sortOrder to new wallets', async () => {
    const a = await seedWallet({ name: 'A' });
    const b = await seedWallet({ name: 'B' });
    const rows = await db.select().from(wallets).orderBy(wallets.sortOrder).all();
    expect(rows.map((w) => w.id)).toEqual([a, b]);
    expect(rows[1].sortOrder).toBeGreaterThan(rows[0].sortOrder);
  });

  it('updates fields', async () => {
    const id = await seedWallet({ name: 'เดิม' });
    await updateWallet(id, { name: 'ใหม่', type: 'bank', currency: 'GBP', balance: 100 });
    const wallet = await db.select().from(wallets).where(eq(wallets.id, id)).get();
    expect(wallet).toMatchObject({ name: 'ใหม่', type: 'bank', currency: 'GBP', balance: 100 });
  });

  it('soft-deletes without dropping transaction history', async () => {
    const id = await seedWallet();
    await deleteWallet(id);
    const wallet = await db.select().from(wallets).where(eq(wallets.id, id)).get();
    expect(wallet?.deletedAt).toBeTypeOf('number');
  });
});

describe('createTransaction / updateTransaction', () => {
  it("stamps the transaction's currency from its wallet, not the caller", async () => {
    const walletId = await seedWallet({ currency: 'GBP' });
    const id = await createTransaction({ type: 'expense', amount: 25, walletId, toWalletId: null, categoryId: null, date: '2026-09-25', note: 'coffee' });
    const tx = await db.select().from(transactions).where(eq(transactions.id, id)).get();
    expect(tx?.currency).toBe('GBP');
    expect(tx?.source).toBe('manual');
  });

  it('defaults to THB when the wallet has no currency match (unknown wallet id)', async () => {
    const id = await createTransaction({ type: 'income', amount: 500, walletId: 'missing-wallet', toWalletId: null, categoryId: null, date: '2026-09-25', note: null });
    const tx = await db.select().from(transactions).where(eq(transactions.id, id)).get();
    expect(tx?.currency).toBe('THB');
  });

  it('re-derives currency when the wallet changes on update', async () => {
    const thb = await seedWallet({ currency: 'THB' });
    const gbp = await seedWallet({ currency: 'GBP' });
    const id = await createTransaction({ type: 'expense', amount: 10, walletId: thb, toWalletId: null, categoryId: null, date: '2026-09-25', note: null });
    await updateTransaction(id, { type: 'expense', amount: 10, walletId: gbp, toWalletId: null, categoryId: null, date: '2026-09-25', note: null });
    const tx = await db.select().from(transactions).where(eq(transactions.id, id)).get();
    expect(tx?.currency).toBe('GBP');
  });
});

describe('deleteTransaction', () => {
  it('soft-deletes the row', async () => {
    const walletId = await seedWallet();
    const id = await createTransaction({ type: 'expense', amount: 5, walletId, toWalletId: null, categoryId: null, date: '2026-09-25', note: null });
    await deleteTransaction(id);
    const tx = await db.select().from(transactions).where(eq(transactions.id, id)).get();
    expect(tx?.deletedAt).toBeTypeOf('number');
  });
});

describe('setBudget', () => {
  it('sets and clears a category budget', async () => {
    const [{ id: categoryId }] = await db
      .insert(categories)
      .values({ id: 'cat-food', nameTh: 'อาหาร', nameEn: 'Food', type: 'expense', createdAt: 1, updatedAt: 1 })
      .returning({ id: categories.id });
    await setBudget(categoryId, 5000);
    expect((await db.select().from(categories).where(eq(categories.id, categoryId)).get())?.budgetMonthly).toBe(5000);
    await setBudget(categoryId, null);
    expect((await db.select().from(categories).where(eq(categories.id, categoryId)).get())?.budgetMonthly).toBeNull();
  });
});

const billValues = (over: Partial<Parameters<typeof createBill>[0]> = {}) => ({
  name: 'Netflix',
  amount: 419,
  currency: 'THB',
  walletId: null,
  categoryId: null,
  dueDay: 5,
  frequency: 'monthly' as const,
  dueMonth: null,
  remindDaysBefore: 3,
  isSubscription: true,
  ...over,
});

describe('createBill / updateBill / deleteBill / getBill', () => {
  it('round-trips through getBill', async () => {
    const id = await createBill(billValues());
    const bill = await getBill(id);
    expect(bill).toMatchObject({ name: 'Netflix', amount: 419 });
  });

  it('getBill hides soft-deleted bills', async () => {
    const id = await createBill(billValues());
    await deleteBill(id);
    expect(await getBill(id)).toBeUndefined();
  });

  it('updates fields', async () => {
    const id = await createBill(billValues());
    await updateBill(id, billValues({ name: 'Netflix Premium', amount: 599 }));
    const bill = await getBill(id);
    expect(bill).toMatchObject({ name: 'Netflix Premium', amount: 599 });
  });
});

describe('markBillPaid / undoBillPaid', () => {
  it('pays from the bill wallet, advances paidThrough, and records lastPaymentId', async () => {
    const walletId = await seedWallet({ currency: 'THB' });
    const billId = await createBill(billValues({ walletId, dueDay: 5 }));
    const bill = await getBill(billId);
    const ok = await markBillPaid(bill!);
    expect(ok).toBe(true);

    const after = await getBill(billId);
    expect(after?.paidThrough).toBeTruthy();
    expect(after?.previousPaidThrough).toBe(bill!.paidThrough);
    expect(after?.lastPaymentId).toBeTruthy();

    const tx = await db.select().from(transactions).where(eq(transactions.id, after!.lastPaymentId!)).get();
    expect(tx).toMatchObject({ walletId, amount: 419, type: 'expense', note: 'Netflix' });
  });

  it('falls back to a wallet in the same currency when the bill has none set', async () => {
    const walletId = await seedWallet({ currency: 'GBP' });
    const billId = await createBill(billValues({ walletId: null, currency: 'GBP' }));
    const ok = await markBillPaid((await getBill(billId))!);
    expect(ok).toBe(true);
    const after = await getBill(billId);
    const tx = await db.select().from(transactions).where(eq(transactions.id, after!.lastPaymentId!)).get();
    expect(tx?.walletId).toBe(walletId);
  });

  it('returns false and writes nothing when no wallet can pay it', async () => {
    const billId = await createBill(billValues({ walletId: null, currency: 'GBP' }));
    const bill = await getBill(billId);
    const ok = await markBillPaid(bill!);
    expect(ok).toBe(false);
    expect(await getBill(billId)).toEqual(bill);
  });

  it('undo removes the expense and restores the previous paidThrough', async () => {
    const walletId = await seedWallet();
    const billId = await createBill(billValues({ walletId }));
    const original = await getBill(billId);
    await markBillPaid(original!);
    const paid = await getBill(billId);

    await undoBillPaid(paid!);

    const restored = await getBill(billId);
    expect(restored?.paidThrough).toBe(original!.paidThrough);
    expect(restored?.lastPaymentId).toBeNull();
    const tx = await db.select().from(transactions).where(eq(transactions.id, paid!.lastPaymentId!)).get();
    expect(tx?.deletedAt).toBeTypeOf('number');
  });

  it('undo is a no-op when nothing was ever paid', async () => {
    const billId = await createBill(billValues());
    const before = await getBill(billId);
    await undoBillPaid(before!);
    expect(await getBill(billId)).toEqual(before);
  });
});
