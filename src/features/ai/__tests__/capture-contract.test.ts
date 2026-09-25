import { describe, expect, it } from 'vitest';

import { CAPTURE_SCHEMA, normalizeCaptureResponse } from '../../../../supabase/functions/_shared/capture-contract';

const row = (over: Record<string, unknown>) => ({
  type: 'note', title: '', body: null, date: null, startTime: null, endTime: null, amount: null, currency: null, note: null, categoryHint: null, contactName: null, ...over,
});

describe('ai-capture contract', () => {
  it('schema is strict: every property is required and no extras allowed', () => {
    const item = CAPTURE_SCHEMA.properties.items.items;
    expect(item.required).toEqual(Object.keys(item.properties));
    expect(item.additionalProperties).toBe(false);
    expect(CAPTURE_SCHEMA.required).toEqual(['items', 'confidence']);
  });

  it('strips nulls and adds a contact for a named person', () => {
    const out = normalizeCaptureResponse({
      items: [
        row({ type: 'event', title: 'Meeting with John about VAT', date: '2026-09-25', startTime: '10:00', contactName: 'John' }),
        row({ type: 'expense', title: 'VAT', amount: 5000, currency: 'GBP', note: 'VAT', date: '2026-09-25', contactName: 'John' }),
      ],
      confidence: 0.92,
    });
    expect(out).toEqual({
      items: [
        { type: 'event', title: 'Meeting with John about VAT', date: '2026-09-25', startTime: '10:00', contactName: 'John' },
        { type: 'expense', amount: 5000, currency: 'GBP', note: 'VAT', date: '2026-09-25', contactName: 'John' },
        { type: 'contact', name: 'John' },
      ],
      confidence: 0.92,
    });
  });

  it('de-duplicates contacts case-insensitively', () => {
    const out = normalizeCaptureResponse({ items: [row({ type: 'contact', title: 'คุณสมชาย' }), row({ type: 'task', title: 'ส่งงบ', contactName: 'คุณสมชาย' })], confidence: 1 });
    expect(out.items.filter((i) => i.type === 'contact')).toHaveLength(1);
    expect(out.items[0]).toEqual({ type: 'task', title: 'ส่งงบ', contactName: 'คุณสมชาย' });
  });

  it('turns an event without a date into a task and drops invalid money', () => {
    const out = normalizeCaptureResponse({
      items: [row({ type: 'event', title: 'call Sarah', startTime: '14:00' }), row({ type: 'expense', title: 'x', amount: -5, currency: 'THB' }), row({ type: 'income', amount: 'abc' })],
      confidence: 0.7,
    });
    expect(out.items).toEqual([{ type: 'task', title: 'call Sarah', startTime: '14:00' }]);
  });

  it('falls back to the default currency and rounds amounts', () => {
    const out = normalizeCaptureResponse({ items: [row({ type: 'expense', title: 'ข้าวเที่ยง', amount: 120.005, currency: 'XXX' })], confidence: 0.9 }, { defaultCurrency: 'THB' });
    expect(out.items).toEqual([{ type: 'expense', amount: 120.01, currency: 'THB', note: 'ข้าวเที่ยง' }]);
  });

  it('rejects malformed dates/times and endTime without startTime', () => {
    const out = normalizeCaptureResponse({ items: [row({ type: 'task', title: 'dentist', date: '25/09/2026', startTime: '3pm', endTime: '16:00' })], confidence: 0.5 });
    expect(out.items).toEqual([{ type: 'task', title: 'dentist' }]);
  });

  it('returns an empty response for garbage', () => {
    expect(normalizeCaptureResponse(null)).toEqual({ items: [], confidence: 0 });
    expect(normalizeCaptureResponse({ items: 'nope', confidence: 2 })).toEqual({ items: [], confidence: 0 });
    expect(normalizeCaptureResponse({ items: [row({ type: 'note', body: 'idea' })], confidence: 5 }).confidence).toBe(1);
  });
});
