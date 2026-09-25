import { describe, expect, it } from 'vitest';

import { planContextReminders, reminderText, type ContextInput, type ContextStrings } from '../model';

const at = (hhmm: string, day = 24) => new Date(2026, 8, day, Number(hhmm.slice(0, 2)), Number(hhmm.slice(3))).getTime();
const link = (fromType: string, fromId: string, toType: string, toId: string) => ({ fromType, fromId, toType, toId }) as ContextInput['links'][number];

const input: ContextInput = {
  events: [
    { id: 'meet', title: 'VAT meeting', start: at('15:00'), isAllDay: false },
    { id: 'lunch', title: 'Lunch', start: at('12:00'), isAllDay: false },
    { id: 'allday', title: 'Offsite', start: at('00:00', 25), isAllDay: true },
  ],
  tasks: [
    { id: 'recon', title: 'VAT recon', date: '2026-09-24', priority: 2 },
    { id: 'slides', title: 'Slides', date: null, priority: 1 },
    { id: 'later', title: 'Follow up', date: '2026-09-30', priority: 1 },
    { id: 'offsite', title: 'Pack', date: null, priority: 2 },
  ],
  links: [
    link('event', 'meet', 'contact', 'john'),
    link('task', 'recon', 'contact', 'john'),
    link('task', 'later', 'contact', 'john'),
    link('task', 'slides', 'event', 'meet'),
    link('event', 'allday', 'task', 'offsite'),
  ],
  contacts: [{ id: 'john', name: 'John' }],
};

describe('planContextReminders', () => {
  it('reminds before events with open prep, linked directly or through a contact', () => {
    const plans = planContextReminders(input, at('09:00'), 30);
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ eventId: 'meet', at: at('14:30'), contactName: 'John' });
    // Directly linked first; a task planned for after the meeting is left out.
    expect(plans[0].tasks.map((t) => t.id)).toEqual(['slides', 'recon']);
  });

  it('skips reminders whose time has passed, all-day events, and lead 0', () => {
    expect(planContextReminders(input, at('14:30'), 30)).toEqual([]);
    expect(planContextReminders(input, at('14:00'), 30)).toHaveLength(1);
    expect(planContextReminders(input, at('09:00'), 0)).toEqual([]);
  });

  it('ignores events beyond the lookahead and caps the count', () => {
    const far = { ...input, events: [{ id: 'meet', title: 'Far', start: at('15:00', 24) + 8 * 86_400_000, isAllDay: false }] };
    expect(planContextReminders(far, at('09:00'), 30)).toEqual([]);
    expect(planContextReminders(input, at('09:00'), 30, 0)).toHaveLength(0);
  });
});

describe('reminderText', () => {
  const s: ContextStrings = {
    title: (time, event, contact) => `${time} ${event}${contact ? ` with ${contact}` : ''}`,
    bodyOne: (task) => `"${task}" not done`,
    bodyMany: (count, tasks) => `${count}: ${tasks}`,
    time: () => '15:00',
  };
  const base = { eventId: 'e', eventTitle: 'VAT meeting', eventStart: 0, at: 0, contactName: 'John' };

  it('names the contact unless the title already does', () => {
    expect(reminderText({ ...base, tasks: [{ id: 'a', title: 'A' }] }, s)).toEqual({ title: '15:00 VAT meeting with John', body: '"A" not done' });
    expect(reminderText({ ...base, eventTitle: 'Call john', tasks: [{ id: 'a', title: 'A' }] }, s).title).toBe('15:00 Call john');
  });

  it('lists at most three tasks', () => {
    const tasks = ['A', 'B', 'C', 'D'].map((title) => ({ id: title, title }));
    expect(reminderText({ ...base, tasks }, s).body).toBe('4: A, B, C +1');
  });
});
