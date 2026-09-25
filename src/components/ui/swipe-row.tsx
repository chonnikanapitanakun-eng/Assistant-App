import type { ReactNode } from 'react';
import { View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme';

import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

export type SwipeAction = { key: string; icon: IconName; label: string; bg: string; fg: string; onPress: () => void };

/**
 * Row that slides left to reveal quick actions. Swiping is a shortcut only —
 * every action must also be reachable from the item's own screen.
 */
export function SwipeRow({ actions, children }: { actions: SwipeAction[]; children: ReactNode }) {
  const { colors } = useTheme();
  if (!actions.length) return <>{children}</>;
  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      onSwipeableWillOpen={() => haptic.tap()}
      renderRightActions={(_progress, _translation, methods) => (
        <View style={{ flexDirection: 'row' }}>
          {actions.map((a) => (
            <PressableScale
              key={a.key}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              onPress={() => {
                methods.close();
                a.onPress();
              }}
              style={{ width: 76, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: a.bg }}
            >
              <Icon name={a.icon} size={18} tone={a.fg} />
              <Text variant="caption" weight="semibold" tone={a.fg} numberOfLines={1}>{a.label}</Text>
            </PressableScale>
          ))}
        </View>
      )}
    >
      <View style={{ backgroundColor: colors.surface }}>{children}</View>
    </ReanimatedSwipeable>
  );
}
