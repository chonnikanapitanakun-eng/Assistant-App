// Contract of `ai-plan` (SPEC §6.4), shared by the Edge Function and the app (mirror of src/features/ai/plan.ts).
// Pure TypeScript — no Deno globals — so vitest can test it from the app side.
//
// The app sends one day: its open backlog, what is already fixed (events + timed tasks) and the working
// window. Claude returns time slots for some of the backlog; the app shows them as ONE proposal card that
// the user approves (or trims) before any task is moved. `normalizePlanResponse` is the gate: unknown tasks,
// bad times, overlaps with busy blocks or with each other are dropped, so the app can trust the shape.

export type PlanTask = {
  id: string;
  title: string;
  priority: 1 | 2 | 3; // 1 high
  durationMin: number | null; // user's estimate; null = unknown
  energy: 'low' | 'med' | 'high' | null;
  date: string | null; // YYYY-MM-DD it is due; null = no date
  overdue: boolean;
};

export type PlanBusy = { kind: 'event' | 'task'; title: string; start: string; end: string };

export type PlanRequest = {
  locale?: 'th' | 'en';
  date: string; // YYYY-MM-DD, the day being planned
  weekday?: string;
  /** HH:mm — plan from here on when the day is today; null when planning another day. */
  now?: string | null;
  workStart?: string; // HH:mm, default 09:00
  workEnd?: string; // HH:mm, default 18:00
  backlog: PlanTask[];
  busy: PlanBusy[];
  /** Free text the app derives from check-ins (e.g. "energy usually highest in the morning"); optional. */
  energyPattern?: string | null;
};

export type PlanSlot = { taskId: string; startTime: string; endTime: string; reason: string };
export type PlanSkipped = { taskId: string; reason: string };
export type PlanResponse = { schedule: PlanSlot[]; skipped: PlanSkipped[]; summary: string };

export const MAX_SLOTS = 12;
export const MAX_BACKLOG = 40;
export const DEFAULT_WORK_START = '09:00';
export const DEFAULT_WORK_END = '18:00';
export const DEFAULT_DURATION = 45;
export const MIN_DURATION = 15;
export const MAX_DURATION = 240;

const str = { type: 'string' } as const;
const time = { type: 'string', description: 'HH:mm, 24-hour' } as const;

/**
 * JSON schema Claude must fill (structured output). Structured output rejects minimum/maximum and
 * maxItems, so the limits live in normalizePlanResponse.
 */
export const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    schedule: {
      type: 'array',
      description: 'Time blocks for backlog tasks, in time order. Only ids from <backlog>. At most 12.',
      items: {
        type: 'object',
        properties: {
          taskId: { ...str, description: 'id from <backlog>' },
          startTime: time,
          endTime: time,
          reason: { ...str, description: 'One short clause, in the user\'s language, why this task goes here (e.g. "deadline today, fresh in the morning")' },
        },
        required: ['taskId', 'startTime', 'endTime', 'reason'],
        additionalProperties: false,
      },
    },
    skipped: {
      type: 'array',
      description: 'Backlog tasks you deliberately left out today, with why (no room, low priority, better tomorrow).',
      items: {
        type: 'object',
        properties: { taskId: str, reason: str },
        required: ['taskId', 'reason'],
        additionalProperties: false,
      },
    },
    summary: { ...str, description: 'Two or three short sentences to the user about the shape of their day. Plain text, no markdown.' },
  },
  required: ['schedule', 'skipped', 'summary'],
  additionalProperties: false,
} as const;

export const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
export const isTime = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
export const fromMinutes = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
const text = (v: unknown, max = 200): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Working window + earliest start in minutes, from a request (falls back to defaults). */
export function planWindow(req: Pick<PlanRequest, 'workStart' | 'workEnd' | 'now'>): { start: number; end: number; from: number } {
  const start = isTime(req.workStart) ? toMinutes(req.workStart) : toMinutes(DEFAULT_WORK_START);
  let end = isTime(req.workEnd) ? toMinutes(req.workEnd) : toMinutes(DEFAULT_WORK_END);
  if (end <= start) end = Math.min(start + 8 * 60, 24 * 60);
  // Today: nothing before now, rounded up to the next quarter hour.
  const from = isTime(req.now) ? Math.max(start, Math.ceil(toMinutes(req.now) / 15) * 15) : start;
  return { start, end, from };
}

