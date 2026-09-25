import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { useTheme } from '@/theme';

import { PressableScale } from './pressable-scale';
import { Text } from './text';

type Toast = { id: number; message: string; action?: { label: string; onPress: () => void } };

const useToastStore = create<{ toast: Toast | null }>(() => ({ toast: null }));
let seq = 0;

/** Brief message above the tab bar, optionally with one action (e.g. Undo). Replaces any visible toast. */
export function showToast(message: string, action?: Toast['action']) {
  useToastStore.setState({ toast: { id: ++seq, message, action } });
}

const hide = () => useToastStore.setState({ toast: null });

/** Mount once at the root. */
export function Toaster({ duration = 5000 }: { duration?: number }) {
  const toast = useToastStore((s) => s.toast);
  const { colors, spacing, radius, shadow } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(hide, duration);
    return () => clearTimeout(timer);
  }, [toast, duration]);

  if (!toast) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 96, alignItems: 'center', paddingHorizontal: spacing.lg }}>
      <Animated.View
        key={toast.id}
        entering={FadeInDown.duration(180)}
        exiting={FadeOutDown.duration(150)}
        accessibilityLiveRegion="polite"
        style={{ width: '100%', maxWidth: 480, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingLeft: spacing.lg, paddingRight: toast.action ? spacing.xs : spacing.lg, minHeight: 48, borderRadius: radius.lg, backgroundColor: colors.text, boxShadow: shadow.lg }}
      >
        <Text variant="bodySm" tone={colors.background} numberOfLines={2} style={{ flex: 1, paddingVertical: spacing.sm }}>{toast.message}</Text>
        {toast.action ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={toast.action.label}
            onPress={() => {
              toast.action!.onPress();
              hide();
            }}
            style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md }}
          >
            <Text variant="label" weight="bold" tone={colors.primarySoft}>{toast.action.label}</Text>
          </PressableScale>
        ) : null}
      </Animated.View>
    </View>
  );
}
