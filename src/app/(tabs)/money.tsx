import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Card, Screen, Text } from '@/components/ui';
import { useMonthSummary, useWallets } from '@/features/money/queries';
import { formatMoney } from '@/lib/currency';
import { toMonthKey } from '@/lib/date';
import { useTheme } from '@/theme';

export default function MoneyScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const wallets = useWallets();
  const summary = useMonthSummary(toMonthKey());

  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">{t('nav.money')}</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card style={{ flex: 1 }}>
          <Text variant="caption" color="textSecondary">{t('money.income')}</Text>
          <Text variant="heading" color="income">{formatMoney(summary.income)}</Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text variant="caption" color="textSecondary">{t('money.expense')}</Text>
          <Text variant="heading" color="expense">{formatMoney(summary.expense)}</Text>
        </Card>
      </View>
      <Text variant="heading">{t('money.wallets')}</Text>
      {wallets.map((w) => (
        <Card key={w.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: w.color ?? colors.textTertiary }} />
            <Text>{w.name}</Text>
          </View>
          <Text variant="heading">{formatMoney(w.balance, w.currency)}</Text>
        </Card>
      ))}
    </Screen>
  );
}
