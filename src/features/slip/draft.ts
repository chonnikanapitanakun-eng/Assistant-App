import type { SlipTransactionValues } from '@/features/money/queries';
import { isValidDate } from '@/features/tasks/model';
import { parseAmount } from '@/lib/currency';

import type { SlipSuggestion } from './match';
import type { ScanOutcome } from './scan';

export type SlipStatus = 'scanning' | 'ready' | 'duplicate' | 'not_slip' | 'offline' | 'error';

/** One picked image on the review screen: what was read, plus the user's edits. */
export type SlipDraft = {
  key: string;
  uri: string;
  width?: number;
  status: SlipStatus;
  include: boolean;
  type: SlipSuggestion['type'];
  amount: string;
  walletId: string | null;
  toWalletId: string | null;
  categoryId: string | null;
  suggestedCategoryId: string | null; // fixed at scan time — the card lists it first
  date: string;
  note: string;
  payee: string | null;
  slipRef: string | null;
};

export const emptyDraft = (key: string, uri: string, today: string, width?: number): SlipDraft => ({
  key, uri, width, status: 'scanning', include: false, type: 'expense', amount: '', walletId: null, toWalletId: null, categoryId: null, suggestedCategoryId: null, date: today, note: '', payee: null, slipRef: null,
});

/**
 * Fold a scan result into its draft. Read slips are ticked for saving; duplicates keep what was read
 * but stay unticked; anything unread is left for the user to fill (or skip).
 */
export function applyScan(d: SlipDraft, outcome: ScanOutcome, suggest: (o: Extract<ScanOutcome, { kind: 'read' }>['slip']) => SlipSuggestion, fallbackWalletId: string | null): SlipDraft {
  const base = { ...d, walletId: d.walletId ?? fallbackWalletId };
  switch (outcome.kind) {
    case 'read':
    case 'duplicate': {
      const slip = outcome.slip;
      const ref = outcome.kind === 'duplicate' ? outcome.ref : (outcome.qr?.ref ?? outcome.slip.ref ?? null);
      if (!slip) return { ...base, status: 'duplicate', slipRef: ref }; // caught by its QR before any paid read
      const s = suggest(slip);
      return {
        ...base,
        status: outcome.kind === 'read' ? 'ready' : 'duplicate',
        include: outcome.kind === 'read',
        type: s.type,
        amount: slip.amount !== undefined ? String(slip.amount) : '',
        walletId: s.walletId ?? base.walletId,
        toWalletId: s.toWalletId,
        categoryId: s.categoryId,
        suggestedCategoryId: s.categoryId,
        date: slip.date ?? d.date,
        note: s.note ?? '',
        payee: s.payee,
        slipRef: ref,
      };
    }
    case 'offline':
      return { ...base, status: 'offline', slipRef: outcome.qr?.ref ?? null };
    case 'not_slip':
      return { ...base, status: 'not_slip' };
    case 'error':
      return { ...base, status: 'error' };
  }
}

export type DraftErrors = { amount: boolean; wallet: boolean; to: boolean; date: boolean };

export function draftErrors(d: SlipDraft): DraftErrors {
  const amount = parseAmount(d.amount);
  return {
    amount: amount === null || amount <= 0,
    wallet: !d.walletId,
    to: d.type === 'transfer' && (!d.toWalletId || d.toWalletId === d.walletId),
    date: !isValidDate(d.date),
  };
}

export const hasErrors = (e: DraftErrors) => Object.values(e).some(Boolean);

export function toValues(d: SlipDraft): SlipTransactionValues {
  return {
    type: d.type,
    amount: parseAmount(d.amount)!,
    walletId: d.walletId!,
    toWalletId: d.type === 'transfer' ? d.toWalletId : null,
    categoryId: d.type === 'transfer' ? null : d.categoryId,
    date: d.date,
    note: d.note.trim() || null,
    payee: d.payee,
    slipRef: d.slipRef,
  };
}
