import { describe as suite, expect, it } from 'vitest';

import { describe, likeContains, otherEnd, relationKey, routeFor, sortRelated, defaultRelation } from '../model';

const self = { type: 'task', id: 't1' } as const;

suite('otherEnd', () => {
  it('reads a link from either end', () => {
    const link = { fromType: 'task', fromId: 't1', toType: 'contact', toId: 'c1' } as const;
    expect(otherEnd(link, self)).toEqual({ ref: { type: 'contact', id: 'c1' }, direction: 'out' });
    expect(otherEnd(link, { type: 'contact', id: 'c1' })).toEqual({ ref: { type: 'task', id: 't1' }, direction: 'in' });
  });
  it('returns null when self is not on the link', () => {
    expect(otherEnd({ fromType: 'note', fromId: 'n1', toType: 'event', toId: 'e1' }, self)).toBeNull();
  });
});

suite('relationKey', () => {
  it('flips wording by direction and falls back to related', () => {
    expect(relationKey('with', 'out')).toBe('rel_with');
    expect(relationKey('with', 'in')).toBe('rel_with_in');
    expect(relationKey('extracted', 'in')).toBe('rel_extracted_in');
    expect(relationKey(null, 'out')).toBe('rel_related');
    expect(relationKey('anything-else', 'in')).toBe('rel_related');
  });
  it('links people as "with" and everything else as "related"', () => {
    expect(defaultRelation('contact')).toBe('with');
    expect(defaultRelation('note')).toBe('related');
  });
});

suite('routeFor', () => {
  it('maps record types to detail routes', () => {
    expect(routeFor({ type: 'transaction', id: 'x' })).toEqual({ pathname: '/tx/[id]', params: { id: 'x' } });
    expect(routeFor({ type: 'contact', id: 'x' })).toBeNull();
  });
});

suite('describe', () => {
  const base = { id: 'x', userId: null, createdAt: 0, updatedAt: 0, deletedAt: null, syncedAt: null };
  it('labels a note by title, else first meaningful line', () => {
    const row = { ...base, title: '', body: '# \n- [ ] Send letter\nmore', tags: ['work'], pinned: false, attachments: null, areaId: null };
    expect(describe({ type: 'note', row }, 'th')).toEqual({ title: 'Send letter', subtitle: '#work' });
  });
  it('strips only markdown prefixes, never leading letters of the text', () => {
    const note = (body: string) => ({ ...base, title: '', body, tags: null, pinned: false, attachments: null, areaId: null });
    expect(describe({ type: 'note', row: note('xylophone lesson') }, 'en').title).toBe('xylophone lesson');
    expect(describe({ type: 'note', row: note('- [x] xray results') }, 'en').title).toBe('xray results');
    expect(describe({ type: 'note', row: note('  * [ ] Call mum') }, 'en').title).toBe('Call mum');
    expect(describe({ type: 'note', row: note('## > Quote') }, 'en').title).toBe('Quote');
    expect(describe({ type: 'note', row: note('[x]ray') }, 'en').title).toBe('[x]ray');
  });
  it('dates an all-day event by its stored UTC day, whatever the timezone', () => {
    const row = { ...base, externalId: 'x', source: 'veyra', accountId: null, calendarName: null, title: 'Holiday', start: Date.UTC(2026, 8, 25), end: Date.UTC(2026, 8, 26), location: null, isAllDay: true, repeat: null, remindBefore: null, reminderNotificationId: null };
    expect(describe({ type: 'event', row }, 'en').subtitle).toBe(new Date(2026, 8, 25).toLocaleString('en-GB', { day: 'numeric', month: 'short' }));
  });
  it('labels money with a signed amount and date', () => {
    const row = { ...base, walletId: 'w', amount: 1500, currency: 'THB', type: 'expense' as const, toWalletId: null, categoryId: null, areaId: null, date: '2026-09-24', note: 'Taxi', slipImage: null, source: 'manual' as const, payee: null, slipRef: null };
    expect(describe({ type: 'transaction', row }, 'en')).toEqual({ title: 'Taxi', subtitle: '−฿1,500 · 2026-09-24' });
  });
  it('uses the Thai or English area name', () => {
    const row = { ...base, nameTh: 'งาน', nameEn: 'Work', parentId: null, color: null, icon: null, sortOrder: 0 };
    expect(describe({ type: 'area', row }, 'th').title).toBe('งาน');
    expect(describe({ type: 'area', row }, 'en-GB').title).toBe('Work');
  });
});

suite('sortRelated', () => {
  it('puts people first, then events, tasks, money, notes', () => {
    const items = [
      { ref: { type: 'note', id: '1' }, title: 'b' },
      { ref: { type: 'contact', id: '2' }, title: 'z' },
      { ref: { type: 'task', id: '3' }, title: 'b' },
      { ref: { type: 'task', id: '4' }, title: 'a' },
    ] as const;
    expect(sortRelated([...items]).map((i) => i.ref.id)).toEqual(['2', '4', '3', '1']);
  });
});

suite('likeContains', () => {
  it('wraps the term in % and escapes LIKE wildcards and the escape character', () => {
    expect(likeContains('taxi')).toBe('%taxi%');
    expect(likeContains('50%_off\\')).toBe('%50\\%\\_off\\\\%');
  });
});
