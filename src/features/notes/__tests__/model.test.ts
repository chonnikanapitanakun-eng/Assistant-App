import { describe, expect, it } from 'vitest';

import { allTags, extractItems, matchesQuery, normalizeTag, summarize } from '../model';

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
