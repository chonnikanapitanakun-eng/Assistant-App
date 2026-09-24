import { and, asc, eq, isNull, like, sql } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db, transactions, wallets } from '@/db';

export function useWallets() {
  const { data } = useLiveQuery(db.select().from(wallets).where(isNull(wallets.deletedAt)).orderBy(asc(wallets.sortOrder)));
  return data;
}

const sumAmount = sql<number>`coalesce(sum(${transactions.amount}), 0)`;

/** ยอดใช้จ่ายวันนี้และเดือนนี้ (THB only จนกว่าจะมี FX ใน Phase 2) */
export function useTodayMoney(date: string) {
  const month = date.slice(0, 7);
  const { data: today } = useLiveQuery(
    db.select({ total: sumAmount }).from(transactions).where(and(eq(transactions.date, date), eq(transactions.type, 'expense'), eq(transactions.currency, 'THB'), isNull(transactions.deletedAt))),
    [date],
  );
  const { data: monthly } = useLiveQuery(
    db.select({ total: sumAmount }).from(transactions).where(and(like(transactions.date, `${month}%`), eq(transactions.type, 'expense'), eq(transactions.currency, 'THB'), isNull(transactions.deletedAt))),
    [month],
  );
  return { today: today[0]?.total ?? 0, month: monthly[0]?.total ?? 0 };
}

export function useMonthSummary(month: string) {
  const { data } = useLiveQuery(
    db
      .select({ type: transactions.type, total: sumAmount })
      .from(transactions)
      .where(and(like(transactions.date, `${month}%`), eq(transactions.currency, 'THB'), isNull(transactions.deletedAt)))
      .groupBy(transactions.type),
    [month],
  );
  const find = (t: 'income' | 'expense') => data.find((r) => r.type === t)?.total ?? 0;
  return { income: find('income'), expense: find('expense') };
}
