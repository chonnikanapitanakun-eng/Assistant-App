import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Mascot } from '@/components/brand/mascot';
import { Card, Chip, IconButton, PressableScale, Screen, Text } from '@/components/ui';
import { AgendaList } from '@/features/calendar/components/agenda-list';
import { AllDayRow } from '@/features/calendar/components/all-day-row';
import { MonthGrid } from '@/features/calendar/components/month-grid';
import { HourGutter, nowMinutes, TimelineColumn } from '@/features/calendar/components/timeline';
import { WeekStrip } from '@/features/calendar/components/week-strip';
import { countByDay, fromDateKey, hourRange, itemsForDay, mergeItems, monthGrid, shiftDate, weekDays, type CalItem } from '@/features/calendar/model';
import { useEventsBetween } from '@/features/calendar/queries';
import { useAllTasks } from '@/features/tasks/queries';
import { addDays, toDateKey } from '@/lib/date';
import { useBreakpoint, useTheme } from '@/theme';

type View_ = 'day' | 'week' | 'month';
const views: View_[] = ['day', 'week', 'month'];

export default function CalendarScreen() {
  const { t, i18n } = useTranslation();
  const { colors, spacing, motion } = useTheme();
  const { isDesktop } = useBreakpoint();
  const locale = i18n.language === 'th' ? 'th-TH' : 'en-GB';
  const today = toDateKey();
  const [view, setView] = useState<View_>('day');
  const [selected, setSelected] = useState(today);

  // Load the whole visible month grid once; day/week views are always inside it.
  const grid = monthGrid(selected);
  const events = useEventsBetween(grid[0].date, toDateKey(addDays(fromDateKey(grid[41].date), 1)));
  const tasks = useAllTasks();
  const items = useMemo(() => mergeItems(events, tasks), [events, tasks]);
  const counts = useMemo(() => countByDay(items), [items]);
  const week = weekDays(selected);
  const day = itemsForDay(items, selected);

  const open = (i: CalItem) =>
    i.kind === 'event' ? router.push({ pathname: '/event/[id]', params: { id: i.id } }) : router.push({ pathname: '/task/[id]', params: { id: i.id } });
  const createAt = (date: string, start?: string) => router.push({ pathname: '/event/[id]', params: start ? { id: 'new', date, start } : { id: 'new', date } });

  const title =
    view === 'day'
      ? fromDateKey(selected).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
      : fromDateKey(selected).toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  const header = (
    <View style={{ gap: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text variant="overline" color="textSecondary">{t('nav.calendar').toUpperCase()}</Text>
          <Text variant="title" accessibilityRole="header" numberOfLines={1}>{title}</Text>
        </View>
        <IconButton icon="chevron-left" label={t('calendar.previous')} onPress={() => setSelected(shiftDate(selected, view, -1))} />
        <IconButton icon="chevron-right" label={t('calendar.next')} onPress={() => setSelected(shiftDate(selected, view, 1))} />
        <IconButton icon="plus" label={t('calendar.new_event')} color="primary" filled onPress={() => createAt(selected)} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {views.map((v) => (
          <Chip key={v} label={t(`plan.${v}`)} selected={view === v} onPress={() => setView(v)} />
        ))}
        <View style={{ flex: 1 }} />
        {selected !== today ? (
          <PressableScale accessibilityRole="button" accessibilityLabel={t('calendar.today')} onPress={() => setSelected(today)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm }}>
            <Text variant="label" color="primary">{t('calendar.today')}</Text>
          </PressableScale>
        ) : null}
      </View>
    </View>
  );

  const empty = (
    <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl }}>
      <Mascot pose="calm" size={96} />
      <Text variant="subheading" align="center">{t('calendar.empty_title')}</Text>
      <Text variant="caption" color="textSecondary" align="center">{t('calendar.empty_body')}</Text>
    </View>
  );

  const dayTimeline = (date: string, dayItems: ReturnType<typeof itemsForDay>) => {
    const range = hourRange(dayItems.timed);
    return (
      <Card padding="md" style={{ gap: spacing.md }}>
        <AllDayRow items={dayItems.allDay} onOpen={open} />
        <View style={{ flexDirection: 'row', paddingTop: spacing.sm }}>
          <HourGutter range={range} />
          <TimelineColumn timed={dayItems.timed} range={range} now={date === today ? nowMinutes() : undefined} onOpen={open} onCreateAt={(time) => createAt(date, time)} />
        </View>
      </Card>
    );
  };

  const selectedAgenda = (
    <Card>
      <Text variant="heading">{fromDateKey(selected).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
      {day.allDay.length + day.timed.length ? <AgendaList items={[...day.allDay, ...day.timed]} onOpen={open} /> : empty}
    </Card>
  );

  let body;
  if (view === 'day') {
    body = isDesktop ? (
      <View style={{ flexDirection: 'row', gap: spacing.xxl, alignItems: 'flex-start' }}>
        <View style={{ flex: 1.6, gap: spacing.lg }}>
          <WeekStrip days={week} selected={selected} today={today} counts={counts} onSelect={setSelected} />
          {dayTimeline(selected, day)}
        </View>
        <Card style={{ flex: 1 }}>
          <MonthGrid date={selected} selected={selected} today={today} items={items} onSelect={setSelected} />
        </Card>
      </View>
    ) : (
      <>
        <WeekStrip days={week} selected={selected} today={today} counts={counts} onSelect={setSelected} />
        {dayTimeline(selected, day)}
      </>
    );
  } else if (view === 'week') {
    body = isDesktop ? (
      <Card padding="md" style={{ gap: spacing.md }}>
        <WeekTimeline days={week} items={items} today={today} selected={selected} onSelect={setSelected} onOpen={open} onCreateAt={createAt} />
      </Card>
    ) : (
      <>
        <WeekStrip days={week} selected={selected} today={today} counts={counts} onSelect={setSelected} />
        {week.map((d) => {
          const di = itemsForDay(items, d);
          const all = [...di.allDay, ...di.timed];
          if (!all.length) return null;
          return (
            <View key={d} style={{ gap: spacing.xs }}>
              <Text variant="overline" tone={d === today ? colors.primary : colors.textSecondary}>
                {fromDateKey(d).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' }).toUpperCase()}
              </Text>
              <Card padding="md" style={{ gap: 0 }}>
                <AgendaList items={all} onOpen={open} />
              </Card>
            </View>
          );
        })}
        {week.every((d) => !counts.get(d)) ? empty : null}
      </>
    );
  } else {
    body = isDesktop ? (
      <View style={{ flexDirection: 'row', gap: spacing.xxl, alignItems: 'flex-start' }}>
        <View style={{ flex: 2 }}>
          <MonthGrid large date={selected} selected={selected} today={today} items={items} onSelect={setSelected} />
        </View>
        <View style={{ flex: 1 }}>{selectedAgenda}</View>
      </View>
    ) : (
      <>
        <Card padding="md">
          <MonthGrid date={selected} selected={selected} today={today} items={items} onSelect={setSelected} />
        </Card>
        {selectedAgenda}
      </>
    );
  }

  return (
    <Screen maxWidth={view === 'day' && !isDesktop ? 880 : 1280}>
      {header}
      <Animated.View key={view} entering={FadeIn.duration(motion.base)} style={{ gap: spacing.xl }}>
        {body}
      </Animated.View>
    </Screen>
  );
}

type WeekProps = {
  days: string[];
  items: CalItem[];
  today: string;
  selected: string;
  onSelect: (d: string) => void;
  onOpen: (i: CalItem) => void;
  onCreateAt: (date: string, time?: string) => void;
};

/** Desktop week: shared hour gutter + seven day columns. */
function WeekTimeline({ days, items, today, selected, onSelect, onOpen, onCreateAt }: WeekProps) {
  const { i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const locale = i18n.language === 'th' ? 'th-TH' : 'en-GB';
  const perDay = days.map((d) => itemsForDay(items, d));
  const range = hourRange(perDay.flatMap((d) => d.timed));

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', paddingLeft: 52 }}>
        {days.map((d, i) => {
          const date = fromDateKey(d);
          const isToday = d === today;
          return (
            <View key={d} style={{ flex: 1, minWidth: 0, gap: spacing.xs, paddingHorizontal: 2 }}>
              <PressableScale
                accessibilityRole="button"
                accessibilityState={{ selected: d === selected }}
                accessibilityLabel={date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
                onPress={() => onSelect(d)}
                style={{ alignItems: 'center', paddingVertical: spacing.xs, borderRadius: radius.md, backgroundColor: isToday ? colors.primarySoft : 'transparent' }}
              >
                <Text variant="caption" color="textSecondary">{date.toLocaleDateString(locale, { weekday: 'short' })}</Text>
                <Text variant="heading" tone={isToday ? colors.primary : colors.text}>{date.getDate()}</Text>
              </PressableScale>
              <AllDayRow compact items={perDay[i].allDay} onOpen={onOpen} />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row' }}>
        <HourGutter range={range} />
        {days.map((d, i) => (
          <View key={d} style={{ flex: 1, minWidth: 0, borderLeftWidth: 1, borderLeftColor: colors.border }}>
            <TimelineColumn compact timed={perDay[i].timed} range={range} now={d === today ? nowMinutes() : undefined} onOpen={onOpen} onCreateAt={(time) => onCreateAt(d, time)} />
          </View>
        ))}
      </View>
    </View>
  );
}
