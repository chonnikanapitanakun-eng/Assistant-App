import { describe, expect, it } from 'vitest';

import { BREAKDOWN_SCHEMA, normalizeBreakdownResponse } from '../../../../supabase/functions/_shared/breakdown-contract';

describe('ai-breakdown contract', () => {
  it('schema is strict: every property is required and no extras allowed', () => {
    const item = BREAKDOWN_SCHEMA.properties.subtasks.items;
    expect(item.required).toEqual(Object.keys(item.properties));
    expect(item.additionalProperties).toBe(false);
    expect(BREAKDOWN_SCHEMA.required).toEqual(['subtasks']);
  });

  it('cleans whitespace and caps step length', () => {
    const out = normalizeBreakdownResponse({ subtasks: [{ text: '  Draft   the   email  ' }, { text: 'x'.repeat(200) }] });
    expect(out.subtasks[0]).toEqual({ text: 'Draft the email' });
    expect(out.subtasks[1].text).toHaveLength(140);
  });

  it('drops duplicate steps case-insensitively and empty ones', () => {
    const out = normalizeBreakdownResponse({ subtasks: [{ text: 'Send invoice' }, { text: 'send invoice' }, { text: '   ' }, { text: 123 }] });
    expect(out.subtasks).toEqual([{ text: 'Send invoice' }]);
  });

  it('caps at 8 steps', () => {
    const subtasks = Array.from({ length: 12 }, (_, i) => ({ text: `Step ${i}` }));
    expect(normalizeBreakdownResponse({ subtasks }).subtasks).toHaveLength(8);
  });

  it('returns an empty list for garbage', () => {
    expect(normalizeBreakdownResponse(null)).toEqual({ subtasks: [] });
    expect(normalizeBreakdownResponse({ subtasks: 'nope' })).toEqual({ subtasks: [] });
    expect(normalizeBreakdownResponse({})).toEqual({ subtasks: [] });
  });
});