/** Clean an incoming request so both the model and the local planner see the same thing. */
export function normalizePlanRequest(raw: unknown): PlanRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!isDate(r.date)) return null;
  const backlog: PlanTask[] = (Array.isArray(r.backlog) ? r.backlog : [])
    .map((t: unknown): PlanTask | null => {
      if (!t || typeof t !== 'object') return null;
      const x = t as Record<string, unknown>;
      const id = text(x.id, 64);
      const title = text(x.title, 120);
      if (!id || !title) return null;
      const priority = x.priority === 1 || x.priority === 3 ? x.priority : 2;
      const dur = typeof x.durationMin === 'number' && Number.isFinite(x.durationMin) && x.durationMin > 0 ? Math.min(MAX_DURATION, Math.max(MIN_DURATION, Math.round(x.durationMin))) : null;
      const energy = x.energy === 'low' || x.energy === 'med' || x.energy === 'high' ? x.energy : null;
      return { id, title, priority, durationMin: dur, energy, date: isDate(x.date) ? x.date : null, overdue: x.overdue === true };
    })
    .filter((t): t is PlanTask => !!t)
    .slice(0, MAX_BACKLOG);
  const busy: PlanBusy[] = (Array.isArray(r.busy) ? r.busy : [])
    .map((b: unknown): PlanBusy | null => {
      if (!b || typeof b !== 'object') return null;
      const x = b as Record<string, unknown>;
      if (!isTime(x.start) || !isTime(x.end) || toMinutes(x.end) <= toMinutes(x.start)) return null;
      return { kind: x.kind === 'task' ? 'task' : 'event', title: text(x.title, 120) || '—', start: x.start, end: x.end };
    })
    .filter((b): b is PlanBusy => !!b)
    .slice(0, 60);
  return {
    locale: r.locale === 'th' ? 'th' : 'en',
    date: r.date,
    weekday: text(r.weekday, 12) || undefined,
    now: isTime(r.now) ? r.now : null,
    workStart: isTime(r.workStart) ? r.workStart : DEFAULT_WORK_START,
    workEnd: isTime(r.workEnd) ? r.workEnd : DEFAULT_WORK_END,
    backlog,
    busy,
    energyPattern: text(r.energyPattern, 300) || null,
  };
}

/**
 * Validate what the model returned against the request. Drops: unknown or repeated task ids, malformed
 * or inverted times, blocks outside the window / before `now`, blocks that overlap a busy block or an
 * earlier accepted block. Keeps time order. Never throws.
 */
export function normalizePlanResponse(raw: unknown, req: PlanRequest): PlanResponse {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const { end: winEnd, from } = planWindow(req);
  const known = new Map(req.backlog.map((t) => [t.id, t]));
  const busy = req.busy.map((b) => ({ start: toMinutes(b.start), end: toMinutes(b.end) }));
  const taken: { start: number; end: number }[] = [...busy];
  const overlaps = (s: number, e: number) => taken.some((b) => s < b.end && e > b.start);

  const candidates = (Array.isArray(r.schedule) ? r.schedule : [])
    .map((s: unknown) => {
      if (!s || typeof s !== 'object') return null;
      const x = s as Record<string, unknown>;
      if (!isTime(x.startTime) || !isTime(x.endTime)) return null;
      const id = text(x.taskId, 64);
      if (!known.has(id)) return null;
      const start = toMinutes(x.startTime);
      const end = toMinutes(x.endTime);
      if (end <= start || start < from || end > winEnd || end - start > MAX_DURATION) return null;
      return { taskId: id, start, end, reason: text(x.reason) };
    })
    .filter((s): s is { taskId: string; start: number; end: number; reason: string } => !!s)
    .sort((a, b) => a.start - b.start);

  const seen = new Set<string>();
  const schedule: PlanSlot[] = [];
  for (const c of candidates) {
    if (schedule.length >= MAX_SLOTS || seen.has(c.taskId) || overlaps(c.start, c.end)) continue;
    seen.add(c.taskId);
    taken.push({ start: c.start, end: c.end });
    schedule.push({ taskId: c.taskId, startTime: fromMinutes(c.start), endTime: fromMinutes(c.end), reason: c.reason });
  }

  const skipped: PlanSkipped[] = (Array.isArray(r.skipped) ? r.skipped : [])
    .map((s: unknown) => {
      const x = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
      const id = text(x.taskId, 64);
      return known.has(id) && !seen.has(id) ? { taskId: id, reason: text(x.reason) } : null;
    })
    .filter((s): s is PlanSkipped => !!s)
    .filter((s, i, arr) => arr.findIndex((o) => o.taskId === s.taskId) === i)
    .slice(0, MAX_BACKLOG);

  return { schedule, skipped, summary: text(r.summary, 600) };
}

