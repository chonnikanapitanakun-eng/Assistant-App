import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon, PressableScale, Text } from '@/components/ui';
import { useTheme } from '@/theme';

import type { CalItem } from '../model';

/** All-day events and untimed tasks due that day, as small pills. */
export function AllDayRow({ items, onOpen, compact }: { items: CalItem[]; onOpen: (i: CalItem) => void; compact?: boolean }) {
  const { t } = useTranslation();
  const { colors, tints, spacing, radius } = useTheme();
  if (!items.length) return null;
  return (
    <View style={{ gap: spacing.xs }}>
      {items.map((i) => {
        const isEvent = i.kind === 'event';
        return (
          <PressableScale
            key={`${i.kind}:${i.id}`}
            accessibilityRole="button"
            accessibilityLabel={`${t('calendar.all_day')}, ${i.title}`}
            onPress={() => onOpen(i)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              minHeight: compact ? 28 : 36,
              paddingHorizontal: spacing.sm,
              borderRadius: radius.sm,
              backgroundColor: isEvent ? tints.meeting.bg : colors.surfaceMuted,
              opacity: i.done ? 0.55 : 1,
            }}
          >
            <Icon name={isEvent ? 'sun' : i.done ? 'check-circle' : 'circle'} size={12} tone={isEvent ? tints.meeting.fg : colors.textSecondary} />
            <Text variant="caption" weight="semibold" tone={isEvent ? tints.meeting.fg : colors.text} numberOfLines={1} style={[{ flex: 1 }, i.done ? { textDecorationLine: 'line-through' } : null]}>
              {i.title}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}
