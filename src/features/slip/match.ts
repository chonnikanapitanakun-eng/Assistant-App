import type { SlipParty, SlipResult } from './types';

/**
 * Rule + history matching for a read slip — no AI call.
 * wallet: the party whose bank + account digits match one of the user's accounts is "us".
 * category: the category this payee went to most often before.
 */
export type WalletLike = { id: string; bankCode: string | null; accountDigits: string | null; currency: string };
export type PayeeHistory = { payee: string | null; categoryId: string | null; type: string; createdAt: number };

export type SlipSuggestion = {
  type: 'expense' | 'income' | 'transfer';
  walletId: string | null;
  toWalletId: string | null;
  categoryId: string | null;
  payee: string | null;
  note: string | null;
};

const digitsMatch = (a: string, b: string) => a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a));

/** 3 = bank + account digits, 2 = account digits only, 1 = bank only (and it is the user's only account there). */
export function walletScore(party: SlipParty, wallet: WalletLike, wallets: WalletLike[]): number {
  if (wallet.currency !== 'THB') return 0;
  if (party.bankCode && wallet.bankCode && party.bankCode !== wallet.bankCode) return 0;
  const digits = !!party.accountDigits && !!wallet.accountDigits && digitsMatch(party.accountDigits, wallet.accountDigits);
  if (party.accountDigits && wallet.accountDigits && !digits) return 0;
  const bank = !!party.bankCode && party.bankCode === wallet.bankCode;
  if (bank && digits) return 3;
  if (digits) return 2;
  if (bank && wallets.filter((w) => w.currency === 'THB' && w.bankCode === party.bankCode).length === 1) return 1;
  return 0;
}

function bestWallet(party: SlipParty, wallets: WalletLike[]): { id: string | null; score: number } {
  let best = { id: null as string | null, score: 0 };
  for (const w of wallets) {
    const score = walletScore(party, w, wallets);
    if (score > best.score) best = { id: w.id, score };
  }
  return best;
}

const TITLES = /^(นาย|นางสาว|นาง|น\.ส\.|ด\.ช\.|ด\.ญ\.|mr|mrs|ms|miss)\.?\s*/i;
const COMPANY = /บริษัท|บจก\.?|หจก\.?|จำกัด|\(?มหาชน\)?|\b(co|ltd|limited|company|plc)\b\.?/gi;

/** "นาย สมชาย ใจดี" / "สมชาย ใจ" → comparable keys; company words, titles and punctuation go. */
export function payeeKey(name: string | null | undefined): string {
  if (!name) return '';
  return name.trim().replace(TITLES, '').replace(COMPANY, '').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, '');
}

/** Slips truncate names differently per bank ("สมชาย ใจ" vs "สมชาย ใจดี"), so a prefix of 4+ chars counts. */
const samePayee = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)));

export function categoryFromHistory(payee: string | null | undefined, type: string, history: PayeeHistory[]): string | null {
  const key = payeeKey(payee);
  if (!key) return null;
  const tally = new Map<string, { count: number; last: number }>();
  for (const h of history) {
    if (!h.categoryId || h.type !== type) continue;
    const other = payeeKey(h.payee);
    if (!other || !samePayee(key, other)) continue;
    const t = tally.get(h.categoryId) ?? { count: 0, last: 0 };
    tally.set(h.categoryId, { count: t.count + 1, last: Math.max(t.last, h.createdAt) });
  }
  let best: string | null = null;
  let top = { count: 0, last: 0 };
  for (const [id, t] of tally) {
    if (t.count > top.count || (t.count === top.count && t.last > top.last)) {
      best = id;
      top = t;
    }
  }
  return best;
}

/** Decide direction, wallet(s) and category for one slip. Unknown wallet → null (the form falls back to the first account). */
export function suggestFromSlip(slip: SlipResult, wallets: WalletLike[], history: PayeeHistory[]): SlipSuggestion {
  const from = bestWallet(slip.from, wallets);
  const to = bestWallet(slip.to, wallets);

  if (from.id && to.id && from.id !== to.id) {
    return { type: 'transfer', walletId: from.id, toWalletId: to.id, categoryId: null, payee: slip.to.name ?? null, note: slip.memo ?? null };
  }
  const income = to.score > from.score;
  const type = income ? 'income' : 'expense';
  const payee = (income ? slip.from.name : slip.to.name) ?? null;
  return {
    type,
    walletId: income ? to.id : from.id,
    toWalletId: null,
    categoryId: categoryFromHistory(payee, type, history),
    payee,
    note: slip.memo ?? payee,
  };
}
