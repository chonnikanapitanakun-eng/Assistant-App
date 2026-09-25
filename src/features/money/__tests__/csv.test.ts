import { describe, expect, it } from 'vitest';

import type { Category, Transaction, Wallet } from '@/db';

import { transactionsToCsv } from '../csv';

const labels = {
  date: 'Date', type: 'Type', amount: 'Amount', currency: 'Currency', category: 'Category', account: 'Account', note: 'Note',
  income: 'Income', expense: 'Expense', transfer: 'Transfer', uncategorised: 'Uncategorised',
};

const wallet = (o: Partial<Wallet>): Wallet => ({ id: 'w1', name: 'Cash', type: 'cash', currency: 'THB', balance: 0, color: null, sortOrder: 0, bankCode: null, accountDigits: null, userId: null, createdAt: 0, updatedAt: 0, deletedAt: null, syncedAt: null, ...o });
const category = (o: Partial<Category>): Category => ({ id: 'c1', nameTh: 'อาหาร', nameEn: 'Food', type: 'expense', icon: null, budgetMonthly: null, sortOrder: 0, userId: null, createdAt: 0, updatedAt: 0, deletedAt: null, syncedAt: null, ...o });
const tx = (o: Partial<Transaction>): Transaction => ({
  id: 't1', walletId: 'w1', amount: 100, currency: 'THB', type: 'expense', toWalletId: null, categoryId: null, areaId: null, date: '2026-09-10', note: null, slipImage: null, source: 'manual', payee: null, slipRef: null,
  userId: null, createdAt: 0, updatedAt: 0, deletedAt: null, syncedAt: null, ...o,
});

describe('transactionsToCsv', () => {
  it('writes a UTF-8 BOM header row followed by CRLF rows', () => {
    const csv = transactionsToCsv([tx({ amount: 120, categoryId: 'c1', note: 'lunch' })], new Map([['c1', category({})]]), new Map([['w1', wallet({})]]), (c) => c.nameEn, labels);
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('Date,Type,Amount,Currency,Category,Account,Note');
    expect(lines[1]).toBe('2026-09-10,Expense,120.00,THB,Food,Cash,lunch');
  });

  it('falls back to "Uncategorised" and quotes fields containing commas or quotes', () => {
    const csv = transactionsToCsv([tx({ amount: 50, note: 'coffee, "small"' })], new Map(), new Map([['w1', wallet({})]]), (c) => c.nameEn, labels);
    const row = csv.slice(1).split('\r\n')[1];
    expect(row).toBe('2026-09-10,Expense,50.00,THB,Uncategorised,Cash,"coffee, ""small"""');
  });

  it('shows the transfer route as "from → to" and leaves category blank', () => {
    const csv = transactionsToCsv(
      [tx({ type: 'transfer', amount: 500, walletId: 'w1', toWalletId: 'w2', categoryId: null })],
      new Map(),
      new Map([['w1', wallet({ id: 'w1', name: 'Cash' })], ['w2', wallet({ id: 'w2', name: 'Bank' })]]),
      (c) => c.nameEn,
      labels,
    );
    const row = csv.slice(1).split('\r\n')[1];
    expect(row).toBe('2026-09-10,Transfer,500.00,THB,,Cash → Bank,');
  });
});
