import { requestWidgetUpdate } from 'react-native-android-widget';

import { writeJSON } from '@/features/profile/storage';

import { renderAndroidWidget } from './android-widget';
import { loadWidgetInput, widgetStrings } from './data';
import { buildTimeline, entryAt, WIDGET_NAME } from './model';
import { TIMELINE_KEY } from './storage';

/**
 * Redraw the Android widget now and save the timeline for later: Android redraws on its own every
 * 30 minutes (updatePeriodMillis) via the headless task in task-handler.tsx, which picks the
 * entry for that moment without opening the database.
 */
export async function refreshWidgets(): Promise<void> {
  const now = Date.now();
  const entries = buildTimeline(await loadWidgetInput(now), now, widgetStrings());
  writeJSON(TIMELINE_KEY, entries);
  const entry = entryAt(entries, now);
  if (!entry) return;
  await requestWidgetUpdate({ widgetName: WIDGET_NAME, renderWidget: (info) => renderAndroidWidget(entry.data, info.width) });
}
