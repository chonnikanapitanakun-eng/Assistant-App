import { describe, expect, it } from 'vitest';

import { allTags, extractItems, itemSignature, matchesQuery, normalizeTag, recordSignature, summarize } from '../model';

const today = new Date(2026, 8, 24);

describe('summarize', () => {
  it('uses headings as key points and counts the checklist', () => {
    const s = summarize('# Plan\n## Scope\ntext\n## Timeline\n- [x] kick-off\n- [ ] draft');
    expect(s.points).toEqual(['Scope', 'Timeline']);
    expect(s.checklist).toEqual({ done: 1, total: 2 });
    expect(s.readMinutes).toBe(1);
  });
  it('falls back to bullets, then sentences', () => {
    expect(summarize('- **one**\n- two').points).toEqual(['one', 'two']);
    expect(summarize('First. Second! Third? Fourth.').points).toEqual(['First.', 'Second!', 'Third?']);
  });
});

describe('extractItems', () => {
  it('turns lines into events, money, contacts and open checklist tasks', () => {
    const body = ['# Client meeting', '- VAT return Q3', 'Day 1: Asakusa', 'Meeting with John tomorrow at 10 about VAT £5,000', '- [ ] Send engagement letter', '- [x] Already done', 'Just a thought'].join('\n');
    const items = extractItems(body, today);
    expect(items.map((i) => i.type)).toEqual(['event', 'expense', 'contact', 'task']);
    expect(items[3]).toEqual({ type: 'task', title: 'Send engagement letter' });
  });
  it('merges duplicate contacts', () => {
    const items = extractItems('call John tomorrow 2pm\nmeet John Fri 9am', today);
    expect(items.filter((i) => i.type === 'contact')).toHaveLength(1);
  });
});

describe('search and tags', () => {
  const notes = [
    { title: 'ประชุมลูกค้า', body: 'VAT', tags: ['work', 'client'] },
    { title: 'Tokyo', body: 'flights', tags: ['travel', 'work'] },
  ];
  it('matches Thai substrings and tags', () => {
    expect(matchesQuery(notes[0], 'ลูกค้า')).toBe(true);
    expect(matchesQuery(notes[1], 'TRAVEL')).toBe(true);
    expect(matchesQuery(notes[1], 'vat')).toBe(false);
  });
  it('orders tags by use', () => {
    expect(allTags(notes)).toEqual(['work', 'client', 'travel']);
  });
  it('normalises tag input', () => {
    expect(normalizeTag('  #Client Work ')).toBe('client-work');
  });
});

describe('itemSignature / recordSignature', () => {
  it('matches an extracted item to the record it was saved as', () => {
    expect(itemSignature({ type: 'task', title: 'Send  letter' })).toBe(recordSignature({ type: 'task', row: { title: 'send letter', date: null } }));
    const start = new Date(2026, 8, 25, 14, 0).getTime();
    expect(itemSignature({ type: 'event', title: 'Call John', date: '2026-09-25', startTime: '14:00' })).toBe(recordSignature({ type: 'event', row: { title: 'Call John', start, isAllDay: false } }));
    expect(itemSignature({ type: 'event', title: 'Holiday', date: '2026-09-25' })).toBe(recordSignature({ type: 'event', row: { title: 'Holiday', start: Date.UTC(2026, 8, 25), isAllDay: true } }));
    expect(itemSignature({ type: 'expense', amount: 120, currency: 'THB', note: 'Taxi' })).toBe(
      recordSignature({ type: 'transaction', row: { type: 'expense', note: 'Taxi', amount: 120, currency: 'THB' } }),
    );
    expect(itemSignature({ type: 'contact', name: 'John' })).toBe(recordSignature({ type: 'contact', row: { name: 'john' } }));
  });
  it('tells different items apart and ignores transfers', () => {
    expect(itemSignature({ type: 'task', title: 'A', date: '2026-09-25' })).not.toBe(itemSignature({ type: 'task', title: 'A', date: '2026-09-26' }));
    expect(itemSignature({ type: 'task', title: 'A' })).not.toBe(itemSignature({ type: 'event', title: 'A', date: '' }));
    expect(recordSignature({ type: 'transaction', row: { type: 'transfer', note: null, amount: 1, currency: 'THB' } })).toBeNull();
  });
  it('keeps signatures stable when an unrelated line changes', () => {
    const before = extractItems('- [ ] Buy milk\n- [ ] Call John tomorrow', today).map(itemSignature);
    const after = extractItems('- [ ] Buy milk\n- [ ] Call John tomorrow\n- [x] done thing', today).map(itemSignature);
    expect(after).toEqual(before);
  });
});
