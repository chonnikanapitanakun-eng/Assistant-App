import { daysFromToday, toDateKey } from '@/lib/date';

/** Budgets are set in the primary currency. */
export const PRIMARY_CURRENCY = 'THB';

type Tx = { walletId: string; toWalletId: string | null; amount: number; currency: string; type: 'income' | 'expense' | 'transfer'; date: string; categoryId: string | null };
type WalletRow = { id: string; balance: number; currency: string };

/**
 * Current balance = opening balance (wallets.balance) + every transaction touching the wallet.
 * Transactions in another currency (no FX yet) are left out rather than mixed in.
 */
export function walletBalance(wallet: WalletRow, txs: Tx[]): number {
  let b = wallet.balance;
  for (const t of txs) {
    if (t.currency !== wallet.currency) continue;
    if (t.walletId === wallet.id) b += t.type === 'income' ? t.amount : -t.amount;
    else if (t.type === 'transfer' && t.toWalletId === wallet.id) b += t.amount;
  }
  return round2(b);
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Income / expense for one month in one currency (transfers excluded). */
export function monthTotals(txs: Tx[], month: string, currency: string) {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (!t.date.startsWith(month) || t.currency !== currency) continue;
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') expense += t.amount;
  }
  return { income: round2(income), expense: round2(expense), net: round2(income - expense) };
}

/** Expense per category for a month, largest first. Uncategorised spend is keyed `null`. */
export function spendingByCategory(txs: Tx[], month: string, currency: string): { categoryId: string | null; total: number }[] {
  const map = new Map<string | null, number>();
  for (const t of txs) {
    if (t.type !== 'expense' || t.currency !== currency || !t.date.startsWith(month)) continue;
    map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount);
  }
  return [...map.entries()].map(([categoryId, total]) => ({ categoryId, total: round2(total) })).sort((a, b) => b.total - a.total);
}

export type BudgetState = 'ok' | 'near' | 'over';
export function budgetStatus(spent: number, budget: number) {
  const ratio = budget > 0 ? spent / budget : 0;
  const state: BudgetState = ratio > 1 ? 'over' : ratio >= 0.85 ? 'near' : 'ok';
  return { ratio, state, remaining: round2(budget - spent) };
}

/** Currencies present across wallets, primary first. */
export function currenciesInUse(wallets: { currency: string }[]): string[] {
  const set = [...new Set(wallets.map((w) => w.currency))];
  return set.sort((a, b) => (a === PRIMARY_CURRENCY ? -1 : b === PRIMARY_CURRENCY ? 1 : a.localeCompare(b)));
}

// ── Bills ──────────────────────────────────────────────────────────────

type BillRow = { dueDay: number; frequency: 'monthly' | 'yearly'; dueMonth: number | null; paidThrough: string | null; remindDaysBefore: number };

/** Due date in a given month, clamped to the month's last day (e.g. 31 → 30 Sep). */
function dueIn(year: number, monthIdx: number, day: number): string {
  const last = new Date(year, monthIdx + 1, 0).getDate();
  return toDateKey(new Date(year, monthIdx, Math.min(day, last)));
}

/**
 * The next unpaid due date. Unpaid bills stay on this cycle's date even once
 * it has passed (so they show as overdue) until marked paid.
 */
export function nextDueDate(bill: BillRow, today: Date = new Date()): string {
  if (bill.frequency === 'yearly') {
    const m = (bill.dueMonth ?? today.getMonth() + 1) - 1;
    if (bill.paidThrough) return dueIn(Number(bill.paidThrough.slice(0, 4)) + 1, m, bill.dueDay);
    return dueIn(today.getFullYear(), m, bill.dueDay);
  }
  if (bill.paidThrough) {
    const [y, mo] = bill.paidThrough.split('-').map(Number);
    return dueIn(y, mo, bill.dueDay); // mo is 1-based, so this is the following month
  }
  return dueIn(today.getFullYear(), today.getMonth(), bill.dueDay);
}

export type BillState = 'overdue' | 'today' | 'soon' | 'later';
export function billState(due: string, remindDaysBefore: number, today: Date = new Date()): { state: BillState; days: number } {
  const days = daysFromToday(due, today);
  const state: BillState = days < 0 ? 'overdue' : days === 0 ? 'today' : days <= remindDaysBefore ? 'soon' : 'later';
  return { state, days };
}

/** Group dated rows by day, newest day first (rows keep their order within a day). */
export function groupByDate<T extends { date: string }>(rows: T[]): { date: string; rows: T[] }[] {
  const map = new Map<string, T[]>();
  for (const r of rows) map.set(r.date, [...(map.get(r.date) ?? []), r]);
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([date, rs]) => ({ date, rows: rs }));
}
