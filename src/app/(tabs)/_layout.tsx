import { Redirect, Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { Sidebar } from '@/components/navigation/sidebar';
import { TabBar } from '@/components/navigation/tab-bar';
import { useMorningBriefing, useNotificationResponse } from '@/features/notifications';
import { useProfile } from '@/features/profile/store';
import { useBreakpoint, useTheme } from '@/theme';

/** Runs once the user is in the app: keeps the morning briefing scheduled and opens tapped notifications. */
function NotificationBridge() {
  useMorningBriefing();
  useNotificationResponse();
  return null;
}

export default function TabLayout() {
  const { isDesktop } = useBreakpoint();
  const { colors } = useTheme();
  const onboarded = useProfile((p) => p.onboarded);
  // First run goes through onboarding before the main app.
  if (!onboarded) return <Redirect href="/onboarding" />;
  return (
    <>
      {Platform.OS !== 'web' ? <NotificationBridge /> : null}
      <Tabs
        tabBar={(props) => (isDesktop ? <Sidebar {...props} /> : <TabBar {...props} />)}
        screenOptions={{
          headerShown: false,
          tabBarPosition: isDesktop ? 'left' : 'bottom',
          sceneStyle: { backgroundColor: colors.background },
          animation: 'fade',
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="tasks" />
        <Tabs.Screen name="calendar" />
        <Tabs.Screen name="notes" />
        <Tabs.Screen name="money" />
      </Tabs>
    </>
  );
}
