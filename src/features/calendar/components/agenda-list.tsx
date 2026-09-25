import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon, PressableScale, Text } from '@/components/ui';
import { useTheme } from '@/theme';

import type { CalItem } from '../model';

/** Compact list of a day's items (all-day first). Used under Week and Month views. */
export function AgendaList({ items, onOpen, nowId }: { items: CalItem[]; onOpen: (i: CalItem) => void; nowId?: string }) {
  const { t } = useTranslation();
  const { colors, tints, spacing, radius } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      {items.map((i) => {
        const isEvent = i.kind === 'event';
        const highlighted = nowId === `${i.kind}:${i.id}`;
        return (
          <PressableScale
            key={`${i.kind}:${i.id}`}
            accessibilityRole="button"
            accessibilityLabel={`${i.allDay ? t('calendar.all_day') : `${i.start}–${i.end}`}, ${i.title}`}
            onPress={() => onOpen(i)}
            style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: highlighted ? colors.primarySoft : 'transparent', opacity: i.done ? 0.55 : 1 }}
          >
            <View style={{ width: 48 }}>
              {i.allDay ? (
                <Text variant="caption" color="textSecondary">{t('calendar.all_day')}</Text>
              ) : (
                <>
                  <Text variant="label" weight="semibold" style={{ fontVariant: ['tabular-nums'] }}>{i.start}</Text>
                  <Text variant="caption" color="textTertiary" style={{ fontVariant: ['tabular-nums'] }}>{i.end}</Text>
                </>
              )}
            </View>
            <View style={{ width: 3, borderRadius: 2, backgroundColor: isEvent ? (i.color ?? tints.meeting.fg) : colors.borderStrong }} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="subheading" style={i.done ? { textDecorationLine: 'line-through' } : undefined}>{i.title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name={isEvent ? (i.location ? 'map-pin' : 'calendar') : 'check-square'} size={12} color="textSecondary" />
                <Text variant="caption" color="textSecondary" numberOfLines={1}>{isEvent ? (i.location ?? t('capture.type_event')) : t('capture.type_task')}</Text>
              </View>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}
