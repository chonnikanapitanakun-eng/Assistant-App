import { describe, expect, it } from 'vitest';

import { categoryFromHistory, payeeKey, suggestFromSlip, walletScore, type PayeeHistory, type WalletLike } from '../match';
import type { SlipResult } from '../types';

const kbank: WalletLike = { id: 'kbank', bankCode: '004', accountDigits: '0121234567', currency: 'THB' };
const scb: WalletLike = { id: 'scb', bankCode: '014', accountDigits: null, currency: 'THB' };
const scb2: WalletLike = { id: 'scb2', bankCode: '014', accountDigits: '9998887776', currency: 'THB' };
const cash: WalletLike = { id: 'cash', bankCode: null, accountDigits: null, currency: 'THB' };
const gbp: WalletLike = { id: 'gbp', bankCode: '004', accountDigits: '0121234567', currency: 'GBP' };

const slip = (over: Partial<SlipResult> = {}): SlipResult => ({ isSlip: true, amount: 120, from: {}, to: {}, ...over });
const hist = (payee: string, categoryId: string, createdAt = 1, type = 'expense'): PayeeHistory => ({ payee, categoryId, type, createdAt });

describe('walletScore', () => {
  const all = [kbank, scb, cash, gbp];
  it('bank + visible digits is the strongest match', () => {
    expect(walletScore({ bankCode: '004', accountDigits: '1234' }, kbank, all)).toBe(3);
    expect(walletScore({ accountDigits: '1234' }, kbank, all)).toBe(2);
  });
  it('bank alone only counts when it is the only THB account at that bank', () => {
    expect(walletScore({ bankCode: '014' }, scb, all)).toBe(1);
    expect(walletScore({ bankCode: '014' }, scb, [...all, scb2])).toBe(0);
  });
  it('different bank, different digits or foreign currency never match', () => {
    expect(walletScore({ bankCode: '014', accountDigits: '1234' }, kbank, all)).toBe(0);
    expect(walletScore({ bankCode: '004', accountDigits: '5555' }, kbank, all)).toBe(0);
    expect(walletScore({ bankCode: '004', accountDigits: '1234' }, gbp, all)).toBe(0);
    expect(walletScore({}, cash, all)).toBe(0);
  });
});

describe('payee history', () => {
  it('normalises titles, company words and spacing', () => {
    expect(payeeKey('นาย สมชาย ใจดี')).toBe('สมชายใจดี');
    expect(payeeKey('บจก. ร้านกาแฟ จำกัด')).toBe('ร้านกาแฟ');
    expect(payeeKey('Coffee Co., Ltd.')).toBe('coffee');
    expect(payeeKey(null)).toBe('');
  });

  it('picks the most frequent category, latest on a tie, matching truncated names', () => {
    const history = [hist('นาย สมชาย ใจดี', 'food', 1), hist('สมชาย ใจ', 'food', 2), hist('นาย สมชาย ใจดี', 'gift', 3), hist('ร้านอื่น', 'travel', 4)];
    expect(categoryFromHistory('สมชาย ใจดี', 'expense', history)).toBe('food');
    expect(categoryFromHistory('สมชาย ใจดี', 'expense', [hist('สมชาย', 'a', 1), hist('สมชาย', 'b', 2)])).toBe('b');
    expect(categoryFromHistory('สมชาย ใจดี', 'income', history)).toBeNull();
    expect(categoryFromHistory('ใครไม่รู้', 'expense', history)).toBeNull();
  });
});

describe('suggestFromSlip', () => {
  const wallets = [kbank, scb, cash];
  it('payer is ours → expense to the payee, category from history', () => {
    const s = suggestFromSlip(slip({ from: { bankCode: '004', accountDigits: '1234' }, to: { name: 'ร้านกาแฟ' } }), wallets, [hist('ร้านกาแฟ', 'food')]);
    expect(s).toEqual({ type: 'expense', walletId: 'kbank', toWalletId: null, categoryId: 'food', payee: 'ร้านกาแฟ', note: 'ร้านกาแฟ' });
  });

  it('receiver is ours → income from the payer', () => {
    const s = suggestFromSlip(slip({ from: { name: 'Client Ltd', bankCode: '002' }, to: { bankCode: '004', accountDigits: '1234' }, memo: 'Audit fee' }), wallets, []);
    expect(s).toMatchObject({ type: 'income', walletId: 'kbank', payee: 'Client Ltd', note: 'Audit fee' });
  });

  it('both sides ours → transfer', () => {
    const s = suggestFromSlip(slip({ from: { bankCode: '004', accountDigits: '1234' }, to: { bankCode: '014' } }), wallets, []);
    expect(s).toMatchObject({ type: 'transfer', walletId: 'kbank', toWalletId: 'scb', categoryId: null });
  });

  it('nothing matches → expense with no wallet chosen', () => {
    expect(suggestFromSlip(slip({ to: { name: 'X' } }), wallets, [])).toMatchObject({ type: 'expense', walletId: null, payee: 'X' });
  });
});
