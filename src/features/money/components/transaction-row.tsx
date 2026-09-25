import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon, PressableScale, showToast, SwipeRow, Text } from '@/components/ui';
import type { Category, Transaction } from '@/db';
import { background } from '@/lib/background';
import { formatMoney } from '@/lib/currency';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme';

import { categoryIcon } from '../category-icon';
import { deleteTransaction, restoreTransaction } from '../queries';

type Props = { tx: Transaction; category?: Category; walletName?: string; toWalletName?: string };

export function TransactionRow({ tx, category, walletName, toWalletName }: Props) {
  const { t, i18n } = useTranslation();
  const { colors, tints, spacing } = useTheme();
  const catName = category ? (i18n.language === 'th' ? category.nameTh : category.nameEn) : undefined;
  const isTransfer = tx.type === 'transfer';
  const tint = isTransfer ? { bg: colors.surfaceMuted, fg: colors.textSecondary } : tx.type === 'income' ? tints.done : tints.priorityHigh;
  const title = tx.note || catName || t(`capture.type_${isTransfer ? 'expense' : tx.type}`);
  const sub = isTransfer ? `${walletName ?? ''} → ${toWalletName ?? ''}` : [catName && tx.note ? catName : null, walletName].filter(Boolean).join(' · ');
  const sign = tx.type === 'income' ? '+' : isTransfer ? '' : '−';
  const amount = `${sign}${formatMoney(tx.amount, tx.currency, 'en-GB')}`;

  const remove = () => {
    haptic.warning();
    background(deleteTransaction(tx.id), 'Delete transaction');
    showToast(t('money.deleted_toast', { title }), { label: t('common.undo'), onPress: () => background(restoreTransaction(tx.id), 'Restore transaction') });
  };

  return (
    <SwipeRow actions={[{ key: 'delete', icon: 'trash-2', label: t('common.delete'), bg: tints.priorityHigh.fg, fg: colors.onPrimary, onPress: remove }]}>
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${t(`money.type_${tx.type}`)} ${formatMoney(tx.amount, tx.currency, 'en-GB')}`}
      onPress={() => router.push({ pathname: '/tx/[id]', params: { id: tx.id } })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingVertical: spacing.sm }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: tint.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={isTransfer ? 'repeat' : categoryIcon(category?.icon)} size={18} tone={tint.fg} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="subheading" numberOfLines={1}>{title}</Text>
        {sub ? <Text variant="caption" color="textSecondary" numberOfLines={1}>{sub}</Text> : null}
      </View>
      <Text variant="subheading" weight="bold" color={tx.type === 'income' ? 'income' : isTransfer ? 'textSecondary' : 'expense'} style={{ fontVariant: ['tabular-nums'] }}>
        {amount}
      </Text>
    </PressableScale>
    </SwipeRow>
  );
}
