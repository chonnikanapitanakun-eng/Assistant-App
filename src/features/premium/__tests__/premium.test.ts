import { describe, expect, it } from 'vitest';

import * as server from '../../../../supabase/functions/_shared/entitlement';
import * as app from '../model';

const NOW = Date.parse('2026-09-25T10:00:00Z');
const USER = '6f1c2b8e-3a4d-4e5f-9a0b-1c2d3e4f5a6b';

describe('premium: app mirrors the server', () => {
  it('uses the same entitlement id and default cap', () => {
    expect(app.PRO_ENTITLEMENT).toBe(server.PRO_ENTITLEMENT);
    expect(app.DEFAULT_PRO_MONTHLY_AI_LIMIT).toBe(server.DEFAULT_PRO_MONTHLY_AI_LIMIT);
  });

  it('agrees on isProRow', () => {
    const rows = [
      null,
      { active: false, expires_at: null },
      { active: true, expires_at: null },
      { active: true, expires_at: '2026-10-25T10:00:00Z' },
      { active: true, expires_at: '2026-09-01T00:00:00Z' },
    ];
    for (const r of rows) expect(app.isProRow(r, NOW)).toBe(server.isProRow(r, NOW));
    expect(rows.map((r) => app.isProRow(r, NOW))).toEqual([false, false, true, true, false]);
  });
});

describe('premium: RevenueCat subscriber → entitlements row', () => {
  it('active monthly subscription', () => {
    const row = server.entitlementFromSubscriber(
      USER,
      {
        entitlements: { pro: { expires_date: '2026-10-25T10:00:00Z', product_identifier: 'veyra_pro_monthly' } },
        subscriptions: { veyra_pro_monthly: { store: 'app_store', period_type: 'normal', unsubscribe_detected_at: null } },
      },
      NOW,
    );
    expect(row).toMatchObject({ user_id: USER, active: true, expires_at: '2026-10-25T10:00:00.000Z', product_id: 'veyra_pro_monthly', store: 'app_store', period_type: 'normal', will_renew: true, source: 'revenuecat' });
  });

  it('expired, cancelled subscription is inactive and will not renew', () => {
    const row = server.entitlementFromSubscriber(
      USER,
      {
        entitlements: { pro: { expires_date: '2026-09-20T00:00:00Z', product_identifier: 'veyra_pro_annual' } },
        subscriptions: { veyra_pro_annual: { store: 'play_store', unsubscribe_detected_at: '2026-09-01T00:00:00Z' } },
      },
      NOW,
    );
    expect(row.active).toBe(false);
    expect(row.will_renew).toBe(false);
  });

  it('billing grace period keeps Pro on', () => {
    const row = server.entitlementFromSubscriber(USER, { entitlements: { pro: { expires_date: '2026-09-24T00:00:00Z', grace_period_expires_date: '2026-10-01T00:00:00Z', product_identifier: 'm' } } }, NOW);
    expect(row.active).toBe(true);
    expect(row.expires_at).toBe('2026-10-01T00:00:00.000Z');
  });

  it('lifetime purchase has no expiry', () => {
    const row = server.entitlementFromSubscriber(USER, { entitlements: { pro: { expires_date: null, product_identifier: 'lifetime' } } }, NOW);
    expect(row).toMatchObject({ active: true, expires_at: null });
  });

  it('no pro entitlement (or unknown subscriber) → inactive row', () => {
    expect(server.entitlementFromSubscriber(USER, { entitlements: { other: { expires_date: null } } }, NOW).active).toBe(false);
    expect(server.entitlementFromSubscriber(USER, null, NOW)).toMatchObject({ active: false, expires_at: null, product_id: null });
  });
});

describe('premium: webhook user ids', () => {
  it('collects Supabase ids from every field, skips anonymous ones', () => {
    const other = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE';
    const ids = server.userIdsFromEvent({
      event: { type: 'TRANSFER', app_user_id: USER, original_app_user_id: '$RCAnonymousID:abc', aliases: [USER, '$RCAnonymousID:abc'], transferred_from: [other], transferred_to: [USER] },
    });
    expect(ids).toEqual([USER, other.toLowerCase()]);
  });

  it('ignores malformed bodies', () => {
    expect(server.userIdsFromEvent(null)).toEqual([]);
    expect(server.userIdsFromEvent({ event: 'x' })).toEqual([]);
  });
});

describe('premium: AI gate', () => {
  const limit = 1000;
  it('signed out / free → 402, over the cap → 429, otherwise ok', () => {
    expect(server.decideQuota({ userId: null, pro: false, used: 0, limit })).toMatchObject({ ok: false, status: 402, body: { reason: 'sign_in' } });
    expect(server.decideQuota({ userId: USER, pro: false, used: 0, limit })).toMatchObject({ ok: false, status: 402, body: { error: 'premium_required', reason: 'not_pro' } });
    expect(server.decideQuota({ userId: USER, pro: true, used: 1000, limit })).toMatchObject({ ok: false, status: 429, body: { error: 'quota_exceeded', used: 1000, limit } });
    expect(server.decideQuota({ userId: USER, pro: true, used: 999, limit })).toEqual({ ok: true, used: 999, limit });
  });

  it('quota month starts on the 1st, UTC', () => {
    expect(server.monthStartUtc(new Date('2026-09-25T10:00:00Z'))).toBe('2026-09-01T00:00:00.000Z');
    expect(server.monthStartUtc(new Date('2026-10-01T03:00:00+07:00'))).toBe('2026-09-01T00:00:00.000Z'); // still Sept in UTC
  });
});
