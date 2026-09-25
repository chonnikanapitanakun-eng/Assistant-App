import { loadWidgetInput, widgetStrings } from './data';
import { todayWidget } from './ios-widget';
import { buildTimeline } from './model';

/** Push a fresh timeline to the iOS widget. WidgetKit flips entries at each item's start/end on its own. */
export async function refreshWidgets(): Promise<void> {
  const now = Date.now();
  const entries = buildTimeline(await loadWidgetInput(now), now, widgetStrings());
  todayWidget.updateTimeline(entries.map((e) => ({ date: new Date(e.at), props: e.data })));
}
