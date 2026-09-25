import { useEffect } from 'react';
import { AppState } from 'react-native';

import { onDatabaseWrite } from '@/db';
import i18n from '@/i18n';

import { background } from './background';

/**
 * Keep something derived from the database up to date outside the app (widgets, scheduled
 * notifications): runs `work` on mount, when the app comes to the foreground or leaves it, when
 * the language changes, and `delayMs` after the last DB write in a burst. Never runs two at once —
 * a trigger during a run queues one more run. Pass a stable (module-level) `work`.
 */
export function useLiveRefresh(work: () => Promise<void>, what: string, delayMs = 1500) {
  useEffect(() => {
    let running = false;
    let again = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = () => {
      clearTimeout(timer);
      if (running) {
        again = true;
        return;
      }
      running = true;
      const done = () => {
        running = false;
        if (again) {
          again = false;
          run();
        }
      };
      const job = work();
      background(job, what);
      job.then(done, done);
    };
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(run, delayMs);
    };

    run();
    const offWrite = onDatabaseWrite(later);
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active' || s === 'background') run();
    });
    i18n.on('languageChanged', later);
    return () => {
      clearTimeout(timer);
      offWrite();
      app.remove();
      i18n.off('languageChanged', later);
    };
  }, [work, what, delayMs]);
}
