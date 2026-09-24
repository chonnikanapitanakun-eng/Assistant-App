import { create } from 'zustand';

import { cancelTimerEnd, scheduleTimerEnd } from '@/features/notifications';
import i18n from '@/i18n';

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
  /** Called every second by the screen (and on app focus). */
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
  const reschedule = async (timer: T.TimerState) => {
    await cancelTimerEnd(get().notificationId);
    const at = T.endsAt(timer, Date.now());
    const id = at && timer.status === 'running' ? await scheduleTimerEnd(at, i18n.t(timer.phase === 'focus' ? 'focus.notify_focus_title' : 'focus.notify_break_title'), i18n.t(timer.phase === 'focus' ? 'focus.notify_focus_body' : 'focus.notify_break_body')) : null;
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
      if (after.phase === 'focus') logSession({ taskId: after.taskId, startedAt: after.startedAt, durationMin: minutes, completed: true });
      set({ timer: { status: 'idle' }, finished: { phase: after.phase, minutes, taskId: after.taskId }, notificationId: null });
    },
    stop: () => {
      const { timer, notificationId } = get();
      if (timer.status === 'running' || timer.status === 'paused') {
        const spent = Math.floor(T.elapsed(timer, Date.now()) / T.MIN);
        if (timer.phase === 'focus' && spent >= 1) logSession({ taskId: timer.taskId, startedAt: timer.startedAt, durationMin: spent, completed: false });
      }
      void cancelTimerEnd(notificationId);
      set({ timer: { status: 'idle' }, notificationId: null });
    },
    dismiss: () => set({ finished: null }),
  };
});
