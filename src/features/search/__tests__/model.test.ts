import { describe, expect, it } from 'vitest';

import { bucketHits, highlight, orderByIds, planSearch, snippet } from '../model';

describe('planSearch', () => {
  it('returns null for blank input', () => {
    expect(planSearch('')).toBeNull();
    expect(planSearch('   ')).toBeNull();
  });

  it('quotes long terms for MATCH and lower-cases them', () => {
    expect(planSearch('Meeting ABC')).toEqual({ match: '"meeting" "abc"', likes: [], terms: ['meeting', 'abc'] });
  });

  it('treats Thai without spaces as one trigram term', () => {
    expect(planSearch('ประชุมลูกค้า')?.match).toBe('"ประชุมลูกค้า"');
  });

  it('sends terms under 3 characters to LIKE and escapes wildcards', () => {
    expect(planSearch('ab')).toEqual({ match: null, likes: ['%ab%'], terms: ['ab'] });
    expect(planSearch('5% tax')).toEqual({ match: '"tax"', likes: ['%5\\%%'], terms: ['5%', 'tax'] });
  });

  it('escapes double quotes and dedupes terms', () => {
    expect(planSearch('say "hi" SAY say')?.match).toBe('"say" """hi"""');
  });
});

describe('bucketHits', () => {
  it('groups by type in rank order, drops duplicates and unknown types', () => {
    const b = bucketHits([
      { type: 'note', id: 'n2' },
      { type: 'task', id: 't1' },
      { type: 'note', id: 'n1' },
      { type: 'note', id: 'n2' },
      { type: 'area', id: 'a1' },
    ]);
    expect(b.note).toEqual(['n2', 'n1']);
    expect(b.task).toEqual(['t1']);
    expect(b.contact).toEqual([]);
  });
});

describe('orderByIds', () => {
  it('follows id order and drops missing rows', () => {
    expect(orderByIds([{ id: 'a' }, { id: 'b' }], ['b', 'x', 'a']).map((r) => r.id)).toEqual(['b', 'a']);
  });
});

describe('snippet', () => {
  it('returns short text whole, collapsing whitespace', () => {
    expect(snippet('hello\n\n  world', ['world'])).toBe('hello world');
  });

  it('centres on a match deep in the text', () => {
    const text = `${'x'.repeat(200)} target ${'y'.repeat(200)}`;
    const s = snippet(text, ['target'], 10);
    expect(s.startsWith('…')).toBe(true);
    expect(s.endsWith('…')).toBe(true);
    expect(s).toContain('target');
  });

  it('truncates from the start when nothing matches', () => {
    expect(snippet('a'.repeat(100), ['zzz'], 10)).toBe(`${'a'.repeat(20)}…`);
  });
});

describe('highlight', () => {
  it('marks every case-insensitive occurrence', () => {
    expect(highlight('Tax and TAX', ['tax'])).toEqual([
      { text: 'Tax', match: true },
      { text: ' and ', match: false },
      { text: 'TAX', match: true },
    ]);
  });

  it('merges overlapping terms', () => {
    expect(highlight('ประชุมลูกค้า', ['ประชุม', 'ลูกค้า'])).toEqual([{ text: 'ประชุมลูกค้า', match: true }]);
  });
});
