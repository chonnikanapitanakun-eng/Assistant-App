import { Platform } from 'react-native';

import { useLiveRefresh } from '@/lib/use-live-refresh';

import { refreshWidgets } from './refresh';

/** Keeps the home / lock screen widgets in step with the data (P3-06). Mount once at the root. */
export function WidgetAutoRefresh() {
  if (Platform.OS === 'web') return null;
  return <Refresher />;
}

function Refresher() {
  useLiveRefresh(refreshWidgets, 'Widget refresh');
  return null;
}
