import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import type { ContextNotificationData } from './schedule';

/** Tapping a context reminder opens Focus with its first unfinished task selected. Mount once at the root. */
export function ContextReminderTaps() {
  if (Platform.OS === 'web') return null;
  return <Listener />;
}

function Listener() {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const data = response.notification.request.content.data as Partial<ContextNotificationData> | undefined;
    if (data?.kind !== 'context' || !data.taskId) return;
    // Handled once: without clearing, reopening the app would jump to Focus again.
    Notifications.clearLastNotificationResponse();
    router.push({ pathname: '/focus', params: { taskId: data.taskId } });
  }, [response]);
  return null;
}
