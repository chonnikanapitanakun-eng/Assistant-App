import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon, PressableScale, Text } from '@/components/ui';
import { useTheme } from '@/theme';

import { fromMinutes, layoutTimeline, toMinutes, type CalItem } from '../model';

export const HOUR_HEIGHT = 56;
const GUTTER = 52;

type ColumnProps = {
  timed: CalItem[];
  range: [number, number];
  now?: number;
  compact?: boolean;
  onOpen: (item: CalItem) => void;
  onCreateAt: (time: string) => void;
};

/** Hour labels on the left of a timeline. */
export function HourGutter({ range }: { range: [number, number] }) {
  const hours = Array.from({ length: range[1] - range[0] }, (_, i) => range[0] + i);
  return (
    <View style={{ width: GUTTER }}>
      {hours.map((h) => (
        <View key={h} style={{ height: HOUR_HEIGHT }}>
          <Text variant="caption" color="textTertiary" style={{ marginTop: -9, fontVariant: ['tabular-nums'] }}>{h === range[0] ? '' : fromMinutes(h * 60)}</Text>
        </View>
      ))}
    </View>
  );
}

/** One day column: hour grid, tappable empty slots, positioned items and a "now" line. */
export function TimelineColumn({ timed, range, now, compact, onOpen, onCreateAt }: ColumnProps) {
  const { t } = useTranslation();
  const { colors, tints, radius } = useTheme();
  const hours = Array.from({ length: range[1] - range[0] }, (_, i) => range[0] + i);
  const laid = layoutTimeline(timed, range[0], HOUR_HEIGHT);
  const nowTop = now !== undefined ? ((now - range[0] * 60) / 60) * HOUR_HEIGHT : null;

  return (
    <View style={{ flex: 1, minWidth: 0, height: hours.length * HOUR_HEIGHT }}>
      {hours.map((h) => (
        <PressableScale
          key={h}
          accessibilityRole="button"
          accessibilityLabel={t('calendar.new_at', { time: fromMinutes(h * 60) })}
          onPress={() => onCreateAt(fromMinutes(h * 60))}
          style={{ height: HOUR_HEIGHT, borderTopWidth: 1, borderTopColor: colors.border }}
        />
      ))}

      {laid.map((p) => {
        const isEvent = p.kind === 'event';
        const tint = tints.meeting;
        const width = `${100 / p.cols}%` as const;
        const tiny = p.height < 40;
        return (
          <PressableScale
            key={`${p.kind}:${p.id}`}
            accessibilityRole="button"
            accessibilityLabel={`${p.start}–${p.end}, ${p.title}${isEvent ? '' : `, ${t('capture.type_task')}`}`}
            onPress={() => onOpen(p)}
            style={{
              position: 'absolute',
              top: p.top + 1,
              height: p.height - 2,
              left: `${(100 / p.cols) * p.col}%`,
              width,
              paddingRight: 3,
            }}
          >
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                overflow: 'hidden',
                borderRadius: radius.sm + 2,
                backgroundColor: isEvent ? tint.bg : colors.surfaceMuted,
                borderWidth: isEvent ? 0 : 1,
                borderColor: colors.border,
                opacity: p.done ? 0.55 : 1,
              }}
            >
              <View style={{ width: 3, backgroundColor: isEvent ? tint.fg : colors.borderStrong }} />
              <View style={{ flex: 1, paddingHorizontal: compact ? 6 : 8, paddingVertical: tiny ? 2 : 6, gap: 1, flexDirection: tiny ? 'row' : 'column', alignItems: tiny ? 'center' : 'stretch' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 }}>
                  {!isEvent ? <Icon name={p.done ? 'check-circle' : 'circle'} size={12} color="textSecondary" /> : null}
                  <Text variant="caption" weight="semibold" tone={isEvent ? tint.fg : colors.text} numberOfLines={tiny ? 1 : 2} style={[{ flexShrink: 1 }, p.done ? { textDecorationLine: 'line-through' } : null]}>
                    {p.title}
                  </Text>
                </View>
                {!tiny && !compact ? (
                  <Text variant="caption" color="textSecondary" numberOfLines={1}>
                    {p.start}–{p.end}{p.location ? ` · ${p.location}` : ''}
                  </Text>
                ) : null}
              </View>
            </View>
          </PressableScale>
        );
      })}

      {nowTop !== null && nowTop >= 0 && nowTop <= hours.length * HOUR_HEIGHT ? (
        <View pointerEvents="none" accessibilityLabel={t('calendar.now')} style={{ position: 'absolute', top: nowTop - 4, left: -4, right: 0, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.danger }} />
          <View style={{ flex: 1, height: 1.5, backgroundColor: colors.danger }} />
        </View>
      ) : null}
    </View>
  );
}

export const nowMinutes = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

export { GUTTER, toMinutes };
