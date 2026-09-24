import { and, asc, eq, isNull, like, sql } from 'drizzle-orm';

import { db, transactions, useDbQuery, wallets } from '@/db';

export function useWallets() {
  return useDbQuery(['wallets'], () => db.select().from(wallets).where(isNull(wallets.deletedAt)).orderBy(asc(wallets.sortOrder)).all()) ?? [];
}

const sumAmount = sql<number>`coalesce(sum(${transactions.amount}), 0)`;

/** ยอดใช้จ่ายวันนี้และเดือนนี้ (THB only จนกว่าจะมี FX ใน Phase 2) */
export function useTodayMoney(date: string) {
  const month = date.slice(0, 7);
  const today = useDbQuery(['expense-total', 'day', date], () =>
    db
      .select({ total: sumAmount })
      .from(transactions)
      .where(and(eq(transactions.date, date), eq(transactions.type, 'expense'), eq(transactions.currency, 'THB'), isNull(transactions.deletedAt)))
      .all(),
  );
  const monthly = useDbQuery(['expense-total', 'month', month], () =>
    db
      .select({ total: sumAmount })
      .from(transactions)
      .where(and(like(transactions.date, `${month}%`), eq(transactions.type, 'expense'), eq(transactions.currency, 'THB'), isNull(transactions.deletedAt)))
      .all(),
  );
  return { today: today?.[0]?.total ?? 0, month: monthly?.[0]?.total ?? 0 };
}

export function useMonthSummary(month: string) {
  const data =
    useDbQuery(['month-summary', month], () =>
      db
        .select({ type: transactions.type, total: sumAmount })
        .from(transactions)
        .where(and(like(transactions.date, `${month}%`), eq(transactions.currency, 'THB'), isNull(transactions.deletedAt)))
        .groupBy(transactions.type)
        .all(),
    ) ?? [];
  const find = (t: 'income' | 'expense') => data.find((r) => r.type === t)?.total ?? 0;
  return { income: find('income'), expense: find('expense') };
}
