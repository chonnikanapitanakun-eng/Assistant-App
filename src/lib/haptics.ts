import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Browsers have no haptics; skip the call rather than log a warning each tap.
const enabled = Platform.OS !== 'web';
const safe = (p: () => Promise<void>) => {
  if (enabled) p().catch(() => undefined);
};

/** Light physical feedback for key actions (no-op on web). */
export const haptic = {
  tap: () => safe(() => Haptics.selectionAsync()),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
