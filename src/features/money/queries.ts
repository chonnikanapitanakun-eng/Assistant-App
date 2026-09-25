import { and, asc, desc, eq, isNotNull, isNull } from 'drizzle-orm';

import { categories, commit, db, recurringBills, transactions, useRows, wallets, type Category, type RecurringBill, type Transaction, type Wallet } from '@/db';
import { cancelBillReminder, syncBillReminder } from '@/features/notifications';
import { background } from '@/lib/background';
import { toDateKey } from '@/lib/date';
import { newId, now } from '@/lib/ids';

import { billRemindAt, nextDueDate } from './model';

export function useWallets(): Wallet[] {
  return useRows(db.select().from(wallets).where(isNull(wallets.deletedAt)).orderBy(asc(wallets.sortOrder))).data;
}

/** Every wallet including hidden (deleted) ones — for editing old transactions that point at one. */
export function useAllWallets(): Wallet[] {
  return useRows(db.select().from(wallets).orderBy(asc(wallets.sortOrder))).data;
}

/** All live transactions, newest first. Money screens filter by month/currency in memory. */
export function useTransactions(): Transaction[] {
  return useRows(db.select().from(transactions).where(isNull(transactions.deletedAt)).orderBy(desc(transactions.date), desc(transactions.createdAt))).data;
}

export function useCategories(): Category[] {
  return useRows(db.select().from(categories).where(isNull(categories.deletedAt)).orderBy(asc(categories.sortOrder))).data;
}

export function useBills(): RecurringBill[] {
  return useRows(db.select().from(recurringBills).where(isNull(recurringBills.deletedAt))).data;
}

