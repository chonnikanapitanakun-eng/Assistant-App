import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Card, Text } from '@/components/ui';
import type { Task } from '@/db';
import { useTasksInRange } from '@/features/tasks/queries';
import { weekDays } from '@/lib/calendar';
import { toDateKey } from '@/lib/date';
import { useTheme } from '@/theme';

import { formatDate } from './format';

/** 7 วัน จันทร์–อาทิตย์ แต่ละวันแสดงรายการงาน กดวันเพื่อเปิดมุมมองวัน */
export function WeekView({ date, onSelectDay }: { date: string; onSelectDay: (date: string) => void }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const days = weekDays(date);
  const tasks = useTasksInRange(days[0], days[6]);
  const today = toDateKey();

  return (
    <View style={{ gap: spacing.sm }}>
      {days.map((d) => {
        const dayTasks = tasks.filter((x) => x.date === d);
        return (
          <Pressable key={d} onPress={() => onSelectDay(d)} accessibilityRole="button">
            <Card style={d === today ? { borderColor: colors.primary, borderWidth: 2 } : undefined}>
              <Text variant="caption" color={d === today ? 'primary' : 'textSecondary'} style={{ fontWeight: '600' }}>
                {formatDate(d, i18n.language, { weekday: 'long', day: 'numeric', month: 'short' })}
              </Text>
              {dayTasks.length === 0 ? (
                <Text variant="caption" color="textSecondary">{t('plan.no_tasks')}</Text>
              ) : (
                dayTasks.map((task) => <TaskLine key={task.id} task={task} />)
              )}
            </Card>
          </Pressable>
        );
      })}
    </View>
  );
}

function TaskLine({ task }: { task: Task }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: task.color ?? colors.primary }} />
      <Text variant="caption" color="textSecondary" style={{ width: 44 }}>{task.startTime ?? '—'}</Text>
      <Text style={[{ flex: 1 }, task.isDone ? { textDecorationLine: 'line-through', opacity: 0.6 } : null]} numberOfLines={1}>
        {task.title}
      </Text>
    </View>
  );
}
