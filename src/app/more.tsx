import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon, PressableScale, Sheet, Tag, Text, type IconName } from '@/components/ui';
import { useTheme } from '@/theme';

type Item = { key: string; icon: IconName; href?: Href };
const items: Item[] = [
  { key: 'notes', icon: 'file-text', href: '/notes' },
  { key: 'focus', icon: 'target' },
  { key: 'search', icon: 'search' },
  { key: 'contacts', icon: 'users' },
  { key: 'settings', icon: 'settings' },
];

/** Phone "More" menu for sections that don't fit the bottom bar. */
export default function MoreScreen() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <Sheet onClose={close} title={t('more.title')}>
      <View style={{ padding: spacing.lg, gap: spacing.xs }}>
        {items.map((item) => {
          const ready = !!item.href;
          return (
            <PressableScale
              key={item.key}
              accessibilityRole="button"
              accessibilityState={{ disabled: !ready }}
              accessibilityLabel={ready ? t(`more.${item.key}`) : `${t(`more.${item.key}`)}, ${t('more.soon')}`}
              disabled={!ready}
              onPress={() => item.href && router.dismissTo(item.href)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingHorizontal: spacing.md, borderRadius: radius.lg, opacity: ready ? 1 : 0.55 }}
            >
              <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={item.icon} size={18} />
              </View>
              <Text variant="subheading" style={{ flex: 1 }}>{t(`more.${item.key}`)}</Text>
              {ready ? <Icon name="chevron-right" size={18} color="textTertiary" /> : <Tag label={t('more.soon')} tint="priorityLow" />}
            </PressableScale>
          );
        })}
      </View>
    </Sheet>
  );
}
