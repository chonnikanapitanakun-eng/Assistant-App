import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Card, Icon, PressableScale, SectionHeader, Tag, Text } from '@/components/ui';
import { useTheme } from '@/theme';

import { attentionTasks, priorityTint, tasksToday, type HomeTask } from '../mock';

export function AttentionTasks() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const [done, setDone] = useState<Record<string, boolean>>({});

  return (
    <Card>
      <SectionHeader title={t('home.needs_attention')} action={t('home.all_tasks', { count: tasksToday })} onAction={() => router.navigate('/tasks')} />
      <View style={{ gap: spacing.xs }}>
        {attentionTasks.map((task) => (
          <TaskRow key={task.id} task={task} done={!!done[task.id]} onToggle={() => setDone((d) => ({ ...d, [task.id]: !d[task.id] }))} />
        ))}
      </View>
    </Card>
  );
}

function TaskRow({ task, done, onToggle }: { task: HomeTask; done: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const { colors, tints, spacing, touchTarget } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <PressableScale
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={task.title}
        onPress={onToggle}
        style={{ width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center', marginLeft: -spacing.sm }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: 2,
            borderColor: done ? colors.success : colors.borderStrong,
            backgroundColor: done ? colors.success : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {done ? <Icon name="check" size={13} tone={colors.onPrimary} /> : null}
        </View>
      </PressableScale>
      <View style={{ flex: 1, gap: 2, paddingVertical: spacing.xs }}>
        <Text variant="subheading" color={done ? 'textTertiary' : 'text'} style={done ? { textDecorationLine: 'line-through' } : undefined}>
          {task.title}
        </Text>
        <Text variant="caption" tone={task.overdue && !done ? tints.priorityHigh.fg : colors.textSecondary}>
          {task.due}{task.project ? ` · ${task.project}` : ''}
        </Text>
      </View>
      {done ? <Tag label={t('home.done')} tint="done" /> : <Tag label={t(`home.priority_${task.priority}`)} tint={priorityTint[task.priority]} />}
    </View>
  );
}
