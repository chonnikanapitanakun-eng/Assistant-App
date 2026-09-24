import { describe, expect, it } from 'vitest';

import { parseCaptureLocally } from '../capture';

// Thursday
const today = new Date(2026, 8, 24);

describe('parseCaptureLocally', () => {
  it('parses Thai expense without mistaking เที่ยง for a time', () => {
    expect(parseCaptureLocally('ข้าวเที่ยง 80', today)).toEqual([{ type: 'expense', amount: 80, currency: 'THB', note: 'ข้าวเที่ยง' }]);
  });
  it('parses GBP income', () => {
    expect(parseCaptureLocally('£5,000 audit fee', today)).toEqual([{ type: 'income', amount: 5000, currency: 'GBP', note: 'audit fee' }]);
  });
  it('parses a Thai meeting as a calendar event', () => {
    expect(parseCaptureLocally('พรุ่งนี้ 10 โมง ประชุมลูกค้า', today)).toEqual([
      { type: 'event', title: 'ประชุมลูกค้า', date: '2026-09-25', startTime: '10:00' },
    ]);
  });
  it('parses an English call with a contact', () => {
    expect(parseCaptureLocally('tomorrow 2pm call John', today)).toEqual([
      { type: 'event', title: 'call John', date: '2026-09-25', startTime: '14:00', contactName: 'John' },
      { type: 'contact', name: 'John' },
    ]);
  });
  it('splits one sentence into event + money + contact', () => {
    expect(parseCaptureLocally('Meeting with John tomorrow at 10 about VAT £5,000', today)).toEqual([
      { type: 'event', title: 'Meeting with John about VAT', date: '2026-09-25', startTime: '10:00', contactName: 'John' },
      { type: 'expense', amount: 5000, currency: 'GBP', note: 'Meeting with John about VAT', date: '2026-09-25', contactName: 'John' },
      { type: 'contact', name: 'John' },
    ]);
  });
  it('treats a timed item without meeting words as a task', () => {
    expect(parseCaptureLocally('Fri 9am submit VAT return', today)).toEqual([
      { type: 'task', title: 'submit VAT return', date: '2026-09-25', startTime: '09:00' },
    ]);
  });
  it('does not read the hour as money when a time is present', () => {
    expect(parseCaptureLocally('today at 3 dentist', today)).toEqual([{ type: 'task', title: 'dentist', date: '2026-09-24', startTime: '15:00' }]);
  });
  it('parses Thai afternoon time and contact', () => {
    expect(parseCaptureLocally('ศุกร์ บ่าย 2 นัดคุณสมชาย ปิดงบ', today)).toEqual([
      { type: 'event', title: 'นัดคุณสมชาย ปิดงบ', date: '2026-09-25', startTime: '14:00', contactName: 'คุณสมชาย' },
      { type: 'contact', name: 'คุณสมชาย' },
    ]);
  });
  it('parses EUR and k shorthand', () => {
    expect(parseCaptureLocally('hotel €1.2k', today)).toEqual([{ type: 'expense', amount: 1200, currency: 'EUR', note: 'hotel' }]);
  });
  it('does not read codes like Q3 or FY2026 as money', () => {
    expect(parseCaptureLocally('VAT return Q3 — confirm figures', today)).toEqual([{ type: 'note', body: 'VAT return Q3 — confirm figures' }]);
    expect(parseCaptureLocally('Engagement letter for FY2026', today)).toEqual([{ type: 'note', body: 'Engagement letter for FY2026' }]);
  });
  it('finds a contact after a capitalised verb', () => {
    expect(parseCaptureLocally('Call John Fri 2pm', today)).toContainEqual({ type: 'contact', name: 'John' });
  });
  it('strict money ignores bare numbers', () => {
    expect(parseCaptureLocally('Day 1: Asakusa', today, { strictMoney: true })).toEqual([{ type: 'note', body: 'Day 1: Asakusa' }]);
    expect(parseCaptureLocally('taxi 350 baht', today, { strictMoney: true })).toEqual([{ type: 'expense', amount: 350, currency: 'THB', note: 'taxi' }]);
  });
  it('falls back to note', () => {
    expect(parseCaptureLocally('ไอเดีย: ทำ LINE bot', today)).toEqual([{ type: 'note', body: 'ไอเดีย: ทำ LINE bot' }]);
  });
  it('returns empty for blank', () => {
    expect(parseCaptureLocally('   ', today)).toEqual([]);
  });
});
