import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon, PressableScale, Text } from '@/components/ui';
import { useTheme } from '@/theme';

import { fromMinutes, layoutTimeline, moveSlot, SNAP_MIN, toMinutes, type CalItem, type Positioned } from '../model';

export const HOUR_HEIGHT = 56;
const GUTTER = 52;

type ColumnProps = {
  timed: CalItem[];
  range: [number, number];
  now?: number;
  compact?: boolean;
  onOpen: (item: CalItem) => void;
  onCreateAt: (time: string) => void;
  /** Long-press and drag a block to change its time (snaps to 15 min). */
  onMove?: (item: CalItem, start: string, end: string) => void;
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
export function TimelineColumn({ timed, range, now, compact, onOpen, onCreateAt, onMove }: ColumnProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
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

      {laid.map((p) => (
        // Key includes the time: after a move the block remounts at its new slot instead of springing back.
        <Block key={`${p.kind}:${p.id}:${p.start}-${p.end}`} p={p} compact={compact} onOpen={onOpen} onMove={onMove} />
      ))}

      {nowTop !== null && nowTop >= 0 && nowTop <= hours.length * HOUR_HEIGHT ? (
        <View pointerEvents="none" accessibilityLabel={t('calendar.now')} style={{ position: 'absolute', top: nowTop - 4, left: -4, right: 0, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.danger }} />
          <View style={{ flex: 1, height: 1.5, backgroundColor: colors.danger }} />
        </View>
      ) : null}
    </View>
  );
}

/** A positioned item. Tap opens it; long-press (250 ms) then drag moves it, snapping to 15 minutes. */
function Block({ p, compact, onOpen, onMove }: { p: Positioned; compact?: boolean; onOpen: (item: CalItem) => void; onMove?: ColumnProps['onMove'] }) {
  const { t } = useTranslation();
  const { colors, tints, radius } = useTheme();
  const [preview, setPreview] = useState<{ start: string; end: string } | null>(null);
  const y = useSharedValue(0);
  const lifted = useSharedValue(false);
  const lastStep = useSharedValue(0);
  const canMove = !!onMove && !p.readOnly;

  const slotFor = (dy: number) => moveSlot(p.start!, p.end!, (dy / HOUR_HEIGHT) * 60);
  const showPreview = (dy: number) => setPreview(slotFor(dy));
  const drop = (dy: number) => {
    const next = slotFor(dy);
    setPreview(null);
    if (next.start === p.start) y.value = withSpring(0);
    else onMove?.(p, next.start, next.end);
  };
  const cancel = () => {
    setPreview(null);
    y.value = withSpring(0);
  };
  const open = () => onOpen(p);

  const pan = Gesture.Pan()
    .enabled(canMove)
    .activateAfterLongPress(250)
    .onStart(() => {
      lifted.value = true;
      lastStep.value = 0;
    })
    .onUpdate((e) => {
      y.value = e.translationY;
      const step = Math.round(((e.translationY / HOUR_HEIGHT) * 60) / SNAP_MIN);
      if (step !== lastStep.value) {
        lastStep.value = step;
        scheduleOnRN(showPreview, e.translationY);
      }
    })
    .onFinalize((e, success) => {
      lifted.value = false;
      scheduleOnRN(success ? drop : cancel, e.translationY);
    });
  const tap = Gesture.Tap().onEnd((_e, success) => {
    if (success) scheduleOnRN(open);
  });

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { scale: lifted.value ? 1.02 : 1 }],
    zIndex: lifted.value ? 10 : 1,
    boxShadow: lifted.value ? '0 8px 20px rgba(15, 23, 42, 0.18)' : 'none',
  }));

  const isEvent = p.kind === 'event';
  const tint = tints.meeting;
  const tiny = p.height < 40;
  const time = preview ? `${preview.start}–${preview.end}` : `${p.start}–${p.end}`;

  return (
    <GestureDetector gesture={Gesture.Race(pan, tap)}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${p.start}–${p.end}, ${p.title}${isEvent ? '' : `, ${t('capture.type_task')}`}`}
        accessibilityHint={canMove ? t('calendar.drag_hint') : undefined}
        onAccessibilityTap={open}
        style={[{ position: 'absolute', top: p.top + 1, height: p.height - 2, left: `${(100 / p.cols) * p.col}%`, width: `${100 / p.cols}%`, paddingRight: 3 }, animated]}
      >
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            overflow: 'hidden',
            borderRadius: radius.sm + 2,
            backgroundColor: isEvent ? tint.bg : colors.surfaceMuted,
            borderWidth: preview ? 1.5 : isEvent ? 0 : 1,
            borderColor: preview ? colors.primary : colors.border,
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
            {(!tiny && !compact) || preview ? (
              <Text variant="caption" color={preview ? 'primary' : 'textSecondary'} weight={preview ? 'semibold' : undefined} numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }}>
                {time}{!preview && p.location ? ` · ${p.location}` : ''}
              </Text>
            ) : null}
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

export const nowMinutes = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

export { GUTTER, toMinutes };
