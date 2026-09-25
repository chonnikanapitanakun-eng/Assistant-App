import { describe, expect, it } from 'vitest';

import { normalizeSlip } from '../../../../supabase/functions/_shared/slip-contract';
import { suggestFromSlip, type WalletLike } from '../match';
import { parseSlipQr } from '../qr';

/**
 * Shapes of real slips (K PLUS bill payment, TrueMoney P2P, K BIZ transfer) — names, account digits
 * and refs replaced. The raw objects are what slip-ocr's schema asks Claude for, including the
 * mistakes the normaliser has to absorb (a short Buddhist year read as 2069, seconds in the time).
 */
const party = (name: string | null, bank: string | null, account: string | null) => ({ name, bank, account });

const kplusBill = {
  qr: '0041000600000101030040220016268205143CPM999995102TH91041285', // same TLV layout as the real K PLUS QR
  raw: {
    isSlip: true, amount: 3350, fee: 0, date: '2069-09-25', time: '20:51', ref: '016268205143CPM99999',
    from: party('น.ส. สมหญิง ท', '004', 'xxx-x-x1111-x'),
    to: party('ACME PAYMENT SOLUTIONS (THAILAND)', null, null), // biller: Ref 1 / Ref 2 are not an account
    memo: null,
  },
};
const trueMoney = {
  qr: '00490002010102010203P2P03145005800000000304080609202691040786', // same layout as the real TrueMoney QR
  raw: {
    isSlip: true, amount: 5000, fee: null, date: '2026-09-06', time: '15:44:40', ref: '50058000000003',
    from: party('สมศรี ใจ****', '004', '***2222'), // "From Kasikorn Bank ***2222" — the bank account was charged
    to: party('มานี มีนา', 'TMN', '08*-***-6666'),
    memo: null,
  },
};
const kbiz = {
  qr: null, // K BIZ slips have no QR — only the paid read can check for duplicates
  raw: {
    isSlip: true, amount: 5346, fee: 0, date: '2026-09-23', time: '16:36', ref: 'TRBS260923800000000',
    from: party('ACME SERVICES CO.,LTD.', '004', 'xxx-x-x3333-x'),
    to: party('MS. JANE DOE', '004', 'xxx-x-x4444-x'),
    memo: 'บจก แกล็บมอล',
  },
};

const wallets: WalletLike[] = [
  { id: 'kbank-me', bankCode: '004', accountDigits: '0121111567', currency: 'THB' },
  { id: 'kbank-2', bankCode: '004', accountDigits: '2222', currency: 'THB' },
  { id: 'kbank-co', bankCode: '004', accountDigits: '3333', currency: 'THB' },
  { id: 'truemoney', bankCode: 'TMN', accountDigits: '5555', currency: 'THB' },
];

describe('real slip layouts', () => {
  it('K PLUS bill payment: QR ref, Buddhist year fixed, biller as payee', () => {
    expect(parseSlipQr(kplusBill.qr)).toEqual({ bankCode: '004', ref: '016268205143CPM99999' });
    const slip = normalizeSlip(kplusBill.raw);
    expect(slip).toMatchObject({ isSlip: true, amount: 3350, fee: undefined, date: '2026-09-25', time: '20:51' });
    expect(slip.to).toEqual({ name: 'ACME PAYMENT SOLUTIONS (THAILAND)', bankCode: undefined, accountDigits: undefined });
    expect(suggestFromSlip(slip, wallets, [])).toMatchObject({ type: 'expense', walletId: 'kbank-me', payee: 'ACME PAYMENT SOLUTIONS (THAILAND)' });
  });

  it('TrueMoney P2P paid from a linked bank: TrueMoney QR, seconds dropped, the bank account is charged', () => {
    expect(parseSlipQr(trueMoney.qr)).toEqual({ bankCode: 'TMN', ref: '50058000000003' });
    const slip = normalizeSlip(trueMoney.raw);
    expect(slip).toMatchObject({ date: '2026-09-06', time: '15:44', from: { bankCode: '004', accountDigits: '2222' }, to: { bankCode: 'TMN', accountDigits: '6666' } });
    expect(suggestFromSlip(slip, wallets, [])).toMatchObject({ type: 'expense', walletId: 'kbank-2', payee: 'มานี มีนา' });
  });

  it('K BIZ company transfer: English short year, memo becomes the note, payee category from history', () => {
    const slip = normalizeSlip(kbiz.raw);
    expect(slip).toMatchObject({ date: '2026-09-23', ref: 'TRBS260923800000000', memo: 'บจก แกล็บมอล' });
    const history = [{ payee: 'Ms. Jane Doe', categoryId: 'salary', type: 'expense', createdAt: 1 }];
    expect(suggestFromSlip(slip, wallets, history)).toEqual({
      type: 'expense', walletId: 'kbank-co', toWalletId: null, categoryId: 'salary', payee: 'MS. JANE DOE', note: 'บจก แกล็บมอล',
    });
  });
});
