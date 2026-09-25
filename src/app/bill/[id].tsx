import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, TextInput, View } from 'react-native';

import { Mascot } from '@/components/brand/mascot';
import { Button, Chip, Field, FieldError, Sheet, Text, Toggle, useInputStyle } from '@/components/ui';
import type { RecurringBill } from '@/db';
import { categoryIcon } from '@/features/money/category-icon';
import { createBill, deleteBill, updateBill, useBill, useCategories, useWallets } from '@/features/money/queries';
import { currencySymbol, parseAmount, supportedCurrencies } from '@/lib/currency';
import { useAsyncAction } from '@/lib/use-async-action';
import { useConfirm } from '@/lib/use-confirm';
import { useTheme } from '@/theme';

const remindOptions = [1, 3, 7];

export default function BillScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { row, loaded } = useBill(isNew ? '' : id);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/money'));
  if (!isNew && !row) return loaded ? <NotFound onClose={close} /> : null;
  return <BillForm key={row?.id ?? 'new'} existing={row} onClose={close} />;
}

function BillForm({ existing, onClose }: { existing?: RecurringBill; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const input = useInputStyle();
  const wallets = useWallets();
  const categories = useCategories().filter((c) => c.type === 'expense');
  const { armed, confirm } = useConfirm();
  const { busy, failed, run } = useAsyncAction();
  const th = i18n.language === 'th';
  const locale = th ? 'th-TH' : 'en-GB';

  const [name, setName] = useState(existing?.name ?? '');
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [currency, setCurrency] = useState(existing?.currency ?? 'THB');
  const [walletId, setWalletId] = useState<string | null>(existing?.walletId ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
  const [frequency, setFrequency] = useState<'monthly' | 'yearly'>(existing?.frequency ?? 'monthly');
  const [dueDay, setDueDay] = useState(existing ? String(existing.dueDay) : String(new Date().getDate()));
  const [dueMonth, setDueMonth] = useState<number>(existing?.dueMonth ?? new Date().getMonth() + 1);
  const [remind, setRemind] = useState(existing?.remindDaysBefore ?? 3);
  const [isSubscription, setIsSubscription] = useState(existing?.isSubscription ?? false);
  const [showErrors, setShowErrors] = useState(false);

  const parsed = parseAmount(amount);
  const day = Number(dueDay);
  const walletOptions = wallets.filter((w) => w.currency === currency);
  const errors = {
    name: !name.trim() ? t('money.name_required') : null,
    amount: parsed === null || parsed <= 0 ? t('money.invalid_amount') : null,
    dueDay: !Number.isInteger(day) || day < 1 || day > 31 ? t('money.invalid_due_day') : null,
  };

  const save = () => {
    if (Object.values(errors).some(Boolean) || parsed === null) {
      setShowErrors(true);
      return;
    }
    const values = {
      name: name.trim(),
      amount: parsed,
      currency,
      walletId: walletOptions.some((w) => w.id === walletId) ? walletId : null,
      categoryId,
      dueDay: day,
      frequency,
      dueMonth: frequency === 'yearly' ? dueMonth : null,
      remindDaysBefore: remind,
      isSubscription,
    };
    void run(async () => {
      if (existing) await updateBill(existing, values);
      else await createBill(values);
      onClose();
    });
  };

  return (
    <Sheet
      wide="side"
      onClose={onClose}
      title={existing ? t('money.edit_bill') : t('money.add_bill')}
      footer={
        <View style={{ gap: spacing.sm }}>
          <FieldError message={failed ? t('common.save_failed') : null} />
          <Button fullWidth icon="check" label={t('common.save')} disabled={busy} onPress={save} />
          {existing ? (
            <Button
              fullWidth
              variant="ghost"
              icon="trash-2"
              label={armed ? t('tasks.delete_confirm') : t('common.delete')}
              disabled={busy}
              onPress={() => confirm(() => void run(async () => { await deleteBill(existing); onClose(); }))}
            />
          ) : null}
        </View>
      }
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl }}>
        <Field label={t('money.bill_name')} icon="file-text">
          <TextInput autoFocus={!existing} value={name} onChangeText={setName} placeholder={t('money.bill_name_placeholder')} placeholderTextColor={colors.textTertiary} accessibilityLabel={t('money.bill_name')} style={input(errors.name, showErrors)} />
          <FieldError message={showErrors ? errors.name : null} />
        </Field>

        <Field label={t('money.amount')} icon="dollar-sign">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {supportedCurrencies.map((c) => (
              <Chip key={c} label={`${currencySymbol(c)} ${c}`} selected={currency === c} onPress={() => setCurrency(c)} />
            ))}
          </View>
          <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textTertiary} accessibilityLabel={t('money.amount')} style={input(errors.amount, showErrors)} />
          <FieldError message={showErrors ? errors.amount : null} />
        </Field>

        <Field label={t('money.repeats')} icon="repeat">
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {(['monthly', 'yearly'] as const).map((f) => (
              <Chip key={f} label={t(`money.freq_${f}`)} selected={frequency === f} onPress={() => setFrequency(f)} />
            ))}
          </View>
          {frequency === 'yearly' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {Array.from({ length: 12 }, (_, i) => (
                <Chip key={i} label={new Date(2026, i, 1).toLocaleDateString(locale, { month: 'short' })} selected={dueMonth === i + 1} onPress={() => setDueMonth(i + 1)} />
              ))}
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Text variant="bodySm" style={{ flex: 1 }}>{t('money.due_day')}</Text>
            <TextInput value={dueDay} onChangeText={setDueDay} keyboardType="number-pad" maxLength={2} accessibilityLabel={t('money.due_day')} style={[input(errors.dueDay, showErrors), { width: 80, textAlign: 'center' }]} />
          </View>
          <FieldError message={showErrors ? errors.dueDay : null} />
        </Field>

        <Field label={t('money.pay_from')} icon="credit-card">
          {walletOptions.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {walletOptions.map((w) => (
                <Chip key={w.id} label={w.name} selected={walletId === w.id} onPress={() => setWalletId(walletId === w.id ? null : w.id)} />
              ))}
            </View>
          ) : (
            <Text variant="caption" color="textSecondary">{t('money.no_wallet', { currency })}</Text>
          )}
        </Field>

        <Field label={t('money.category')} icon="tag">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {categories.map((c) => (
              <Chip key={c.id} icon={categoryIcon(c.icon)} label={th ? c.nameTh : c.nameEn} selected={categoryId === c.id} onPress={() => setCategoryId(categoryId === c.id ? null : c.id)} />
            ))}
          </View>
        </Field>

        <Field label={t('money.remind')} icon="bell">
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {remindOptions.map((d) => (
              <Chip key={d} label={t('money.days_before', { count: d })} selected={remind === d} onPress={() => setRemind(d)} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 }}>
            <Text variant="bodySm" style={{ flex: 1 }}>{t('money.is_subscription')}</Text>
            <Toggle value={isSubscription} onValueChange={setIsSubscription} label={t('money.is_subscription')} />
          </View>
        </Field>
      </ScrollView>
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
