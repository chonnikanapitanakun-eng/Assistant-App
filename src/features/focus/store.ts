import { useEffect } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';

import { cancelTimerEnd, scheduleTimerEnd } from '@/features/notifications';
import i18n from '@/i18n';
import { background } from '@/lib/background';

import { logSession } from './queries';
import * as T from './timer';

type Finished = { phase: T.Phase; minutes: number; taskId: string | null };

type FocusStore = {
  timer: T.TimerState;
  /** Preset chosen while idle. */
  minutes: number;
  taskId: string | null;
  notificationId: string | null;
  /** Last completed run, for the "done" screen. */
  finished: Finished | null;
  setMinutes: (m: number) => void;
  setTask: (id: string | null) => void;
  start: (phase?: T.Phase, minutes?: number) => void;
  pause: () => void;
  resume: () => void;
  extend: (minutes: number) => void;
  /** Settle a timer whose time is up (idempotent). Driven by useFocusTimerDriver; the screen calls it too. */
  tick: () => void;
  /** Stop early: logs a focus session as not completed if at least a minute was spent. */
  stop: () => void;
  dismiss: () => void;
};

export const FOCUS_PRESETS = [15, 25, 50] as const;
export const BREAK_MINUTES = 5;

/**
 * App-wide focus timer. State lives in memory (survives navigation; a running timer
 * keeps counting from wall-clock time and its end notification is scheduled with the OS).
 */
export const useFocus = create<FocusStore>((set, get) => {
  // Bumped on every timer change. A schedule that resolves after a newer change (pause / stop
  // while it was in flight) is stale: cancel it instead of storing it, or it would fire anyway.
  let generation = 0;
  const reschedule = async (timer: T.TimerState) => {
    const gen = ++generation;
    await cancelTimerEnd(get().notificationId);
    const at = T.endsAt(timer, Date.now());
    const id = at && timer.status === 'running' ? await scheduleTimerEnd(at, i18n.t(timer.phase === 'focus' ? 'focus.notify_focus_title' : 'focus.notify_break_title'), i18n.t(timer.phase === 'focus' ? 'focus.notify_focus_body' : 'focus.notify_break_body')) : null;
    if (gen !== generation) {
      await cancelTimerEnd(id);
      return;
    }
    set({ notificationId: id });
  };

  return {
    timer: { status: 'idle' },
    minutes: 25,
    taskId: null,
    notificationId: null,
    finished: null,
    setMinutes: (minutes) => set({ minutes }),
    setTask: (taskId) => set({ taskId }),
    start: (phase = 'focus', minutes) => {
      const m = minutes ?? (phase === 'focus' ? get().minutes : BREAK_MINUTES);
      const timer = T.start(phase, m, Date.now(), phase === 'focus' ? get().taskId : null);
      set({ timer, finished: null });
      void reschedule(timer);
    },
    pause: () => {
      const timer = T.pause(get().timer, Date.now());
      set({ timer });
      void reschedule(timer);
    },
    resume: () => {
      const timer = T.resume(get().timer, Date.now());
      set({ timer });
      void reschedule(timer);
    },
    extend: (minutes) => {
      const timer = T.extend(get().timer, minutes);
      set({ timer });
      void reschedule(timer);
    },
    tick: () => {
      const before = get().timer;
      const after = T.settle(before, Date.now());
      if (after === before || after.status !== 'finished') return;
      const minutes = Math.round(after.durationMs / T.MIN);
      if (after.phase === 'focus') background(logSession({ taskId: after.taskId, startedAt: after.startedAt, durationMin: minutes, completed: true }), 'Log focus session');
      generation++; // the end notification already covers this run; drop any schedule still in flight
      set({ timer: { status: 'idle' }, finished: { phase: after.phase, minutes, taskId: after.taskId }, notificationId: null });
    },
    stop: () => {
      const { timer, notificationId } = get();
      if (timer.status === 'running' || timer.status === 'paused') {
        const spent = Math.floor(T.elapsed(timer, Date.now()) / T.MIN);
        if (timer.phase === 'focus' && spent >= 1) background(logSession({ taskId: timer.taskId, startedAt: timer.startedAt, durationMin: spent, completed: false }), 'Log focus session');
      }
      generation++;
      void cancelTimerEnd(notificationId);
      set({ timer: { status: 'idle' }, notificationId: null });
    },
    dismiss: () => set({ finished: null }),
  };
});

/** When the running timer's time is up (wall clock), or null when nothing is running. */
const endTime = (s: FocusStore) => (s.timer.status === 'running' ? s.timer.resumedAt + s.timer.durationMs - s.timer.elapsedMs : null);

/**
 * Settles the focus timer wherever the user is in the app, so a finished session is logged on
 * time even if they never go back to the focus screen. Mount once, at the root layout.
 * Fires at the expected end, every second as a backstop (timers drift or get throttled), and
 * when the app returns to the foreground. `tick` is idempotent, so extra calls are harmless.
 */
export function useFocusTimerDriver() {
  const end = useFocus(endTime);
  useEffect(() => {
    if (end === null) return;
    const tick = () => useFocus.getState().tick();
    tick();
    const timeout = setTimeout(tick, Math.max(0, end - Date.now()) + 50);
    const interval = setInterval(tick, 1000);
    const sub = AppState.addEventListener('change', (state) => state === 'active' && tick());
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
      sub.remove();
    };
  }, [end]);
}
