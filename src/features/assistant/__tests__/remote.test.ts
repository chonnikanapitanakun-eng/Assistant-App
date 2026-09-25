import { describe, expect, it, vi } from 'vitest';

import { localIsoString, sanitizeProposals, windowHistory } from '../remote';

// '../remote' pulls in @/features/auth (Supabase session + Google sign-in), which imports
// react-native directly; Vite/Rollup can't parse its Flow syntax outside of Metro (see
// vitest.setup.ts). getSession isn't exercised by these pure-function tests, so a stub is enough.
// vi.mock calls are hoisted above imports by vitest's transform, so this still runs first.
vi.mock('@/features/auth', () => ({ getSession: vi.fn().mockResolvedValue(null) }));

type Turn = { role: 'user' | 'assistant'; text: string };

/** u0, a0, u1, a1, … ending with the new user message (always odd length). */
const chat = (exchanges: number): Turn[] => [
  ...Array.from({ length: exchanges }, (_, i): Turn[] => [
    { role: 'user', text: `u${i}` },
    { role: 'assistant', text: `a${i}` },
  ]).flat(),
  { role: 'user', text: 'new' },
];

describe('windowHistory', () => {
  it('keeps short conversations whole', () => {
    expect(windowHistory(chat(2))).toEqual(chat(2));
  });

  it('always starts with a user turn and ends with the new message, however long the chat', () => {
    for (let n = 0; n < 20; n++) {
      const w = windowHistory(chat(n));
      expect(w[0].role).toBe('user');
      expect(w[w.length - 1]).toEqual({ role: 'user', text: 'new' });
      expect(w.length).toBeLessThanOrEqual(13);
    }
  });

  it('drops a leading assistant turn when the window would start with one', () => {
    // Even window size lands on an assistant turn after 6+ exchanges.
    const w = windowHistory(chat(8), 12);
    expect(w[0]).toEqual({ role: 'user', text: 'u3' });
    expect(w).toHaveLength(11);
  });

  it('drops empty turns (the Edge Function drops them too) before windowing', () => {
    const w = windowHistory([{ role: 'user', text: 'hi' }, { role: 'assistant', text: '  ' }, { role: 'user', text: 'again' }]);
    expect(w).toEqual([{ role: 'user', text: 'hi' }, { role: 'user', text: 'again' }]);
  });
});

describe('localIsoString', () => {
  it('uses the local wall-clock date and time with the offset', () => {
    const d = new Date(2026, 8, 25, 6, 30, 5);
    const s = localIsoString(d);
    expect(s.startsWith('2026-09-25T06:30:05')).toBe(true);
    expect(s).toMatch(/[+-]\d{2}:\d{2}$/);
    expect(new Date(s).getTime()).toBe(d.getTime());
  });
});

describe('sanitizeProposals', () => {
  it('drops invalid create items and malformed proposals', () => {
    const out = sanitizeProposals([
      { kind: 'create', items: [{ type: 'task', title: 'Call bank' }, { type: 'expense', amount: -1, currency: 'THB' }, { type: 'event', title: 'x', date: 'tomorrow' }] },
      { kind: 'create', items: [{ type: 'note' }] },
      { kind: 'complete_task', title: 'no id' },
      { kind: 'pay_bill', billId: 'b1', name: 'Rent', amount: 100, currency: 'THB' },
      { kind: 'delete_everything' },
      null,
    ]);
    expect(out).toEqual([
      { kind: 'create', items: [{ type: 'task', title: 'Call bank' }] },
      { kind: 'pay_bill', billId: 'b1', name: 'Rent', amount: 100, currency: 'THB' },
    ]);
  });

  it('returns [] for a non-array', () => {
    expect(sanitizeProposals(undefined)).toEqual([]);
  });
});
