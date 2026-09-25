import { useEffect, type PropsWithChildren, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, SlideInDown, SlideInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useConfirm } from '@/lib/use-confirm';
import { useBreakpoint, useTheme } from '@/theme';

import { IconButton } from './icon-button';
import { Text } from './text';

type Props = PropsWithChildren<{
  onClose: () => void;
  /** Layout on tablet/desktop. Phones always get a bottom sheet. */
  wide?: 'center' | 'side';
  title?: string;
  subtitle?: string;
  /** Pinned below the scrollable content (e.g. primary action). */
  footer?: ReactNode;
  /** Unsaved edits: the first close (backdrop, X, Android back) warns, a second one discards. */
  dirty?: boolean;
}>;

/**
 * Modal surface used by sheet routes (presentation: 'transparentModal').
 * Phone: bottom sheet with 24px top corners. Larger screens: centred dialog or right-side panel.
 */
export function Sheet({ children, onClose, wide = 'center', title, subtitle, footer, dirty }: Props) {
  const { t } = useTranslation();
  const { colors, tints, spacing, radius, shadow, motion } = useTheme();
  const { armed, confirm } = useConfirm();
  const requestClose = () => (dirty ? confirm(onClose) : onClose());

  useEffect(() => {
    if (!dirty) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      confirm(onClose);
      return true;
    });
    return () => sub.remove();
  }, [dirty, confirm, onClose]);

  const { isMobile } = useBreakpoint();
  const insets = useSafeAreaInsets();
  const side = !isMobile && wide === 'side';

  const frame = isMobile
    ? { width: '100%' as const, maxHeight: '92%' as const, borderTopLeftRadius: radius.panel, borderTopRightRadius: radius.panel, paddingBottom: insets.bottom + spacing.lg }
    : side
      ? { width: 460, height: '100%' as const, borderTopLeftRadius: radius.panel, borderBottomLeftRadius: radius.panel, paddingBottom: spacing.xl }
      : { width: '100%' as const, maxWidth: 560, maxHeight: '86%' as const, borderRadius: radius.panel, paddingBottom: spacing.xl };
  const entering = isMobile ? SlideInDown.duration(motion.base) : side ? SlideInRight.duration(motion.base) : FadeInDown.duration(motion.base);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, flexDirection: side ? 'row' : 'column', justifyContent: isMobile ? 'flex-end' : side ? 'flex-end' : 'center', alignItems: side ? 'stretch' : 'center', padding: isMobile || side ? 0 : spacing.xxl }}
    >
      <Animated.View entering={FadeIn.duration(motion.fast)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={requestClose} style={{ flex: 1 }} />
      </Animated.View>

      <Animated.View entering={entering} accessibilityViewIsModal style={[frame, { backgroundColor: colors.surface, boxShadow: shadow.lg, overflow: 'hidden' }]}>
        {isMobile ? <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginTop: spacing.sm }} /> : null}
        {title ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="heading" accessibilityRole="header">{title}</Text>
              {subtitle ? <Text variant="caption" color="textSecondary">{subtitle}</Text> : null}
            </View>
            <IconButton icon="x" label={t('common.close')} onPress={requestClose} filled />
          </View>
        ) : null}
        {armed ? (
          <View accessibilityLiveRegion="polite" style={{ marginHorizontal: spacing.xl, marginTop: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: tints.priorityMedium.bg }}>
            <Text variant="caption" weight="semibold" tone={tints.priorityMedium.fg}>{t('common.unsaved')}</Text>
          </View>
        ) : null}
        <View style={{ flexShrink: 1, flexGrow: side ? 1 : 0 }}>{children}</View>
        {footer ? <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm }}>{footer}</View> : null}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}
