import { describe, expect, it } from 'vitest';

import { billRemindAt, billState, budgetStatus, currenciesInUse, groupByDate, monthTotals, netWorth, nextDueDate, spendingByCategory, toPrimary, walletBalance } from '../model';

const tx = (o: Partial<{ walletId: string; toWalletId: string | null; amount: number; currency: string; type: 'income' | 'expense' | 'transfer'; date: string; categoryId: string | null }>) => ({
  walletId: 'w1', toWalletId: null, amount: 0, currency: 'THB', type: 'expense' as const, date: '2026-09-10', categoryId: null, ...o,
});

const txs = [
  tx({ type: 'income', amount: 45000, categoryId: 'fees' }),
  tx({ amount: 120, categoryId: 'food' }),
  tx({ amount: 80, categoryId: 'food' }),
  tx({ amount: 300, categoryId: 'transport' }),
  tx({ type: 'transfer', amount: 1000, toWalletId: 'w2' }),
  tx({ amount: 50, currency: 'GBP', walletId: 'uk' }),
  tx({ amount: 999, date: '2026-08-31', categoryId: 'food' }),
];

describe('balances and totals', () => {
  it('adds transactions and transfers to the opening balance', () => {
    expect(walletBalance({ id: 'w1', balance: 1000, currency: 'THB' }, txs)).toBe(1000 + 45000 - 120 - 80 - 300 - 1000 - 999);
    expect(walletBalance({ id: 'w2', balance: 0, currency: 'THB' }, txs)).toBe(1000);
  });
  it('credits only the destination leg of a transfer from a hidden wallet', () => {
    // 'gone' is a hidden (deleted) account: its transfer still lands in w2, and never touches w1.
    const fromHidden = [tx({ walletId: 'gone', type: 'transfer', amount: 500, toWalletId: 'w2' })];
    expect(walletBalance({ id: 'w2', balance: 100, currency: 'THB' }, fromHidden)).toBe(600);
    expect(walletBalance({ id: 'w1', balance: 100, currency: 'THB' }, fromHidden)).toBe(100);
    expect(walletBalance({ id: 'gone', balance: 1000, currency: 'THB' }, fromHidden)).toBe(500);
  });
  it('ignores transactions in a different currency than the wallet', () => {
    expect(walletBalance({ id: 'w1', balance: 0, currency: 'THB' }, [tx({ amount: 100, currency: 'EUR' })])).toBe(0);
  });
  it('totals one month in one currency, ignoring transfers', () => {
    expect(monthTotals(txs, '2026-09', 'THB')).toEqual({ income: 45000, expense: 500, net: 44500 });
    expect(monthTotals(txs, '2026-09', 'GBP')).toEqual({ income: 0, expense: 50, net: -50 });
  });
  it('ranks spending by category', () => {
    expect(spendingByCategory(txs, '2026-09', 'THB')).toEqual([
      { categoryId: 'transport', total: 300 },
      { categoryId: 'food', total: 200 },
    ]);
  });
  it('lists currencies with the primary first', () => {
    expect(currenciesInUse([{ currency: 'GBP' }, { currency: 'THB' }, { currency: 'GBP' }], 'THB')).toEqual(['THB', 'GBP']);
    expect(currenciesInUse([{ currency: 'THB' }, { currency: 'GBP' }], 'GBP')).toEqual(['GBP', 'THB']);
  });
});

describe('budgetStatus', () => {
  it('flags near and over', () => {
    expect(budgetStatus(500, 1000).state).toBe('ok');
    expect(budgetStatus(900, 1000).state).toBe('near');
    expect(budgetStatus(1200, 1000)).toMatchObject({ state: 'over', remaining: -200 });
  });
});

describe('bills', () => {
  const today = new Date(2026, 8, 24);
  const bill = (o: object) => ({ dueDay: 24, frequency: 'monthly' as const, dueMonth: null, paidThrough: null, remindDaysBefore: 3, ...o });
  it('uses this month when never paid (even if already past)', () => {
    expect(nextDueDate(bill({}), today)).toBe('2026-09-24');
    expect(nextDueDate(bill({ dueDay: 5 }), today)).toBe('2026-09-05');
  });
  it('moves to the following month once paid', () => {
    expect(nextDueDate(bill({ paidThrough: '2026-09-24' }), today)).toBe('2026-10-24');
    expect(nextDueDate(bill({ dueDay: 31, paidThrough: '2026-08-31' }), today)).toBe('2026-09-30');
    expect(nextDueDate(bill({ paidThrough: '2026-12-24' }), today)).toBe('2027-01-24');
  });
  it('handles yearly bills', () => {
    expect(nextDueDate(bill({ frequency: 'yearly', dueMonth: 3, dueDay: 15 }), today)).toBe('2026-03-15');
    expect(nextDueDate(bill({ frequency: 'yearly', dueMonth: 3, dueDay: 15, paidThrough: '2026-03-15' }), today)).toBe('2027-03-15');
  });
  it('keeps a still-upcoming yearly date after switching from monthly', () => {
    // Paid monthly through September, then switched to yearly in December: due this December.
    expect(nextDueDate(bill({ frequency: 'yearly', dueMonth: 12, dueDay: 24, paidThrough: '2026-09-24' }), today)).toBe('2026-12-24');
    // Due month already covered by paidThrough this year → next year.
    expect(nextDueDate(bill({ frequency: 'yearly', dueMonth: 6, dueDay: 1, paidThrough: '2026-09-24' }), today)).toBe('2027-06-01');
    // Same month, later day than paidThrough → still this year.
    expect(nextDueDate(bill({ frequency: 'yearly', dueMonth: 9, dueDay: 30, paidThrough: '2026-09-24' }), today)).toBe('2026-09-30');
  });
  it('classifies due dates', () => {
    expect(billState('2026-09-20', 3, today)).toEqual({ state: 'overdue', days: -4 });
    expect(billState('2026-09-24', 3, today).state).toBe('today');
    expect(billState('2026-09-26', 3, today).state).toBe('soon');
    expect(billState('2026-10-10', 3, today).state).toBe('later');
  });
});

describe('billRemindAt', () => {
  it('fires N days before the due date at 9am local', () => {
    const at = billRemindAt('2026-09-24', 3);
    const d = new Date(at);
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 9, 21, 9, 0]);
  });
});

describe('net worth', () => {
  const rates = { GBP: 44.5, USD: 36 };
  it('converts to the primary currency using its rate', () => {
    expect(toPrimary(100, 'GBP', 'THB', rates)).toBe(4450);
    expect(toPrimary(100, 'THB', 'THB', rates)).toBe(100);
  });
  it('returns null for a currency with no rate set', () => {
    expect(toPrimary(100, 'EUR', 'THB', rates)).toBeNull();
  });
  it('sums wallets converted to the primary currency, flagging currencies with no rate', () => {
    const wallets = [
      { id: 'w1', balance: 1000, currency: 'THB' },
      { id: 'w2', balance: 100, currency: 'GBP' },
      { id: 'w3', balance: 50, currency: 'EUR' },
    ];
    expect(netWorth(wallets, [], 'THB', rates)).toEqual({ total: 1000 + 4450, missing: ['EUR'] });
  });
});

describe('groupByDate', () => {
  it('groups newest first', () => {
    expect(groupByDate([{ date: '2026-09-01' }, { date: '2026-09-03' }, { date: '2026-09-01' }]).map((g) => [g.date, g.rows.length])).toEqual([
      ['2026-09-03', 1],
      ['2026-09-01', 2],
    ]);
  });
});
