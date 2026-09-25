import type { WidgetTaskHandler } from 'react-native-android-widget';

import { renderAndroidWidget } from './android-widget';
import { entryAt, SCHEME, type WidgetData } from './model';
import { readTimeline } from './storage';

/** Shown until the app has run once and saved a timeline. */
const placeholder: WidgetData = {
  nextLabel: 'Veyra',
  nextTitle: '',
  nextTime: '',
  emptyLabel: 'Open Veyra to set up this widget',
  done: 0,
  total: 0,
  progressLabel: '',
  billName: '',
  billDetail: '',
  captureLabel: 'Capture',
  nextUrl: SCHEME,
  billUrl: SCHEME,
  captureUrl: `${SCHEME}capture`,
  openUrl: SCHEME,
};

/**
 * Android runs this headless (the app may be closed) when a widget is added, resized, or its
 * update period comes round. It only reads the saved timeline — no database or i18n here.
 * Taps are OPEN_URI deep links, so there are no click actions to handle.
 */
export const widgetTaskHandler: WidgetTaskHandler = async ({ widgetInfo, widgetAction, renderWidget }) => {
  if (widgetAction === 'WIDGET_DELETED' || widgetAction === 'WIDGET_CLICK') return;
  const entry = entryAt(readTimeline(), Date.now());
  renderWidget(renderAndroidWidget(entry?.data ?? placeholder, widgetInfo.width));
};
