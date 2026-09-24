import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon, PressableScale, Text, type IconName } from '@/components/ui';
import { useEventsBetween } from '@/features/calendar/queries';
import { billState, nextDueDate } from '@/features/money/model';
import { useBills } from '@/features/money/queries';
import { useProfile } from '@/features/profile/store';
import { useAllTasks } from '@/features/tasks/queries';
import { addDays, greetingKey, toDateKey } from '@/lib/date';
import { useBreakpoint, useTheme, type TintName } from '@/theme';


export function Greeting() {
  const { t, i18n } = useTranslation();
  const { spacing } = useTheme();
  const { isMobile } = useBreakpoint();
  // Drop trailing punctuation so "Proud A." doesn't become "Proud A..".
  const name = useProfile((p) => p.name).replace(/[.!?。]+$/, '');
  const interests = useProfile((p) => p.interests);
  const today = toDateKey();
  const now = new Date();
  const meetings = useEventsBetween(today, toDateKey(addDays(now, 1))).length;
  const billsToday = useBills().filter((b) => ['overdue', 'today'].includes(billState(nextDueDate(b), b.remindDaysBefore).state)).length;
  const tasksToday = useAllTasks().filter((x) => !x.isDone && x.date === today).length;
  const date = now.toLocaleDateString(i18n.language === 'th' ? 'th-TH' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const emoji = greetingKey(now) === 'greeting_evening' ? '🌙' : '☀️';
  // Summary mentions only the areas shown on Home.
  const parts = [
    interests.includes('calendar') ? t('home.part_events', { count: meetings }) : null,
    interests.includes('tasks') ? t('home.part_tasks', { count: tasksToday }) : null,
    interests.includes('money') ? t('home.part_bills', { count: billsToday }) : null,
  ].filter((x): x is string => !!x);

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.xs }}>
        <Text variant="overline" color="textSecondary">{date.toUpperCase()}</Text>
        <Text variant={isMobile ? 'title' : 'display'} accessibilityRole="header">
          {name ? `${t(`today.${greetingKey(now)}`)}, ${name}.` : `${t(`today.${greetingKey(now)}`)}.`} {emoji}
        </Text>
        {parts.length ? (
          <Text variant="body" color="textSecondary">
            {t('home.summary_list', { list: joinList(parts, t('home.list_sep'), t('home.list_and')) })}
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {interests.includes('calendar') ? <Stat icon="users" tint="meeting" value={meetings} label={t('home.stat_meetings')} /> : null}
        {interests.includes('tasks') ? <Stat icon="check-circle" tint="priorityLow" value={tasksToday} label={t('home.stat_tasks')} /> : null}
        {interests.includes('money') ? <Stat icon="file-text" tint="bill" value={billsToday} label={t('home.stat_bills')} /> : null}
      </View>
    </View>
  );
}

/** "a", "a and b", "a, b and c" (separator and conjunction come from the locale). */
function joinList(items: string[], sep: string, and: string): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(sep)}${and}${items[items.length - 1]}`;
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