function useOne<T>(table: typeof transactions | typeof recurringBills | typeof wallets | typeof categories, id: string): { row: T | undefined; loaded: boolean } {
  const { data, loaded } = useRows<unknown>(db.select().from(table).where(and(eq(table.id, id), isNull(table.deletedAt))));
  return { row: data[0] as T | undefined, loaded };
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
async function currencyOf(walletId: string): Promise<string> {
  return (await db.select({ c: wallets.currency }).from(wallets).where(eq(wallets.id, walletId)).get())?.c ?? 'THB';
}

export async function createTransaction(v: TransactionFormValues): Promise<string> {
  const id = newId();
  await db.insert(transactions).values({ id, ...v, currency: await currencyOf(v.walletId), source: 'manual', ...stamp() });
  return id;
}

/** Rows confirmed on the slip review screen, saved in one transaction. */
export type SlipTransactionValues = TransactionFormValues & { payee: string | null; slipRef: string | null };

export async function createSlipTransactions(rows: SlipTransactionValues[]): Promise<void> {
  if (!rows.length) return;
  const currencies = new Map<string, string>();
  for (const r of rows) if (!currencies.has(r.walletId)) currencies.set(r.walletId, await currencyOf(r.walletId));
  await commit(rows.map((r) => db.insert(transactions).values({ id: newId(), ...r, currency: currencies.get(r.walletId)!, source: 'slip', ...stamp() })));
}

/** Refs of live transactions that came from a slip — a slip whose ref is here was already saved. */
export async function getSlipRefs(): Promise<Set<string>> {
  const rows = await db.select({ ref: transactions.slipRef }).from(transactions).where(and(isNotNull(transactions.slipRef), isNull(transactions.deletedAt))).all();
  return new Set(rows.map((r) => r.ref!));
}

/** Recent payee → category choices, for matching a new slip's payee to a category. */
export function getPayeeHistory() {
  return db
    .select({ payee: transactions.payee, categoryId: transactions.categoryId, type: transactions.type, createdAt: transactions.createdAt })
    .from(transactions)
    .where(and(isNotNull(transactions.payee), isNull(transactions.deletedAt)))
    .orderBy(desc(transactions.createdAt))
    .limit(1000)
    .all();
}

/** Keeps the transaction's own currency unless it is moved to a different source wallet. */
export async function updateTransaction(id: string, v: TransactionFormValues) {
  const current = await db.select({ walletId: transactions.walletId, currency: transactions.currency }).from(transactions).where(eq(transactions.id, id)).get();
  const currency = current && current.walletId === v.walletId ? current.currency : await currencyOf(v.walletId);
  await db.update(transactions).set({ ...v, currency, updatedAt: now() }).where(eq(transactions.id, id));
}

export async function deleteTransaction(id: string) {
  const t = now();
  await db.update(transactions).set({ deletedAt: t, updatedAt: t }).where(eq(transactions.id, id));
}

/** Undo a delete. */
export async function restoreTransaction(id: string) {
  await db.update(transactions).set({ deletedAt: null, updatedAt: now() }).where(eq(transactions.id, id));
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

function syncReminder(id: string, name: string, due: string, remindDaysBefore: number, reminderNotificationId: string | null) {
  background(syncBillReminder({ id, name, remindAt: billRemindAt(due, remindDaysBefore), reminderNotificationId }), 'Bill reminder');
}

export async function createBill(v: BillFormValues): Promise<string> {
  const id = newId();
  await db.insert(recurringBills).values({ id, ...v, ...stamp() });
  syncReminder(id, v.name, nextDueDate({ ...v, paidThrough: null }), v.remindDaysBefore, null);
  return id;
}

/**
 * Editing a bill ends the undo window of its last "Mark paid" (the payment itself stays):
 * the row's "Paid today / Undo" is keyed on `lastPaymentId` + `updatedAt`, and this bumps `updatedAt`.
 */
export async function updateBill(existing: RecurringBill, v: BillFormValues) {
  await db.update(recurringBills).set({ ...v, lastPaymentId: null, previousPaidThrough: null, updatedAt: now() }).where(eq(recurringBills.id, existing.id));
  syncReminder(existing.id, v.name, nextDueDate({ ...v, paidThrough: existing.paidThrough }), v.remindDaysBefore, existing.reminderNotificationId);
}

export async function deleteBill(bill: RecurringBill) {
  const t = now();
  await db.update(recurringBills).set({ deletedAt: t, updatedAt: t }).where(eq(recurringBills.id, bill.id));
  background(cancelBillReminder(bill.reminderNotificationId), 'Cancel bill reminder');
}

const paying = new Map<string, Promise<boolean>>();

/**
 * Pay the bill's current cycle: record the expense from its wallet (or the first
 * wallet in the same currency), then advance `paidThrough`. Returns false when
 * there is no wallet to pay from.
 *
 * Idempotent for the cycle `bill` (as the caller saw it) is on: calls for the same bill are
 * serialized, and the row is re-read first, so a repeat (double tap, stale row) whose cycle is
 * already covered by `paidThrough` records nothing.
 */
export function markBillPaid(bill: RecurringBill): Promise<boolean> {
  const previous = paying.get(bill.id) ?? Promise.resolve(true);
  const next = previous.catch(() => true).then(() => payBill(bill));
  paying.set(bill.id, next);
  void next.finally(() => {
    if (paying.get(bill.id) === next) paying.delete(bill.id);
  }).catch(() => undefined);
  return next;
}

async function payBill(seen: RecurringBill): Promise<boolean> {
  const bill = await getBill(seen.id);
  if (!bill) return true; // deleted meanwhile: nothing to pay
  const cycle = nextDueDate(seen);
  if (bill.paidThrough && bill.paidThrough >= cycle) return true; // that cycle is already paid
  const walletList = await db.select().from(wallets).where(isNull(wallets.deletedAt)).orderBy(asc(wallets.sortOrder)).all();
  const wallet = walletList.find((w) => w.id === bill.walletId) ?? walletList.find((w) => w.currency === bill.currency);
  if (!wallet) return false;
  const due = nextDueDate(bill);
  const txId = newId();
  await commit([
    db
      .insert(transactions)
      .values({ id: txId, walletId: wallet.id, amount: bill.amount, currency: wallet.currency, type: 'expense', categoryId: bill.categoryId, date: toDateKey(), note: bill.name, source: 'manual', ...stamp() }),
    db.update(recurringBills).set({ paidThrough: due, previousPaidThrough: bill.paidThrough, lastPaymentId: txId, updatedAt: now() }).where(eq(recurringBills.id, bill.id)),
  ]);
  syncReminder(bill.id, bill.name, nextDueDate({ ...bill, paidThrough: due }), bill.remindDaysBefore, bill.reminderNotificationId);
  return true;
}

/** Undo the last "Mark paid": remove its expense and restore the previous paid-through date. */
export async function undoBillPaid(bill: RecurringBill) {
  if (!bill.lastPaymentId) return;
  const t = now();
  await commit([
    db.update(transactions).set({ deletedAt: t, updatedAt: t }).where(eq(transactions.id, bill.lastPaymentId)),
    db.update(recurringBills).set({ paidThrough: bill.previousPaidThrough, lastPaymentId: null, previousPaidThrough: null, updatedAt: t }).where(eq(recurringBills.id, bill.id)),
  ]);
  syncReminder(bill.id, bill.name, nextDueDate({ ...bill, paidThrough: bill.previousPaidThrough }), bill.remindDaysBefore, bill.reminderNotificationId);
}

// ── Wallets & budgets ──────────────────────────────────────────────────

export type WalletFormValues = { name: string; type: Wallet['type']; currency: string; balance: number; bankCode: string | null; accountDigits: string | null };

export async function createWallet(v: WalletFormValues): Promise<string> {
  const id = newId();
  const order = (await db.select({ o: wallets.sortOrder }).from(wallets).orderBy(desc(wallets.sortOrder)).limit(1).get())?.o ?? 0;
  await db.insert(wallets).values({ id, ...v, sortOrder: order + 1, ...stamp() });
  return id;
}

export async function updateWallet(id: string, v: WalletFormValues) {
  await db.update(wallets).set({ ...v, updatedAt: now() }).where(eq(wallets.id, id));
}

/** Hides the account; its transactions are kept for history. */
export async function deleteWallet(id: string) {
  const t = now();
  await db.update(wallets).set({ deletedAt: t, updatedAt: t }).where(eq(wallets.id, id));
}

export async function setBudget(categoryId: string, amount: number | null) {
  await db.update(categories).set({ budgetMonthly: amount, updatedAt: now() }).where(eq(categories.id, categoryId));
}

export function getBill(id: string): Promise<RecurringBill | undefined> {
  return db.select().from(recurringBills).where(and(eq(recurringBills.id, id), isNull(recurringBills.deletedAt))).get();
}
