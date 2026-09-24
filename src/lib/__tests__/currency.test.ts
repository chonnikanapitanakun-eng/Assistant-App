import { describe, expect, it } from 'vitest';

import { formatMoney } from '../currency';

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
