import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon, PressableScale, Tag, Text } from '@/components/ui';
import type { Task } from '@/db';
import { background } from '@/lib/background';
import { daysFromToday } from '@/lib/date';
import { useTheme } from '@/theme';

import { priorityLevel, priorityTint } from '../model';
import { toggleTaskDone } from '../queries';

type Props = { task: Task; areaName?: string; showDate?: boolean; overdue?: boolean };

export function TaskRow({ task, areaName, showDate, overdue }: Props) {
  const { t, i18n } = useTranslation();
  const { colors, tints, spacing, radius, touchTarget } = useTheme();
  const level = priorityLevel(task.priority);
  const checklist = task.checklist ?? [];
  const checked = checklist.filter((c) => c.done).length;

  const when = [
    showDate && task.date ? relativeDay(task.date, t, i18n.language) : null,
    task.startTime ? (task.endTime ? `${task.startTime}–${task.endTime}` : task.startTime) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.lg }}>
      <PressableScale
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.isDone }}
        accessibilityLabel={t('tasks.toggle_done', { title: task.title })}
        onPress={() => background(toggleTaskDone(task), 'Toggle task')}
        style={{ width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: 2,
            borderColor: task.isDone ? colors.success : level === 'high' ? tints.priorityHigh.fg : colors.borderStrong,
            backgroundColor: task.isDone ? colors.success : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {task.isDone ? <Icon name="check" size={13} tone={colors.onPrimary} /> : null}
        </View>
      </PressableScale>

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('tasks.open', { title: task.title })}
        onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: touchTarget + 8, paddingVertical: spacing.sm, paddingRight: spacing.xs }}
      >
        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="subheading" color={task.isDone ? 'textTertiary' : 'text'} style={task.isDone ? { textDecorationLine: 'line-through' } : undefined} numberOfLines={2}>
            {task.title}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.md, rowGap: 2 }}>
            {when ? <Meta icon="clock" label={when} tone={overdue && !task.isDone ? tints.priorityHigh.fg : undefined} /> : null}
            {areaName ? <Meta icon="folder" label={areaName} /> : null}
            {checklist.length ? <Meta icon="check-square" label={`${checked}/${checklist.length}`} /> : null}
            {task.energy ? <Meta icon={task.energy === 'high' ? 'zap' : 'battery'} label={t(`task.energy_${task.energy}`)} /> : null}
            {task.reminderNotificationId || (task.reminderAt && !task.isDone) ? <Meta icon="bell" label="" /> : null}
          </View>
        </View>
        {!task.isDone && level !== 'medium' ? <Tag label={t(`home.priority_${level}`)} tint={priorityTint[level]} /> : null}
      </PressableScale>
    </View>
  );
}

function Meta({ icon, label, tone }: { icon: 'clock' | 'folder' | 'check-square' | 'zap' | 'battery' | 'bell'; label: string; tone?: string }) {
  const { colors } = useTheme();
  const c = tone ?? colors.textSecondary;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Icon name={icon} size={12} tone={c} />
      {label ? <Text variant="caption" tone={c}>{label}</Text> : null}
    </View>
  );
}

type T = (key: string) => string;

export function relativeDay(date: string, t: T, lang: string): string {
  const diff = daysFromToday(date);
  if (diff === 0) return t('capture.today');
  if (diff === 1) return t('capture.tomorrow');
  if (diff === -1) return t('tasks.yesterday');
  return new Date(`${date}T00:00:00`).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
