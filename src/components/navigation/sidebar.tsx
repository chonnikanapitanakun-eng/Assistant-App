import type { BottomTabBarProps } from 'expo-router/tabs';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { VeyraLockup, VGlyph } from '@/components/brand/logo';
import { Gradient, Icon, PressableScale, Text, type IconName } from '@/components/ui';
import { useTheme } from '@/theme';

import { navItems } from './nav-items';

/** Desktop left sidebar. Same routes as the bottom bar plus Notes and the assistant. */
export function Sidebar({ state, navigation }: BottomTabBarProps) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const active = state.routes[state.index]?.name;

  return (
    <View
      accessibilityRole="menu"
      style={{ width: 248, backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.border, paddingHorizontal: spacing.lg, paddingVertical: spacing.xxl, gap: spacing.xs }}
    >
      <View style={{ paddingHorizontal: spacing.sm, marginBottom: spacing.xxl }}>
        <VeyraLockup size={34} />
      </View>

      {navItems.map((item) => {
        const route = state.routes.find((r) => r.name === item.name);
        if (!route) return null;
        const focused = active === item.name;
        return (
          <SidebarItem
            key={item.name}
            icon={item.icon}
            label={t(item.labelKey)}
            focused={focused}
            onPress={() => {
              const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
            }}
          />
        );
      })}

      <SidebarItem icon="mail" label={t('more.inbox')} focused={false} onPress={() => router.push('/inbox')} />
      <SidebarItem icon="target" label={t('more.focus')} focused={false} onPress={() => router.push('/focus')} />
      <SidebarItem icon="search" label={t('more.search')} focused={false} onPress={() => router.push('/search')} />

      <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.lg }} />

      <PressableScale accessibilityRole="button" accessibilityLabel={t('nav.assistant')} onPress={() => router.push('/assistant')} style={{ borderRadius: radius.md, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48, paddingHorizontal: spacing.md, backgroundColor: colors.aiWash }}>
          <Gradient variant="ai" style={{ width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }}>
            <VGlyph size={16} />
          </Gradient>
          <Text variant="label" weight="semibold">{t('nav.assistant')}</Text>
        </View>
      </PressableScale>

      <View style={{ flex: 1 }} />
      <SidebarItem icon="settings" label={t('nav.settings')} focused={false} onPress={() => router.push('/settings')} />
    </View>
  );
}

function SidebarItem({ icon, label, focused, onPress }: { icon: IconName; label: string; focused: boolean; onPress?: () => void }) {
  const { colors, spacing, radius } = useTheme();
  return (
    <PressableScale
      accessibilityRole="menuitem"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: focused ? colors.primarySoft : 'transparent' }}
    >
      <Icon name={icon} size={20} color={focused ? 'primary' : 'textSecondary'} />
      <Text variant="label" weight={focused ? 'semibold' : 'medium'} color={focused ? 'primary' : 'textSecondary'}>{label}</Text>
    </PressableScale>
  );
}
