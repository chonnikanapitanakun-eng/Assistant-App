import { describe, expect, it } from 'vitest';

import { formatMoney, parseAmount } from '../currency';

describe('formatMoney', () => {
  it('formats THB with symbol', () => {
    expect(formatMoney(1234.5, 'THB', 'en-US')).toBe('฿1,234.5');
  });
  it('formats GBP and negatives', () => {
    expect(formatMoney(-2000, 'GBP', 'en-US')).toBe('-£2,000');
  });
  it('falls back to code for unknown currency', () => {
    expect(formatMoney(10, 'JPY', 'en-US')).toBe('JPY 10');
  });
});

describe('parseAmount', () => {
  it('accepts symbols, commas and decimals', () => {
    expect(parseAmount('1,240.50')).toBe(1240.5);
    expect(parseAmount('฿1240')).toBe(1240);
    expect(parseAmount(' 12 ')).toBe(12);
    expect(parseAmount('-300')).toBe(-300);
  });
  it('rejects empty or malformed input', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('1.2.3')).toBeNull();
  });
});
