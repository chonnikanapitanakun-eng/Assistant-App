import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon, PressableScale, Text, type IconName } from '@/components/ui';
import { useAllTasks } from '@/features/tasks/queries';
import { greetingKey, toDateKey } from '@/lib/date';
import { useBreakpoint, useTheme, type TintName } from '@/theme';

import { bills, events, mockNow, user } from '../mock';

const meetings = events.filter((e) => e.kind === 'meeting').length;
const billsToday = bills.filter((b) => b.dueToday).length;

export function Greeting() {
  const { t, i18n } = useTranslation();
  const { spacing } = useTheme();
  const { isMobile } = useBreakpoint();
  const today = toDateKey();
  const tasksToday = useAllTasks().filter((x) => !x.isDone && x.date === today).length;
  const date = mockNow.toLocaleDateString(i18n.language === 'th' ? 'th-TH' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const emoji = greetingKey(mockNow) === 'greeting_evening' ? '🌙' : '☀️';

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.xs }}>
        <Text variant="overline" color="textSecondary">{date.toUpperCase()}</Text>
        <Text variant={isMobile ? 'title' : 'display'} accessibilityRole="header">
          {t(`today.${greetingKey(mockNow)}`)}, {user.firstName}. {emoji}
        </Text>
        <Text variant="body" color="textSecondary">
          {t('home.summary', { meetings, tasks: tasksToday, bills: billsToday })}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Stat icon="users" tint="meeting" value={meetings} label={t('home.stat_meetings')} />
        <Stat icon="check-circle" tint="priorityLow" value={tasksToday} label={t('home.stat_tasks')} />
        <Stat icon="file-text" tint="bill" value={billsToday} label={t('home.stat_bills')} />
      </View>
    </View>
  );
}

function Stat({ icon, tint, value, label }: { icon: IconName; tint: TintName; value: number; label: string }) {
  const { colors, tints, spacing, radius, shadow } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
      style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm, boxShadow: shadow.sm }}
    >
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: tints[tint].bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={16} tone={tints[tint].fg} />
      </View>
      <View>
        <Text variant="number" style={{ fontSize: 24, lineHeight: 28 }}>{value}</Text>
        <Text variant="caption" color="textSecondary">{label}</Text>
      </View>
    </PressableScale>
  );
}
