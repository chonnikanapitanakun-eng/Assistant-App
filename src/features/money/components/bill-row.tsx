import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Icon, PressableScale, Tag, Text } from '@/components/ui';
import type { Category, RecurringBill } from '@/db';
import { formatMoney } from '@/lib/currency';
import { toDateKey } from '@/lib/date';
import { useAsyncAction } from '@/lib/use-async-action';
import { useTheme, type TintName } from '@/theme';

import { categoryIcon } from '../category-icon';
import { billState, nextDueDate } from '../model';
import { markBillPaid, undoBillPaid } from '../queries';

const stateTint: Record<'overdue' | 'today' | 'soon', TintName> = { overdue: 'priorityHigh', today: 'priorityMedium', soon: 'priorityLow' };

/**
 * Bill with its next due date and a one-tap "Mark paid". Undo comes from the bill's own
 * data (paid today), so it survives the row moving to another group after paying.
 */
export function BillRow({ bill, category, compact }: { bill: RecurringBill; category?: Category; compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const { tints, spacing } = useTheme();
  const [noWallet, setNoWallet] = useState(false);
  // One action at a time: a double tap on "Mark paid" must not record two payments.
  const { busy, failed, run } = useAsyncAction();
  // `updateBill` clears lastPaymentId, so a later edit can't revive Paid/Undo for an old payment.
  const justPaid = !!bill.lastPaymentId && toDateKey(new Date(bill.updatedAt)) === toDateKey();

  const due = nextDueDate(bill);
  const { state, days } = billState(due, bill.remindDaysBefore);
  const dueLabel =
    state === 'overdue'
      ? t('money.overdue_days', { count: -days })
      : state === 'today'
        ? t('home.due_today')
        : days === 1
          ? t('money.due_tomorrow')
          : t('money.due_on', { date: new Date(`${due}T00:00:00`).toLocaleDateString(i18n.language === 'th' ? 'th-TH' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) });

  const pay = () => void run(async () => setNoWallet(!(await markBillPaid(bill))));
  const undo = () => void run(() => undoBillPaid(bill));

  return (
    <View style={{ gap: spacing.sm, paddingVertical: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${bill.name}, ${formatMoney(bill.amount, bill.currency, 'en-GB')}, ${dueLabel}`}
          onPress={() => router.push({ pathname: '/bill/[id]', params: { id: bill.id } })}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48 }}
        >
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: tints.bill.bg, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={bill.isSubscription ? 'repeat' : categoryIcon(category?.icon)} size={18} tone={tints.bill.fg} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text variant="subheading" numberOfLines={1}>{bill.name}</Text>
            {justPaid ? (
              <Tag label={t('money.paid')} tint="done" icon="check" />
            ) : state === 'later' ? (
              <Text variant="caption" color="textSecondary">{dueLabel}</Text>
            ) : (
              <Tag label={dueLabel} tint={stateTint[state]} icon={state === 'overdue' ? 'alert-circle' : 'clock'} />
            )}
          </View>
          <Text variant="subheading" weight="bold" style={{ fontVariant: ['tabular-nums'] }}>{formatMoney(bill.amount, bill.currency, 'en-GB')}</Text>
        </PressableScale>
      </View>
      {!compact || state !== 'later' || justPaid ? (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm }}>
          {justPaid ? (
            <Button size="sm" variant="ghost" icon="rotate-ccw" label={t('money.undo')} disabled={busy} onPress={undo} />
          ) : (
            <Button size="sm" variant="secondary" icon="check" label={t('money.mark_paid')} disabled={busy} onPress={pay} accessibilityHint={t('money.mark_paid_hint')} />
          )}
        </View>
      ) : null}
      {failed ? <Text variant="caption" tone={tints.priorityHigh.fg}>{t('common.save_failed')}</Text> : null}
      {noWallet ? <Text variant="caption" tone={tints.priorityHigh.fg}>{t('money.no_wallet', { currency: bill.currency })}</Text> : null}
    </View>
  );
}
