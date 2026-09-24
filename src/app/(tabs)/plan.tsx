import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { Card, Screen, Text } from '@/components/ui';
import { formatDate } from '@/features/plan/format';
import { MonthView } from '@/features/plan/month-view';
import { WeekView } from '@/features/plan/week-view';
import { DayTimeline } from '@/features/tasks/day-timeline';
import { setTaskDone, useTasksForDate } from '@/features/tasks/queries';
import { minutesToY } from '@/features/tasks/timeline';
import { shiftDateKey, shiftMonth, weekDays } from '@/lib/calendar';
import { toDateKey } from '@/lib/date';
import { showAlert } from '@/lib/dialog';
import { useTheme } from '@/theme';

const views = ['day', 'week', 'month'] as const;
type PlanView = (typeof views)[number];

export default function PlanScreen() {
  const { t, i18n } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const [view, setView] = useState<PlanView>('day');
  const [date, setDate] = useState(toDateKey);
  const scrollRef = useRef<ScrollView>(null);

  const shift = (dir: 1 | -1) => {
    if (view === 'day') setDate((d) => shiftDateKey(d, dir));
    else if (view === 'week') setDate((d) => shiftDateKey(d, dir * 7));
    else setDate((d) => shiftMonth(d, dir));
  };

  const openDay = (d: string) => {
    setDate(d);
    setView('day');
  };

  const lang = i18n.language;
  const week = weekDays(date);
  const title =
    view === 'day'
      ? formatDate(date, lang, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
      : view === 'week'
        ? `${formatDate(week[0], lang, { day: 'numeric', month: 'short' })} – ${formatDate(week[6], lang, { day: 'numeric', month: 'short', year: 'numeric' })}`
        : formatDate(date, lang, { month: 'long', year: 'numeric' });

  return (
    <Screen scroll={false}>
      <Text variant="title">{t('tabs.plan')}</Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {views.map((v) => (
          <Pressable
            key={v}
            onPress={() => setView(v)}
            accessibilityRole="tab"
            accessibilityState={{ selected: view === v }}
            style={{ paddingVertical: 8, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: view === v ? colors.primary : colors.surfaceAlt }}
          >
            <Text color={view === v ? 'onPrimary' : 'text'}>{t(`plan.${v}`)}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <NavButton icon="chevron-back" label={t('plan.previous')} onPress={() => shift(-1)} />
        <Text variant="heading" style={{ flex: 1, textAlign: 'center' }} numberOfLines={1}>{title}</Text>
        <NavButton icon="chevron-forward" label={t('plan.next')} onPress={() => shift(1)} />
        <Pressable onPress={() => setDate(toDateKey())} accessibilityRole="button" style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border }}>
          <Text variant="caption">{t('plan.today')}</Text>
        </Pressable>
      </View>

      <ScrollView ref={scrollRef} style={{ flex: 1, marginHorizontal: -spacing.lg }} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 96, gap: spacing.md }}>
        {view === 'day' ? (
          <DayView date={date} onTimelineLayout={(y) => scrollRef.current?.scrollTo({ y: y + Math.max(0, minutesToY(nowMinutes() - 60)), animated: false })} />
        ) : view === 'week' ? (
          <WeekView date={date} onSelectDay={openDay} />
        ) : (
          <MonthView date={date} onSelectDay={openDay} />
        )}
      </ScrollView>
    </Screen>
  );
}

function DayView({ date, onTimelineLayout }: { date: string; onTimelineLayout: (y: number) => void }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const tasks = useTasksForDate(date);
  const unscheduled = tasks.filter((x) => !x.startTime);
  const scrolled = useRef<string | null>(null);

  return (
    <>
      {unscheduled.length > 0 ? (
        <Card>
          <Text variant="caption" color="textSecondary">{t('plan.anytime')}</Text>
          {unscheduled.map((task) => (
            <Pressable
              key={task.id}
              onPress={() => setTaskDone(task.id, !task.isDone).catch((e: unknown) => showAlert(t('common.save_failed'), String(e)))}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: task.isDone }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
            >
              <Ionicons name={task.isDone ? 'checkbox' : 'square-outline'} size={20} color={colors.primary} />
              <Text style={[{ flex: 1 }, task.isDone ? { textDecorationLine: 'line-through', opacity: 0.6 } : null]}>{task.title}</Text>
            </Pressable>
          ))}
        </Card>
      ) : null}
      <Text variant="caption" color="textSecondary">{t('plan.drag_hint')}</Text>
      <View
        onLayout={(e) => {
          // เลื่อนไปใกล้เวลาปัจจุบันครั้งเดียวต่อวันที่ (เฉพาะวันนี้)
          if (date !== toDateKey() || scrolled.current === date) return;
          scrolled.current = date;
          onTimelineLayout(e.nativeEvent.layout.y);
        }}
      >
        <DayTimeline date={date} tasks={tasks} />
      </View>
    </>
  );
}

function NavButton({ icon, label, onPress }: { icon: 'chevron-back' | 'chevron-forward'; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8} style={{ padding: 4 }}>
      <Ionicons name={icon} size={22} color={colors.text} />
    </Pressable>
  );
}

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}
