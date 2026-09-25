import type { Category, Transaction, Wallet } from '@/db';

export type CsvLabels = {
  date: string;
  type: string;
  amount: string;
  currency: string;
  category: string;
  account: string;
  note: string;
  income: string;
  expense: string;
  transfer: string;
  uncategorised: string;
};

function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

const csvRow = (fields: string[]) => fields.map(csvField).join(',');

/**
 * CSV of the given transactions, in the order given. UTF-8 BOM so Excel reads Thai text
 * correctly, CRLF rows per RFC 4180.
 */
export function transactionsToCsv(txs: Transaction[], catById: Map<string, Category>, walletById: Map<string, Wallet>, categoryName: (c: Category) => string, labels: CsvLabels): string {
  const header = csvRow([labels.date, labels.type, labels.amount, labels.currency, labels.category, labels.account, labels.note]);
  const rows = txs.map((x) => {
    const category = x.categoryId && catById.get(x.categoryId);
    const account =
      x.type === 'transfer' ? `${walletById.get(x.walletId)?.name ?? ''} → ${walletById.get(x.toWalletId ?? '')?.name ?? ''}` : walletById.get(x.walletId)?.name ?? '';
    return csvRow([x.date, labels[x.type], x.amount.toFixed(2), x.currency, category ? categoryName(category) : x.type === 'transfer' ? '' : labels.uncategorised, account, x.note ?? '']);
  });
  return `﻿${[header, ...rows].join('\r\n')}`;
}
