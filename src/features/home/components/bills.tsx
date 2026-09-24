import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Card, Icon, SectionHeader, Tag, Text } from '@/components/ui';
import { formatMoney } from '@/lib/currency';
import { useTheme } from '@/theme';

import { bills } from '../mock';

export function Bills() {
  const { t } = useTranslation();
  const { tints, spacing } = useTheme();
  return (
    <Card>
      <SectionHeader title={t('home.upcoming_bills')} action={t('home.open_money')} onAction={() => router.navigate('/money')} />
      <View style={{ gap: spacing.md }}>
        {bills.map((b) => (
          <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: tints.bill.bg, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={b.icon} size={18} tone={tints.bill.fg} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="subheading">{b.name}</Text>
              {b.dueToday ? <Tag label={t('home.due_today')} tint="priorityMedium" /> : <Text variant="caption" color="textSecondary">{b.due}</Text>}
            </View>
            <Text variant="subheading" weight="bold" style={{ fontVariant: ['tabular-nums'] }}>{formatMoney(b.amount, b.currency, 'en-GB')}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
