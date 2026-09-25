import { describe, expect, it } from 'vitest';

import { isEmptyPrep, LIMITS, normalizePrepMeeting, PREP_MEETING_SCHEMA } from '../../../../supabase/functions/_shared/prep-meeting-contract';
import { userTurn } from '../../../../supabase/functions/ai-prep-meeting/prompt';

describe('ai-prep-meeting contract', () => {
  it('schema is strict: every property is required and no extras allowed', () => {
    expect(PREP_MEETING_SCHEMA.required).toEqual(Object.keys(PREP_MEETING_SCHEMA.properties));
    expect(PREP_MEETING_SCHEMA.additionalProperties).toBe(false);
  });

  it('trims lines, strips bullets / numbering and drops duplicates', () => {
    const out = normalizePrepMeeting({
      brief: '  Meeting with John.\r\n\r\n\r\nInvoice 240 unpaid.  \n',
      checklist: ['- Bring VAT figures', '1. bring vat figures', '', '• Print invoice 240'],
      agenda: ['1) MTD deadline', '2) Invoice 240'],
    });
    expect(out).toEqual({
      brief: 'Meeting with John.\n\nInvoice 240 unpaid.',
      checklist: ['Bring VAT figures', 'Print invoice 240'],
      agenda: ['MTD deadline', 'Invoice 240'],
    });
  });

  it('caps list lengths and item length', () => {
    const many = Array.from({ length: 30 }, (_, i) => `item ${i}`);
    const out = normalizePrepMeeting({ brief: 'x', checklist: many, agenda: [`${'a'.repeat(500)}`] });
    expect(out.checklist).toHaveLength(LIMITS.checklist);
    expect(out.agenda[0]).toHaveLength(LIMITS.item);
  });

  it('never throws on garbage and reports it as empty', () => {
    expect(isEmptyPrep(normalizePrepMeeting(null))).toBe(true);
    expect(isEmptyPrep(normalizePrepMeeting({ brief: 42, checklist: 'no', agenda: [null] }))).toBe(true);
    expect(isEmptyPrep(normalizePrepMeeting({ brief: '', checklist: ['x'], agenda: [] }))).toBe(false);
  });
});

describe('ai-prep-meeting prompt', () => {
  it('renders only the records given and escapes tags in user text', () => {
    const turn = userTurn(
      {
        locale: 'th',
        event: { title: 'Review <b>VAT</b> "Q3"', date: '2026-09-26', startTime: '10:00', endTime: '11:00', location: 'Zoom' },
        contact: { name: 'John Smith', company: 'ABC Ltd' },
        tasks: [{ title: 'ส่ง VAT return', isDone: false, date: '2026-09-30' }],
        notes: [{ title: 'Call', body: 'invoice 240 unpaid' }],
        transactions: [{ amount: 1200, currency: 'GBP', type: 'income', note: 'Invoice 239', date: '2026-08-30' }],
        pastEvents: [{ title: 'Onboarding', date: '2026-08-12' }],
      },
      '2026-09-25',
      'Friday',
    );
    expect(turn).toContain('<today>2026-09-25 (Friday)</today>');
    expect(turn).toContain('<locale>th</locale>');
    expect(turn).toContain('when="2026-09-26 10:00–11:00"');
    expect(turn).toContain('location="Zoom"');
    expect(turn).toContain('Review ‹b›VAT‹/b› ”Q3”');
    expect(turn).toContain('<contact name="John Smith" company="ABC Ltd">');
    expect(turn).toContain('- [open] 2026-09-30 ส่ง VAT return');
    expect(turn).toContain('- 2026-08-30 income 1200 GBP — Invoice 239');
    expect(turn).toContain('- 2026-08-12: Onboarding');
    expect(turn).not.toContain('<emails>');
  });

  it('marks a missing contact and an all-day event', () => {
    const turn = userTurn({ event: { title: 'Site visit', date: '2026-10-01', isAllDay: true } }, '2026-09-25', 'Friday');
    expect(turn).toContain('<contact none="true" />');
    expect(turn).toContain('when="2026-10-01 all day"');
    expect(turn).toContain('<locale>en</locale>');
  });
});
