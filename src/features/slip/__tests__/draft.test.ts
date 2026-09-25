import { describe, expect, it } from 'vitest';

import { applyScan, draftErrors, emptyDraft, hasErrors, toValues } from '../draft';
import type { SlipSuggestion } from '../match';
import type { SlipResult } from '../types';

const slip: SlipResult = { isSlip: true, amount: 350, date: '2026-09-20', ref: 'OCRREF123', from: {}, to: { name: 'ร้านข้าว' } };
const suggestion: SlipSuggestion = { type: 'expense', walletId: 'kbank', toWalletId: null, categoryId: 'food', payee: 'ร้านข้าว', note: 'ร้านข้าว' };
const suggest = () => suggestion;
const d0 = emptyDraft('k', 'file://a.jpg', '2026-09-25');

describe('applyScan', () => {
  it('a read slip is ticked, filled, and prefers the QR ref', () => {
    const d = applyScan(d0, { kind: 'read', slip, qr: { bankCode: '004', ref: 'QRREF123456' } }, suggest, 'cash');
    expect(d).toMatchObject({ status: 'ready', include: true, amount: '350', date: '2026-09-20', walletId: 'kbank', categoryId: 'food', note: 'ร้านข้าว', slipRef: 'QRREF123456' });
    expect(hasErrors(draftErrors(d))).toBe(false);
    expect(toValues(d)).toEqual({ type: 'expense', amount: 350, walletId: 'kbank', toWalletId: null, categoryId: 'food', date: '2026-09-20', note: 'ร้านข้าว', payee: 'ร้านข้าว', slipRef: 'QRREF123456' });
  });

  it('no matched wallet falls back to the default account', () => {
    const d = applyScan(d0, { kind: 'read', slip, qr: null }, () => ({ ...suggestion, walletId: null }), 'cash');
    expect(d).toMatchObject({ walletId: 'cash', slipRef: 'OCRREF123' });
  });

  it('duplicates are kept but not ticked', () => {
    expect(applyScan(d0, { kind: 'duplicate', ref: 'QRREF123456', qr: null }, suggest, 'cash')).toMatchObject({ status: 'duplicate', include: false, slipRef: 'QRREF123456', amount: '' });
    expect(applyScan(d0, { kind: 'duplicate', ref: 'OCRREF123', qr: null, slip }, suggest, 'cash')).toMatchObject({ status: 'duplicate', include: false, amount: '350' });
  });

  it('unread images stay unticked for the user to fill or skip', () => {
    expect(applyScan(d0, { kind: 'offline', qr: { bankCode: '004', ref: 'QRREF123456' } }, suggest, 'cash')).toMatchObject({ status: 'offline', include: false, slipRef: 'QRREF123456', walletId: 'cash' });
    expect(applyScan(d0, { kind: 'not_slip' }, suggest, null).status).toBe('not_slip');
  });
});

describe('draftErrors', () => {
  it('flags missing amount, wallet, date and a transfer without a second account', () => {
    expect(draftErrors({ ...d0, amount: '', date: '20/09' })).toEqual({ amount: true, wallet: true, to: false, date: true });
    expect(draftErrors({ ...d0, amount: '10', walletId: 'a', type: 'transfer', toWalletId: 'a' }).to).toBe(true);
  });

  it('a transfer saves without a category', () => {
    const v = toValues({ ...d0, amount: '1,000', walletId: 'a', type: 'transfer', toWalletId: 'b', categoryId: 'food' });
    expect(v).toMatchObject({ amount: 1000, toWalletId: 'b', categoryId: null });
  });
});
