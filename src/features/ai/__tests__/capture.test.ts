import { describe, expect, it } from 'vitest';

import { parseCaptureLocally } from '../capture';

const today = new Date(2026, 8, 24);

describe('parseCaptureLocally', () => {
  it('parses Thai expense', () => {
    expect(parseCaptureLocally('ข้าวเที่ยง 80', today)).toEqual([{ type: 'expense', amount: 80, currency: 'THB', note: 'ข้าวเที่ยง' }]);
  });
  it('parses GBP income', () => {
    expect(parseCaptureLocally('£5,000 audit fee', today)).toEqual([{ type: 'income', amount: 5000, currency: 'GBP', note: 'audit fee' }]);
  });
  it('parses tomorrow task with time', () => {
    expect(parseCaptureLocally('พรุ่งนี้ 10 โมง ประชุมลูกค้า', today)).toEqual([
      { type: 'task', title: 'ประชุมลูกค้า', date: '2026-09-25', startTime: '10:00' },
    ]);
  });
  it('parses english task with pm', () => {
    expect(parseCaptureLocally('tomorrow 2pm call John', today)).toEqual([
      { type: 'task', title: 'call John', date: '2026-09-25', startTime: '14:00' },
    ]);
  });
  it('falls back to note', () => {
    expect(parseCaptureLocally('ไอเดีย: ทำ LINE bot', today)).toEqual([{ type: 'note', body: 'ไอเดีย: ทำ LINE bot' }]);
  });
  it('returns empty for blank', () => {
    expect(parseCaptureLocally('   ', today)).toEqual([]);
  });
});
