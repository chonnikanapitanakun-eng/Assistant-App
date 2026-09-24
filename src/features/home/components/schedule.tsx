import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Card, PressableScale, SectionHeader, Tag, Text } from '@/components/ui';
import { useTheme } from '@/theme';

import { eventTint, events, mockNow, scheduleStatus, type HomeEvent } from '../mock';

export function Schedule() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const status = scheduleStatus(mockNow);

  return (
    <Card>
      <SectionHeader title={t('home.today')} action={t('home.open_calendar')} onAction={() => router.navigate('/calendar')} />
      <View style={{ gap: spacing.xs }}>
        {events.map((e) => (
          <EventRow
            key={e.id}
            event={e}
            state={e.id === status.currentId ? 'now' : e.id === status.nextId ? 'next' : status.mins >= toEnd(e) ? 'past' : 'later'}
            nextIn={status.nextIn}
          />
        ))}
      </View>
    </Card>
  );
}

const toEnd = (e: HomeEvent) => {
  const [h, m] = e.end.split(':').map(Number);
  return h * 60 + m;
};

function EventRow({ event, state, nextIn }: { event: HomeEvent; state: 'past' | 'now' | 'next' | 'later'; nextIn?: number }) {
  const { t } = useTranslation();
  const { colors, tints, spacing, radius } = useTheme();
  const tint = tints[eventTint[event.kind]];
  const highlighted = state === 'now' || state === 'next';

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${event.start} to ${event.end}, ${event.title}${event.meta ? `, ${event.meta}` : ''}`}
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
        <Text variant="label" weight="semibold" style={{ fontVariant: ['tabular-nums'] }}>{event.start}</Text>
        <Text variant="caption" color="textTertiary" style={{ fontVariant: ['tabular-nums'] }}>{event.end}</Text>
      </View>
      <View style={{ width: 3, borderRadius: 2, backgroundColor: tint.fg, opacity: 0.8 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="subheading">{event.title}</Text>
        {event.meta ? <Text variant="caption" color="textSecondary">{event.meta}</Text> : null}
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
