import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Mascot } from '@/components/brand/mascot';
import { Card, Chip, Icon, IconButton, PressableScale, Screen, Text, type IconName } from '@/components/ui';
import { NotificationPermissionBanner } from '@/features/notifications';
import { ProgressCard } from '@/features/tasks/components/progress-card';
import { TaskRow } from '@/features/tasks/components/task-row';
import { groupTasks, todayProgress, type Energy, type SectionKey, type TaskFilter } from '@/features/tasks/model';
import { useAllTasks, useAreas } from '@/features/tasks/queries';
import { toDateKey } from '@/lib/date';
import { useTheme } from '@/theme';

const filters: TaskFilter[] = ['all', 'today', 'upcoming', 'done'];
const energies: { key: Energy; icon: IconName }[] = [
  { key: 'low', icon: 'battery' },
  { key: 'med', icon: 'battery-charging' },
  { key: 'high', icon: 'zap' },
];

export default function TasksScreen() {
  const { t, i18n } = useTranslation();
  const { colors, tints, spacing, motion } = useTheme();
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [energy, setEnergy] = useState<Energy | null>(null);
  const today = toDateKey();
  const tasks = useAllTasks();
  const areas = useAreas();

  const areaName = useMemo(() => {
    const th = i18n.language === 'th';
    return new Map(areas.map((a) => [a.id, th ? a.nameTh : a.nameEn]));
  }, [areas, i18n.language]);
  const sections = useMemo(() => groupTasks(energy ? tasks.filter((x) => x.energy === energy) : tasks, today, filter), [tasks, today, filter, energy]);
  const progress = todayProgress(tasks, today);
  const hasTimed = tasks.some((x) => !x.isDone && x.startTime);

  const sectionTone = (key: SectionKey) => (key === 'overdue' ? tints.priorityHigh.fg : colors.textSecondary);

  return (
    <Screen maxWidth={880}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="title" accessibilityRole="header" style={{ flex: 1 }}>{t('nav.tasks')}</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <IconButton icon="repeat" label={t('routines.title')} onPress={() => router.push('/routines')} />
          <IconButton icon="plus" label={t('tasks.add')} color="primary" filled onPress={() => router.push({ pathname: '/task/[id]', params: { id: 'new' } })} />
        </View>
      </View>

      <ProgressCard done={progress.done} total={progress.total} />

      {hasTimed ? <NotificationPermissionBanner /> : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {filters.map((f) => (
          <Chip key={f} label={t(`tasks.filter_${f}`)} selected={filter === f} onPress={() => setFilter(f)} />
        ))}
        <View style={{ width: 1, alignSelf: 'stretch', marginVertical: spacing.sm, backgroundColor: colors.border }} />
        {energies.map((e) => (
          <Chip
            key={e.key}
            icon={e.icon}
            label={t(`task.energy_${e.key}`)}
            selected={energy === e.key}
            onPress={() => setEnergy(energy === e.key ? null : e.key)}
          />
        ))}
      </ScrollView>

      {filter !== 'done' ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('tasks.add')}
          onPress={() => router.push({ pathname: '/task/[id]', params: filter === 'upcoming' ? { id: 'new', date: '' } : { id: 'new', date: today } })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, paddingHorizontal: spacing.lg, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderStrong }}
        >
          <Icon name="plus" size={18} />
          <Text variant="label" color="textSecondary">{t('tasks.add_placeholder')}</Text>
        </PressableScale>
      ) : null}

      {sections.length === 0 ? (
        <Animated.View entering={FadeIn.duration(motion.base)} style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxxl }}>
          <Mascot pose={filter === 'done' ? 'thinking' : 'calm'} size={112} />
          <Text variant="heading" align="center">{energy ? t('tasks.empty_energy_title') : t(`tasks.empty_${filter}_title`)}</Text>
          <Text variant="bodySm" color="textSecondary" align="center">{energy ? t('tasks.empty_energy_body') : t(`tasks.empty_${filter}_body`)}</Text>
        </Animated.View>
      ) : (
        sections.map((section) => (
          <Animated.View key={section.key} entering={FadeIn.duration(motion.base)} style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xs }}>
              {section.key === 'overdue' ? <Icon name="alert-circle" size={14} tone={sectionTone(section.key)} /> : null}
              <Text variant="overline" tone={sectionTone(section.key)} accessibilityRole="header">
                {t(`tasks.section_${section.key}`).toUpperCase()}
              </Text>
              <Text variant="overline" color="textTertiary">{section.tasks.length}</Text>
            </View>
            <Card padding="md" style={{ gap: 0, paddingVertical: spacing.xs }}>
              {section.tasks.map((task, i) => (
                <View key={task.id} style={i ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined}>
                  <TaskRow
                    task={task}
                    areaName={task.areaId ? areaName.get(task.areaId) : undefined}
                    showDate={section.key !== 'today'}
                    overdue={section.key === 'overdue'}
                  />
                </View>
              ))}
            </Card>
          </Animated.View>
        ))
      )}
    </Screen>
  );
}
