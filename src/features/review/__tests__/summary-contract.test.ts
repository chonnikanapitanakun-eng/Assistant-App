import { describe, expect, it } from 'vitest';

import { boundSummaryRequest, normalizeSummaryResponse, SUMMARY_SCHEMA } from '../../../../supabase/functions/_shared/summary-contract';

describe('ai-summary contract', () => {
  it('schema is strict: every property is required and no extras allowed', () => {
    expect(SUMMARY_SCHEMA.required).toEqual(Object.keys(SUMMARY_SCHEMA.properties));
    expect(SUMMARY_SCHEMA.additionalProperties).toBe(false);
  });

  it('normalises lists, trims, caps at 5 and derives a headline', () => {
    const out = normalizeSummaryResponse({ summary: '  Two meetings today.  Three tasks. ', highlights: ['a', ' ', 'b', 'c', 'd', 'e', 'f'], needs_attention: 'nope', headline: 'Meeting at 10.' });
    expect(out).toEqual({ summary: 'Two meetings today. Three tasks.', highlights: ['a', 'b', 'c', 'd', 'e'], needsAttention: [], headline: 'Meeting at 10' });
    expect(normalizeSummaryResponse({ summary: 'First sentence. Second.', highlights: [], needs_attention: [] })?.headline).toBe('First sentence.');
    expect(normalizeSummaryResponse({ summary: 'x', headline: 'h'.repeat(120), highlights: [], needs_attention: [] })?.headline).toHaveLength(90);
  });

  it('rejects output without a summary', () => {
    expect(normalizeSummaryResponse(null)).toBeNull();
    expect(normalizeSummaryResponse({ headline: 'only' })).toBeNull();
  });

  it('bounds oversized requests', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => ({ title: `t${i}`, date: null, startTime: null, isDone: false, priority: 2 }));
    const out = boundSummaryRequest({ scope: 'day', from: '2026-09-25', to: '2026-09-25', tasks: many(100) });
    expect(out.tasks).toHaveLength(60);
    expect(out.events).toEqual([]);
  });
});
