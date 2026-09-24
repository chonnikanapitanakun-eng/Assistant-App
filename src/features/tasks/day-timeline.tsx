import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Text } from '@/components/ui';
import type { Task } from '@/db';
import { toDateKey } from '@/lib/date';
import { showAlert } from '@/lib/dialog';
import { useTheme } from '@/theme';

import { rescheduleTask } from './queries';
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  HOUR_HEIGHT,
  SNAP_MIN,
  layoutOverlaps,
  minutesToTime,
  minutesToY,
  moveSpan,
  type Positioned,
} from './timeline';

const LABEL_WIDTH = 48;
const hours = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i);

/** Timeline รายวัน: กดค้างที่งานแล้วลากขึ้น/ลงเพื่อย้ายเวลา (snap 15 นาที) */
export function DayTimeline({ date, tasks }: { date: string; tasks: Task[] }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const positioned = layoutOverlaps(tasks);
  const laneWidth = Math.max(0, width - LABEL_WIDTH);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: hours.length * HOUR_HEIGHT }}>
      {hours.map((h) => (
        <View key={h} style={[styles.hourRow, { top: (h - DAY_START_HOUR) * HOUR_HEIGHT, borderColor: colors.border }]}>
          <Text variant="caption" color="textSecondary" style={styles.hourLabel}>{`${String(h).padStart(2, '0')}:00`}</Text>
        </View>
      ))}
      {date === toDateKey() ? <NowLine /> : null}
      {laneWidth > 0
        ? positioned.map((p) => (
            // key รวม startTime: ย้ายเสร็จแล้ว block ใหม่ mount ที่ตำแหน่งใหม่ ไม่กระพริบกลับ
            <TaskBlock key={`${p.item.id}-${p.item.startTime}-${p.item.endTime}`} p={p} laneWidth={laneWidth} />
          ))
        : null}
    </View>
  );
}

function TaskBlock({ p, laneWidth }: { p: Positioned<Task>; laneWidth: number }) {
  const { t } = useTranslation();
  const { colors, radius } = useTheme();
  const translateY = useSharedValue(0);
  const dragging = useSharedValue(false);
  const lastDelta = useSharedValue(0);
  const [previewDelta, setPreviewDelta] = useState<number | null>(null);

  const colWidth = laneWidth / p.columns;
  const top = minutesToY(p.start);
  const height = Math.max(minutesToY(p.end) - top, 22);
  const span = { start: p.start, end: p.end };

  const commit = (deltaMin: number) => {
    setPreviewDelta(null);
    const next = moveSpan(span, deltaMin);
    if (next.startTime === minutesToTime(p.start)) {
      translateY.value = withSpring(0);
      return;
    }
    // สำเร็จ → query refetch แล้ว block ใหม่ mount ที่ตำแหน่งใหม่ (key เปลี่ยน); ล้มเหลว → เด้งกลับที่เดิม
    rescheduleTask(p.item.id, p.item.date, next.startTime, next.endTime).catch((e: unknown) => {
      translateY.value = withSpring(0);
      showAlert(t('common.save_failed'), String(e));
    });
  };

  const pan = Gesture.Pan()
    .activateAfterLongPress(250)
    .onStart(() => {
      dragging.value = true;
      lastDelta.value = 0;
    })
    .onUpdate((e) => {
      translateY.value = e.translationY;
      const delta = Math.round(((e.translationY / HOUR_HEIGHT) * 60) / SNAP_MIN) * SNAP_MIN;
      if (delta !== lastDelta.value) {
        lastDelta.value = delta;
        scheduleOnRN(setPreviewDelta, delta);
      }
    })
    .onFinalize((e, success) => {
      dragging.value = false;
      if (!success) {
        translateY.value = withSpring(0);
        scheduleOnRN(setPreviewDelta, null);
        return;
      }
      scheduleOnRN(commit, (e.translationY / HOUR_HEIGHT) * 60);
    });

  const restOpacity = p.item.isDone ? 0.5 : 1;
  const openTask = () => router.push(`/task/${p.item.id}`);
  // tap สั้น = เปิดรายละเอียด, กดค้าง 250ms = เริ่มลาก (ตัวไหน activate ก่อนชนะ)
  const tap = Gesture.Tap().onEnd((_e, success) => {
    if (success) scheduleOnRN(openTask);
  });
  const gesture = Gesture.Race(pan, tap);

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: dragging.value ? 1.02 : 1 }],
    zIndex: dragging.value ? 10 : 1,
    opacity: dragging.value ? 0.9 : restOpacity,
  }));

  const label = previewDelta === null ? `${minutesToTime(p.start)}–${minutesToTime(p.end)}` : moveSpan(span, previewDelta).startTime;
  const bg = p.item.color ?? colors.primary;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessibilityLabel={`${p.item.title} ${label}`}
        style={[
          styles.block,
          { top, height, left: LABEL_WIDTH + p.column * colWidth, width: colWidth - 4, backgroundColor: bg, borderRadius: radius.sm },
          animated,
        ]}
      >
        <Text color="onPrimary" numberOfLines={height > 40 ? 2 : 1} style={[{ fontWeight: '600' }, p.item.isDone ? { textDecorationLine: 'line-through' } : null]}>
          {p.item.title}
        </Text>
        {height > 40 || previewDelta !== null ? <Text variant="caption" color="onPrimary">{label}</Text> : null}
      </Animated.View>
    </GestureDetector>
  );
}

function NowLine() {
  const { colors } = useTheme();
  const [minutes, setMinutes] = useState(currentMinutes);
  useEffect(() => {
    const id = setInterval(() => setMinutes(currentMinutes()), 60_000);
    return () => clearInterval(id);
  }, []);
  if (minutes < DAY_START_HOUR * 60) return null;
  return <View pointerEvents="none" style={[styles.now, { top: minutesToY(minutes), backgroundColor: colors.expense }]} />;
}

function currentMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

const styles = StyleSheet.create({
  hourRow: { position: 'absolute', left: 0, right: 0, height: HOUR_HEIGHT, borderTopWidth: StyleSheet.hairlineWidth },
  hourLabel: { width: LABEL_WIDTH - 6, marginTop: -9, paddingRight: 6, textAlign: 'right' },
  block: { position: 'absolute', paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden' },
  now: { position: 'absolute', left: LABEL_WIDTH - 4, right: 0, height: 2, zIndex: 5 },
});
