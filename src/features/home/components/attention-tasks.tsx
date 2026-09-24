import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Mascot } from '@/components/brand/mascot';
import { Card, SectionHeader, Text } from '@/components/ui';
import { TaskRow } from '@/features/tasks/components/task-row';
import { attentionTasks } from '@/features/tasks/model';
import { useAllTasks, useAreas } from '@/features/tasks/queries';
import { toDateKey } from '@/lib/date';
import { useTheme } from '@/theme';

/** Overdue + today's most important open tasks (live data). */
export function AttentionTasks() {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const today = toDateKey();
  const tasks = useAllTasks();
  const areas = useAreas();
  const areaName = useMemo(() => new Map(areas.map((a) => [a.id, i18n.language === 'th' ? a.nameTh : a.nameEn])), [areas, i18n.language]);
  const items = attentionTasks(tasks, today);
  const openToday = tasks.filter((x) => !x.isDone && x.date === today).length;

  return (
    <Card>
      <SectionHeader title={t('home.needs_attention')} action={t('home.all_tasks', { count: openToday })} onAction={() => router.navigate('/tasks')} />
      {items.length ? (
        <View>
          {items.map((task, i) => (
            <View key={task.id} style={i ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined}>
              <TaskRow task={task} areaName={task.areaId ? areaName.get(task.areaId) : undefined} showDate={task.date !== today} overdue={!!task.date && task.date < today} />
            </View>
          ))}
        </View>
      ) : (
        <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Mascot pose="success" size={56} />
          <View style={{ flex: 1 }}>
            <Text variant="subheading">{t('home.all_caught_up')}</Text>
            <Text variant="caption" color="textSecondary">{t('home.all_caught_up_body')}</Text>
          </View>
        </View>
      )}
    </Card>
  );
}
