import { Ionicons } from '@expo/vector-icons';
import { Tabs, router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Fab } from '@/components/ui';
import { useTheme } from '@/theme';

type Icon = keyof typeof Ionicons.glyphMap;

const tabs: { name: string; key: 'today' | 'plan' | 'notes' | 'money'; icon: Icon; iconActive: Icon }[] = [
  { name: 'index', key: 'today', icon: 'sunny-outline', iconActive: 'sunny' },
  { name: 'plan', key: 'plan', icon: 'calendar-outline', iconActive: 'calendar' },
  { name: 'notes', key: 'notes', icon: 'document-text-outline', iconActive: 'document-text' },
  { name: 'money', key: 'money', icon: 'wallet-outline', iconActive: 'wallet' },
];

export default function TabLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.tabActive,
          tabBarInactiveTintColor: colors.tabInactive,
          tabBarStyle: { backgroundColor: colors.tabBar, borderTopColor: colors.border },
        }}
      >
        {tabs.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: t(`tabs.${tab.key}`),
              tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? tab.iconActive : tab.icon} size={size} color={color} />,
            }}
          />
        ))}
      </Tabs>
      <Fab onPress={() => router.push('/capture')} />
    </>
  );
}
