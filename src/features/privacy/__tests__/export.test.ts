import { describe, expect, it } from 'vitest';

import { buildExport } from '../model';

const profile = { name: 'Proud', language: 'th' as const, currency: 'THB' as const, interests: ['tasks' as const], onboarded: true, fxRates: { GBP: 44 }, briefing: { enabled: true, hour: 7, minute: 30 } };

describe('buildExport', () => {
  it('keeps the user’s rows and drops device-only bookkeeping', () => {
    const doc = buildExport(
      {
        tasks: [{ id: 't1', title: 'VAT return', syncedAt: 1, userId: 'u', reminderNotificationId: 'n1', deletedAt: null }],
        recurring_bills: [],
      },
      profile,
      '0.1.0',
      new Date('2026-09-25T10:00:00Z'),
    );
    expect(doc).toMatchObject({ app: 'Veyra', format: 1, version: '0.1.0', exportedAt: '2026-09-25T10:00:00.000Z' });
    expect(doc.tables.tasks).toEqual([{ id: 't1', title: 'VAT return', deletedAt: null }]);
    expect(doc.tables.recurring_bills).toEqual([]);
  });

  it('exports the profile without the onboarding flag', () => {
    const doc = buildExport({}, profile, '0.1.0');
    expect(doc.profile).toEqual({ name: 'Proud', language: 'th', currency: 'THB', interests: ['tasks'], fxRates: { GBP: 44 } });
    expect('onboarded' in doc.profile).toBe(false);
  });
});
