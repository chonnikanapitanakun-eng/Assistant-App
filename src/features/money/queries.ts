import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { categories, db, recurringBills, transactions, wallets, type Category, type RecurringBill, type Transaction, type Wallet } from '@/db';
import { toDateKey } from '@/lib/date';
import { newId, now } from '@/lib/ids';

import { nextDueDate } from './model';

export function useWallets(): Wallet[] {
  const { data } = useLiveQuery(db.select().from(wallets).where(isNull(wallets.deletedAt)).orderBy(asc(wallets.sortOrder)));
  return data;
}

/** All live transactions, newest first. Money screens filter by month/currency in memory. */
export function useTransactions(): Transaction[] {
  const { data } = useLiveQuery(db.select().from(transactions).where(isNull(transactions.deletedAt)).orderBy(desc(transactions.date), desc(transactions.createdAt)));
  return data;
}

export function useCategories(): Category[] {
  const { data } = useLiveQuery(db.select().from(categories).where(isNull(categories.deletedAt)).orderBy(asc(categories.sortOrder)));
  return data;
}

export function useBills(): RecurringBill[] {
  const { data } = useLiveQuery(db.select().from(recurringBills).where(isNull(recurringBills.deletedAt)));
  return data;
}

function useOne<T>(table: typeof transactions | typeof recurringBills | typeof wallets | typeof categories, id: string): { row: T | undefined; loaded: boolean } {
  const { data, updatedAt } = useLiveQuery(db.select().from(table).where(and(eq(table.id, id), isNull(table.deletedAt))), [id]);
  return { row: data[0] as T | undefined, loaded: updatedAt !== undefined };
}
export const useTransaction = (id: string) => useOne<Transaction>(transactions, id);
export const useBill = (id: string) => useOne<RecurringBill>(recurringBills, id);
export const useWallet = (id: string) => useOne<Wallet>(wallets, id);
export const useCategory = (id: string) => useOne<Category>(categories, id);

const stamp = () => {
  const t = now();
  return { createdAt: t, updatedAt: t };
};

// ── Transactions ───────────────────────────────────────────────────────

export type TransactionFormValues = {
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  walletId: string;
  toWalletId: string | null;
  categoryId: string | null;
  date: string;
  note: string | null;
};

/** Currency always follows the source wallet. */
function currencyOf(walletId: string): string {
  return db.select({ c: wallets.currency }).from(wallets).where(eq(wallets.id, walletId)).get()?.c ?? 'THB';
}

export function createTransaction(v: TransactionFormValues): string {
  const id = newId();
  db.insert(transactions).values({ id, ...v, currency: currencyOf(v.walletId), source: 'manual', ...stamp() }).run();
  return id;
}

export function updateTransaction(id: string, v: TransactionFormValues) {
  db.update(transactions).set({ ...v, currency: currencyOf(v.walletId), updatedAt: now() }).where(eq(transactions.id, id)).run();
}

export function deleteTransaction(id: string) {
  const t = now();
  db.update(transactions).set({ deletedAt: t, updatedAt: t }).where(eq(transactions.id, id)).run();
}

// ── Bills ──────────────────────────────────────────────────────────────

export type BillFormValues = {
  name: string;
  amount: number;
  currency: string;
  walletId: string | null;
  categoryId: string | null;
  dueDay: number;
  frequency: 'monthly' | 'yearly';
  dueMonth: number | null;
  remindDaysBefore: number;
  isSubscription: boolean;
};

export function createBill(v: BillFormValues): string {
  const id = newId();
  db.insert(recurringBills).values({ id, ...v, ...stamp() }).run();
  return id;
}

export function updateBill(id: string, v: BillFormValues) {
  db.update(recurringBills).set({ ...v, updatedAt: now() }).where(eq(recurringBills.id, id)).run();
}

export function deleteBill(id: string) {
  const t = now();
  db.update(recurringBills).set({ deletedAt: t, updatedAt: t }).where(eq(recurringBills.id, id)).run();
}

/**
 * Pay the bill's current cycle: record the expense from its wallet (or the first
 * wallet in the same currency), then advance `paidThrough`. Returns false when
 * there is no wallet to pay from.
 */
export function markBillPaid(bill: RecurringBill): boolean {
  const walletList = db.select().from(wallets).where(isNull(wallets.deletedAt)).orderBy(asc(wallets.sortOrder)).all();
  const wallet = walletList.find((w) => w.id === bill.walletId) ?? walletList.find((w) => w.currency === bill.currency);
  if (!wallet) return false;
  const due = nextDueDate(bill);
  const txId = newId();
  db.transaction((tx) => {
    tx.insert(transactions)
      .values({ id: txId, walletId: wallet.id, amount: bill.amount, currency: wallet.currency, type: 'expense', categoryId: bill.categoryId, date: toDateKey(), note: bill.name, source: 'manual', ...stamp() })
      .run();
    tx.update(recurringBills).set({ paidThrough: due, previousPaidThrough: bill.paidThrough, lastPaymentId: txId, updatedAt: now() }).where(eq(recurringBills.id, bill.id)).run();
  });
  return true;
}

/** Undo the last "Mark paid": remove its expense and restore the previous paid-through date. */
export function undoBillPaid(bill: RecurringBill) {
  if (!bill.lastPaymentId) return;
  const t = now();
  db.transaction((tx) => {
    tx.update(transactions).set({ deletedAt: t, updatedAt: t }).where(eq(transactions.id, bill.lastPaymentId!)).run();
    tx.update(recurringBills).set({ paidThrough: bill.previousPaidThrough, lastPaymentId: null, previousPaidThrough: null, updatedAt: t }).where(eq(recurringBills.id, bill.id)).run();
  });
}

// ── Wallets & budgets ──────────────────────────────────────────────────

export type WalletFormValues = { name: string; type: Wallet['type']; currency: string; balance: number };

export function createWallet(v: WalletFormValues): string {
  const id = newId();
  const order = db.select({ o: wallets.sortOrder }).from(wallets).orderBy(desc(wallets.sortOrder)).limit(1).get()?.o ?? 0;
  db.insert(wallets).values({ id, ...v, sortOrder: order + 1, ...stamp() }).run();
  return id;
}

export function updateWallet(id: string, v: WalletFormValues) {
  db.update(wallets).set({ ...v, updatedAt: now() }).where(eq(wallets.id, id)).run();
}

/** Hides the account; its transactions are kept for history. */
export function deleteWallet(id: string) {
  const t = now();
  db.update(wallets).set({ deletedAt: t, updatedAt: t }).where(eq(wallets.id, id)).run();
}

export function setBudget(categoryId: string, amount: number | null) {
  db.update(categories).set({ budgetMonthly: amount, updatedAt: now() }).where(eq(categories.id, categoryId)).run();
}

export function getBill(id: string): RecurringBill | undefined {
  return db.select().from(recurringBills).where(and(eq(recurringBills.id, id), isNull(recurringBills.deletedAt))).get();
}
