import { describe, expect, it } from 'vitest';

import { findDate, isLocalComplete, parseSlipText } from '../local-ocr';

describe('parseSlipText', () => {
  it('reads a K PLUS transfer', () => {
    const s = parseSlipText(['โอนเงินสำเร็จ', '25 ก.ย. 69 20:51 น.', 'น.ส. สมหญิง ท', 'เลขที่รายการ:', '016268205143CPM99999', 'จำนวน:', '3,350.00 บาท', 'ค่าธรรมเนียม:', '0.00 บาท']);
    expect(s).toMatchObject({ isSlip: true, amount: 3350, fee: 0, date: '2026-09-25', time: '20:51', ref: '016268205143CPM99999' });
    expect(isLocalComplete(s)).toBe(true);
  });

  it('reads an English slip with seconds and a long month', () => {
    const s = parseSlipText(['Transfer successful', '06 Sep 2026, 15:44:40', 'Amount 5,000.00 THB', 'Transaction ID 50058000000003']);
    expect(s).toMatchObject({ amount: 5000, date: '2026-09-06', time: '15:44', ref: '50058000000003' });
  });

  it('falls back to the largest figure when no label is read', () => {
    expect(parseSlipText(['23/09/2026 16:36', '5,346.00', 'balance? 12.50']).amount).toBe(5346);
  });

  it('is not a slip without an amount', () => {
    expect(parseSlipText(['hello world', '12:00']).isSlip).toBe(false);
  });
});

describe('findDate', () => {
  it('handles BE years and full Thai months', () => {
    expect(findDate('12 ตุลาคม 2569')).toBe('2026-10-12');
    expect(findDate('1 ม.ค. 2570')).toBe('2027-01-01');
  });
  it('rejects impossible dates', () => {
    expect(findDate('31/02/2026')).toBeUndefined();
  });
});
