import type { BottomTabBarProps } from 'expo-router/tabs';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VGlyph } from '@/components/brand/logo';
import { Gradient, Icon, PressableScale, Text } from '@/components/ui';
import { useTheme } from '@/theme';

import { mobileTabs, navItems } from './nav-items';

/** Mobile bottom navigation with the Veyra AI button in the centre. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useTranslation();
  const { colors, spacing, shadow, touchTarget } = useTheme();
  const insets = useSafeAreaInsets();
  const active = state.routes[state.index]?.name;

  const renderTab = (name: string) => {
    const item = navItems.find((n) => n.name === name);
    const route = state.routes.find((r) => r.name === name);
    if (!item || !route) return null;
    const focused = active === name;
    const label = t(item.labelKey);
    const onPress = () => {
      const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
    };
    return (
      <PressableScale
        key={name}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: focused }}
        onPress={onPress}
        style={{ flex: 1, minHeight: touchTarget + 8, alignItems: 'center', justifyContent: 'center', gap: 3 }}
      >
        <Icon name={item.icon} size={22} color={focused ? 'tabActive' : 'tabInactive'} />
        <Text variant="overline" color={focused ? 'tabActive' : 'tabInactive'} style={{ letterSpacing: 0.1, fontSize: 11 }}>
          {label}
        </Text>
      </PressableScale>
    );
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.tabBar,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingBottom: Math.max(insets.bottom, spacing.sm),
        paddingTop: spacing.xs,
        paddingHorizontal: spacing.sm,
      }}
    >
      {mobileTabs.left.map(renderTab)}
      <View style={{ flex: 1, alignItems: 'center' }}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('nav.assistant')}
          onPress={() => router.push('/assistant')}
          style={{ marginTop: -26, borderRadius: 30, boxShadow: shadow.glow, borderWidth: 4, borderColor: colors.tabBar }}
        >
          <Gradient variant="ai" style={{ width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' }}>
            <VGlyph size={28} />
          </Gradient>
        </PressableScale>
      </View>
      {mobileTabs.right.map(renderTab)}
    </View>
  );
}
