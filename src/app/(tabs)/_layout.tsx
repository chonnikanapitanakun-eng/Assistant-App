import { Redirect, Tabs } from 'expo-router';

import { Sidebar } from '@/components/navigation/sidebar';
import { TabBar } from '@/components/navigation/tab-bar';
import { useProfile } from '@/features/profile/store';
import { useBreakpoint, useTheme } from '@/theme';

export default function TabLayout() {
  const { isDesktop } = useBreakpoint();
  const { colors } = useTheme();
  const onboarded = useProfile((p) => p.onboarded);
  // First run goes through onboarding before the main app.
  if (!onboarded) return <Redirect href="/onboarding" />;
  return (
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
  );
}