/** Free gaps (minutes) inside [from, end) once `busy` is removed, each at least `minLength` long. */
export function freeGaps(busy: { start: number; end: number }[], from: number, end: number, minLength: number): { start: number; end: number }[] {
  const sorted = [...busy].sort((a, b) => a.start - b.start);
  const out: { start: number; end: number }[] = [];
  let cursor = from;
  for (const b of sorted) {
    if (b.end <= cursor) continue;
    if (b.start - cursor >= minLength && cursor < end) out.push({ start: cursor, end: Math.min(b.start, end) });
    cursor = Math.max(cursor, b.end);
  }
  if (end - cursor >= minLength) out.push({ start: cursor, end });
  return out.filter((s) => s.end - s.start >= minLength);
}

/**
 * Deterministic planner — the app's offline fallback and a sanity baseline for the model.
 * Overdue and high-priority tasks first; high-energy tasks take the earliest gaps of the day; each task
 * gets its estimated duration (default 45 min) rounded to 15, or a shorter block when a gap is a bit tight.
 * Returns an empty `summary` so the caller can phrase it in the user's language.
 */
export function planLocally(req: PlanRequest, maxSlots = 6): PlanResponse {
  const { end, from } = planWindow(req);
  const taken = req.busy.map((b) => ({ start: toMinutes(b.start), end: toMinutes(b.end) }));
  const energyRank = { high: 0, med: 1, low: 2 } as const;
  const order = [...req.backlog].sort(
    (a, b) => Number(b.overdue) - Number(a.overdue) || a.priority - b.priority || energyRank[a.energy ?? 'med'] - energyRank[b.energy ?? 'med'] || a.title.localeCompare(b.title),
  );
  const schedule: PlanSlot[] = [];
  const skipped: PlanSkipped[] = [];
  for (const task of order) {
    if (schedule.length >= maxSlots) {
      skipped.push({ taskId: task.id, reason: '' });
      continue;
    }
    const want = Math.ceil((task.durationMin ?? DEFAULT_DURATION) / 15) * 15;
    const gaps = freeGaps(taken, from, end, MIN_DURATION);
    // Prefer a gap that fits the whole task; otherwise the longest gap, as long as it covers most of it.
    const fit = gaps.find((g) => g.end - g.start >= want) ?? [...gaps].sort((a, b) => b.end - b.start - (a.end - a.start)).find((g) => g.end - g.start >= Math.max(MIN_DURATION, want * 0.6));
    if (!fit) {
      skipped.push({ taskId: task.id, reason: '' });
      continue;
    }
    const len = Math.min(want, fit.end - fit.start);
    taken.push({ start: fit.start, end: fit.start + len });
    schedule.push({ taskId: task.id, startTime: fromMinutes(fit.start), endTime: fromMinutes(fit.start + len), reason: '' });
  }
  schedule.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  return { schedule, skipped, summary: '' };
}
