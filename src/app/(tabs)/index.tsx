import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Card, Screen, Text } from '@/components/ui';
import { useTodayMoney } from '@/features/money/queries';
import { NotificationPermissionBanner } from '@/features/notifications';
import { useTasksForDate } from '@/features/tasks/queries';
import { formatMoney } from '@/lib/currency';
import { greetingKey, toDateKey } from '@/lib/date';

export default function TodayScreen() {
  const { t } = useTranslation();
  const today = toDateKey();
  const tasks = useTasksForDate(today);
  const money = useTodayMoney(today);
  const remaining = tasks.filter((x) => !x.isDone).length;

  return (
    <Screen>
      <Text variant="title">{t(`today.${greetingKey()}`)}</Text>
      <Text color="textSecondary">{today}</Text>

      <NotificationPermissionBanner />

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card style={{ flex: 1 }}>
          <Text variant="caption" color="textSecondary">{t('today.tasks_left')}</Text>
          <Text variant="title">{remaining}</Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text variant="caption" color="textSecondary">{t('today.spent_today')}</Text>
          <Text variant="title" color="expense">{formatMoney(money.today)}</Text>
        </Card>
      </View>

      <Card>
        <Text variant="caption" color="textSecondary">{t('today.spent_month')}</Text>
        <Text variant="heading">{formatMoney(money.month)}</Text>
      </Card>

      {tasks.length === 0 ? (
        <Text color="textSecondary" style={{ textAlign: 'center', marginTop: 24 }}>{t('today.empty')}</Text>
      ) : (
        tasks.map((task) => (
          <Card key={task.id}>
            <Text style={task.isDone ? { textDecorationLine: 'line-through' } : undefined}>{task.title}</Text>
            {task.startTime ? <Text variant="caption" color="textSecondary">{task.startTime}{task.endTime ? ` – ${task.endTime}` : ''}</Text> : null}
          </Card>
        ))
      )}
    </Screen>
  );
}
