/**
 * Focus timer as plain data driven by wall-clock time, so it stays correct while
 * the app is backgrounded (no ticking counters). All functions are pure.
 */
export type Phase = 'focus' | 'break';

export type TimerState =
  | { status: 'idle' }
  | {
      status: 'running' | 'paused';
      phase: Phase;
      durationMs: number;
      /** When the current run segment started (running only). */
      resumedAt: number;
      /** Time already spent before the current segment. */
      elapsedMs: number;
      /** First start of this session (for the session log). */
      startedAt: number;
      taskId: string | null;
    }
  | { status: 'finished'; phase: Phase; durationMs: number; startedAt: number; taskId: string | null };

export const MIN = 60_000;

export function start(phase: Phase, minutes: number, now: number, taskId: string | null = null): TimerState {
  return { status: 'running', phase, durationMs: minutes * MIN, resumedAt: now, elapsedMs: 0, startedAt: now, taskId };
}

export function elapsed(s: TimerState, now: number): number {
  if (s.status === 'idle') return 0;
  if (s.status === 'finished') return s.durationMs;
  return Math.min(s.durationMs, s.elapsedMs + (s.status === 'running' ? Math.max(0, now - s.resumedAt) : 0));
}

export function remaining(s: TimerState, now: number): number {
  return s.status === 'idle' ? 0 : Math.max(0, s.durationMs - elapsed(s, now));
}

export function progress(s: TimerState, now: number): number {
  return s.status === 'idle' || s.durationMs === 0 ? 0 : elapsed(s, now) / s.durationMs;
}

export function pause(s: TimerState, now: number): TimerState {
  if (s.status !== 'running') return s;
  return { ...s, status: 'paused', elapsedMs: elapsed(s, now) };
}

export function resume(s: TimerState, now: number): TimerState {
  if (s.status !== 'paused') return s;
  return { ...s, status: 'running', resumedAt: now };
}

/** Add time to a running or paused timer. */
export function extend(s: TimerState, minutes: number): TimerState {
  if (s.status !== 'running' && s.status !== 'paused') return s;
  return { ...s, durationMs: s.durationMs + minutes * MIN };
}

/** Promote a running timer whose time is up to `finished`. */
export function settle(s: TimerState, now: number): TimerState {
  if (s.status === 'running' && remaining(s, now) === 0) {
    return { status: 'finished', phase: s.phase, durationMs: s.durationMs, startedAt: s.startedAt, taskId: s.taskId };
  }
  return s;
}

/** When a running timer will end (for scheduling the notification). */
export function endsAt(s: TimerState, now: number): number | null {
  return s.status === 'running' ? now + remaining(s, now) : null;
}

/** mm:ss (or h:mm:ss) for the ring. */
export function clock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
