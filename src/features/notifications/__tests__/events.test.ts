import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date', DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly', YEARLY: 'yearly' },
}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('@/db', () => ({ db: {}, calendarEvents: {} }));
vi.mock('@/i18n', () => ({ default: { t: (k: string) => k } }));
vi.mock('../permissions', () => ({ ensurePermission: async () => 'granted' }));
vi.mock('../setup', () => ({ REMINDER_CHANNEL_ID: 'reminders' }));

const { planEventReminder } = await import('../events');

const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const ev = (start: number, extra: object = {}) => ({ id: 'e', title: 'T', start, isAllDay: false, repeat: null, remindBefore: 10, reminderNotificationId: null, source: 'veyra', ...extra });
const NOW = at(2026, 9, 25, 12);

describe('planEventReminder', () => {
  it('schedules a one-off before a single event, and nothing once it has passed', () => {
    expect(planEventReminder(ev(at(2026, 9, 26, 9)), NOW)).toMatchObject({ at: at(2026, 9, 26, 8, 50), trigger: { type: 'date' } });
    expect(planEventReminder(ev(at(2026, 9, 25, 12, 5)), NOW)).toBeNull();
    expect(planEventReminder(ev(at(2026, 9, 26, 9), { remindBefore: null }), NOW)).toBeNull();
  });
  it('reminds all-day events at 09:00 minus the lead time', () => {
    expect(planEventReminder(ev(at(2026, 9, 27), { isAllDay: true, remindBefore: 1440 }), NOW)?.at).toBe(at(2026, 9, 26, 9));
  });
  it('uses a repeating trigger once a series is running', () => {
    const weekly = planEventReminder(ev(at(2026, 9, 1, 9), { repeat: 'weekly' }), NOW);
    expect(weekly).toMatchObject({ at: at(2026, 9, 29, 8, 50), trigger: { type: 'weekly', weekday: 3, hour: 8, minute: 50 } });
    expect(planEventReminder(ev(at(2026, 1, 15, 9), { repeat: 'monthly' }), NOW)?.trigger).toMatchObject({ type: 'monthly', day: 15 });
  });
  it('falls back to a one-off when a repeating trigger would be wrong', () => {
    // Series starts months ahead: a weekly trigger would fire before it begins.
    expect(planEventReminder(ev(at(2026, 12, 1, 9), { repeat: 'weekly' }), NOW)?.trigger).toMatchObject({ type: 'date' });
    // 31st of the month doesn't exist every month.
    expect(planEventReminder(ev(at(2026, 1, 31, 9), { repeat: 'monthly' }), NOW)?.trigger).toMatchObject({ type: 'date' });
  });
});
