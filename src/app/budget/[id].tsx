import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';

import { Mascot } from '@/components/brand/mascot';
import { Button, Field, FieldError, Sheet, showToast, Text, useInputStyle } from '@/components/ui';
import type { Category } from '@/db';
import { BudgetBar } from '@/features/money/components/budget-bar';
import { spendingByCategory } from '@/features/money/model';
import { setBudget, useCategory, useTransactions } from '@/features/money/queries';
import { usePrimaryCurrency } from '@/features/profile/store';
import { currencySymbol, parseAmount } from '@/lib/currency';
import { toMonthKey } from '@/lib/date';
import { useAsyncAction } from '@/lib/use-async-action';
import { useConfirm } from '@/lib/use-confirm';
import { useDirty } from '@/lib/use-dirty';
import { useDraft } from '@/lib/use-draft';
import { useTheme } from '@/theme';

/** Monthly budget for one expense category (in the primary currency). */
export default function BudgetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { row, loaded } = useCategory(id);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/money'));
  // Budgets exist only for expense categories; anything else (bad link, deleted category) is "not found".
  if (!row || row.type !== 'expense') return loaded ? <NotFound onClose={close} /> : null;
  return <BudgetForm key={row.id} category={row} onClose={close} />;
}

function BudgetForm({ category, onClose }: { category: Category; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const input = useInputStyle();
  const txs = useTransactions();
  const budgetCurrency = usePrimaryCurrency();
  const draft = `budget:${category.id}`;
  const [amount, setAmount] = useDraft(`${draft}:amount`, category.budgetMonthly ? String(category.budgetMonthly) : '');
  const [showErrors, setShowErrors] = useState(false);
  const { busy, failed, run } = useAsyncAction();
  const { armed, confirm } = useConfirm();
  const dirty = useDirty(amount);
  const spent = spendingByCategory(txs, toMonthKey(), budgetCurrency).find((r) => r.categoryId === category.id)?.total ?? 0;
  const parsed = parseAmount(amount);
  const error = parsed === null || parsed <= 0 ? t('money.invalid_amount') : null;
  const name = i18n.language === 'th' ? category.nameTh : category.nameEn;

  const save = () => {
    if (error || parsed === null) {
      setShowErrors(true);
      return;
    }
    void run(async () => {
      await setBudget(category.id, parsed);
      showToast(t('common.saved'), undefined, 'success');
      onClose();
    });
  };

  return (
    <Sheet
      onClose={onClose}
      dirty={dirty}
      title={t('money.budget_for', { name })}
      subtitle={t('money.budget_currency_note', { currency: budgetCurrency })}
      footer={
        <View style={{ gap: spacing.sm }}>
          <FieldError message={failed ? t('common.save_failed') : null} />
          <Button fullWidth icon="check" label={t('common.save')} disabled={busy} onPress={save} />
          {category.budgetMonthly ? (
            <Button fullWidth variant="ghost" icon="x-circle" label={armed ? t('money.remove_budget_confirm') : t('money.remove_budget')} disabled={busy} onPress={() => confirm(() => void run(async () => { await setBudget(category.id, null); onClose(); }))} />
          ) : null}
        </View>
      }
    >
      <View style={{ padding: spacing.xl, gap: spacing.xl }}>
        <Field label={t('money.monthly_budget')} icon="target">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text variant="title" color="textSecondary">{currencySymbol(budgetCurrency)}</Text>
            <TextInput autoFocus value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textTertiary} accessibilityLabel={t('money.monthly_budget')} style={[input(error, showErrors), { flex: 1 }]} />
          </View>
          <FieldError message={showErrors ? error : null} />
        </Field>
        <Field label={t('money.this_month')} icon="bar-chart-2">
          {parsed && parsed > 0 ? <BudgetBar spent={spent} budget={parsed} /> : <Text variant="bodySm" color="textSecondary">{t('money.spent_so_far', { amount: `${currencySymbol(budgetCurrency)}${spent.toLocaleString('en-GB')}` })}</Text>}
        </Field>
      </View>
    </Sheet>
  );
}

function NotFound({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  return (
    <Sheet onClose={onClose}>
      <View style={{ alignItems: 'center', gap: spacing.md, padding: spacing.xxl }}>
        <Mascot pose="search" size={104} />
        <Text variant="heading" align="center">{t('money.not_found')}</Text>
        <Button label={t('common.close')} variant="secondary" onPress={onClose} />
      </View>
    </Sheet>
  );
}
