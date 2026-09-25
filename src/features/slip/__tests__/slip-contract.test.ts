import { describe, expect, it } from 'vitest';

import { accountDigits, BANK_CODES, normalizeDate, normalizeSlip, SLIP_SCHEMA } from '../../../../supabase/functions/_shared/slip-contract';
import { BANKS } from '../banks';

const party = (over: Record<string, unknown> = {}) => ({ name: null, bank: null, account: null, ...over });
const raw = (over: Record<string, unknown> = {}) => ({
  isSlip: true, amount: 1250, fee: null, date: '2026-09-25', time: '14:05', ref: '015268140512ABC1234', from: party(), to: party(), memo: null, ...over,
});

describe('slip-ocr contract', () => {
  it('schema is strict: every property is required and no extras allowed', () => {
    expect(SLIP_SCHEMA.required).toEqual(Object.keys(SLIP_SCHEMA.properties));
    expect(SLIP_SCHEMA.additionalProperties).toBe(false);
    const p = SLIP_SCHEMA.properties.from;
    expect(p.required).toEqual(Object.keys(p.properties));
    expect(p.additionalProperties).toBe(false);
  });

  it('app bank list and contract bank codes agree', () => {
    expect([...BANK_CODES].sort()).toEqual(BANKS.map((b) => b.code).sort());
  });

  it('normalises a K PLUS style slip', () => {
    const out = normalizeSlip(raw({
      from: party({ name: 'นาย สมชาย ใจดี', bank: '004', account: 'xxx-x-x1234-x' }),
      to: party({ name: 'บจก. ร้านกาแฟ', bank: '014', account: 'xxx-x-x5678-x' }),
      memo: '  ค่ากาแฟ  ',
    }));
    expect(out).toEqual({
      isSlip: true, amount: 1250, fee: undefined, date: '2026-09-25', time: '14:05', ref: '015268140512ABC1234',
      from: { name: 'นาย สมชาย ใจดี', bankCode: '004', accountDigits: '1234' },
      to: { name: 'บจก. ร้านกาแฟ', bankCode: '014', accountDigits: '5678' },
      memo: 'ค่ากาแฟ',
    });
  });

  it('is not a slip without a positive amount, or when the model says so', () => {
    expect(normalizeSlip(raw({ amount: null })).isSlip).toBe(false);
    expect(normalizeSlip(raw({ amount: -5 })).isSlip).toBe(false);
    expect(normalizeSlip(raw({ isSlip: false })).isSlip).toBe(false);
    expect(normalizeSlip(null)).toMatchObject({ isSlip: false, from: {}, to: {} });
  });

  it('drops bad values instead of guessing', () => {
    const out = normalizeSlip(raw({ amount: '1,250.50', date: '25/09/2026', time: '25:00', ref: '12 3', from: party({ bank: '999', account: 'x-x' }) }));
    expect(out.amount).toBe(1250.5);
    expect(out.date).toBeUndefined();
    expect(out.time).toBeUndefined();
    expect(out.ref).toBeUndefined();
    expect(out.from).toEqual({ name: undefined, bankCode: undefined, accountDigits: undefined });
  });

  it('converts Buddhist-era dates', () => {
    expect(normalizeDate('2569-09-25')).toBe('2026-09-25');
    expect(normalizeDate('2026-13-01')).toBeUndefined();
  });

  it('extracts account digits from masked and plain numbers', () => {
    expect(accountDigits('xxx-x-x1234-x')).toBe('1234');
    expect(accountDigits('XXX-X-XX567-8')).toBe('567');
    expect(accountDigits('123-4-56789-0')).toBe('1234567890');
    expect(accountDigits('xx12')).toBeUndefined();
    expect(accountDigits(null)).toBeUndefined();
  });
});
