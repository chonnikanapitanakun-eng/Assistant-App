import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Card, SectionHeader, Text } from '@/components/ui';
import { BillRow } from '@/features/money/components/bill-row';
import { nextDueDate } from '@/features/money/model';
import { useBills, useCategories } from '@/features/money/queries';
import { useTheme } from '@/theme';

/** Next three bills (live), payable in one tap. */
export function Bills() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const bills = useBills();
  const categories = useCategories();
  const upcoming = [...bills].sort((a, b) => nextDueDate(a).localeCompare(nextDueDate(b))).slice(0, 3);
  return (
    <Card>
      <SectionHeader title={t('home.upcoming_bills')} action={t('home.open_money')} onAction={() => router.navigate('/money')} />
      {upcoming.length ? (
        <View>
          {upcoming.map((b, i) => (
            <View key={b.id} style={i ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined}>
              <BillRow bill={b} category={categories.find((c) => c.id === b.categoryId)} compact />
            </View>
          ))}
        </View>
      ) : (
        <Text variant="bodySm" color="textSecondary">{t('money.no_bills')}</Text>
      )}
    </Card>
  );
}
