import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Card, Icon, PressableScale, SectionHeader, Tag, Text } from '@/components/ui';
import { nowMinutes } from '@/features/calendar/components/timeline';
import { eventToItem, scheduleStatus, toMinutes, type CalItem } from '@/features/calendar/model';
import { useEventsBetween } from '@/features/calendar/queries';
import { addDays, toDateKey } from '@/lib/date';
import { useTheme } from '@/theme';

/** Today's calendar events (live). Timed tasks live in "Needs attention" to avoid duplicates. */
export function Schedule() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const today = toDateKey();
  const items = useEventsBetween(today, toDateKey(addDays(new Date(), 1))).map(eventToItem);
  const allDay = items.filter((i) => i.allDay);
  const timed = items.filter((i) => !i.allDay);
  const now = nowMinutes();
  const status = scheduleStatus(timed, now);

  return (
    <Card>
      <SectionHeader title={t('home.today')} action={t('home.open_calendar')} onAction={() => router.navigate('/calendar')} />
      {items.length === 0 ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('calendar.new_event')}
          onPress={() => router.push({ pathname: '/event/[id]', params: { id: 'new', date: today } })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48 }}
        >
          <Icon name="plus-circle" size={18} />
          <Text variant="bodySm" color="textSecondary">{t('home.no_events')}</Text>
        </PressableScale>
      ) : (
        <View style={{ gap: spacing.xs }}>
          {allDay.map((e) => (
            <EventRow key={e.id} event={e} state="later" />
          ))}
          {timed.map((e) => (
            <EventRow
              key={e.id}
              event={e}
              state={e.id === status.currentId ? 'now' : e.id === status.nextId ? 'next' : now >= toMinutes(e.end!) ? 'past' : 'later'}
              nextIn={status.nextIn}
            />
          ))}
        </View>
      )}
    </Card>
  );
}

function EventRow({ event, state, nextIn }: { event: CalItem; state: 'past' | 'now' | 'next' | 'later'; nextIn?: number }) {
  const { t } = useTranslation();
  const { colors, tints, spacing, radius } = useTheme();
  const highlighted = state === 'now' || state === 'next';

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${event.allDay ? t('calendar.all_day') : `${event.start} to ${event.end}`}, ${event.title}${event.location ? `, ${event.location}` : ''}`}
      onPress={() => router.push({ pathname: '/event/[id]', params: { id: event.id } })}
      style={{
        flexDirection: 'row',
        gap: spacing.md,
        padding: spacing.md,
        marginHorizontal: -spacing.md,
        borderRadius: radius.lg,
        backgroundColor: highlighted ? colors.primarySoft : 'transparent',
        opacity: state === 'past' ? 0.5 : 1,
      }}
    >
      <View style={{ width: 48 }}>
        {event.allDay ? (
          <Text variant="caption" color="textSecondary">{t('calendar.all_day')}</Text>
        ) : (
          <>
            <Text variant="label" weight="semibold" style={{ fontVariant: ['tabular-nums'] }}>{event.start}</Text>
            <Text variant="caption" color="textTertiary" style={{ fontVariant: ['tabular-nums'] }}>{event.end}</Text>
          </>
        )}
      </View>
      <View style={{ width: 3, borderRadius: 2, backgroundColor: tints.meeting.fg, opacity: 0.8 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="subheading">{event.title}</Text>
        {event.location ? <Text variant="caption" color="textSecondary">{event.location}</Text> : null}
      </View>
      {state === 'next' && nextIn !== undefined ? (
        <View style={{ justifyContent: 'center' }}>
          <Tag label={t('home.in_minutes', { count: nextIn })} tint="meeting" icon="clock" />
        </View>
      ) : null}
      {state === 'now' ? (
        <View style={{ justifyContent: 'center' }}>
          <Tag label={t('home.now')} tint="done" />
        </View>
      ) : null}
    </PressableScale>
  );
}
