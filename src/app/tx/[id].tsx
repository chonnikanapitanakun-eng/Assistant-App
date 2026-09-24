import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, TextInput, View } from 'react-native';

import { Mascot } from '@/components/brand/mascot';
import { Button, Chip, Field, FieldError, PressableScale, Sheet, Text, useInputStyle } from '@/components/ui';
import type { Transaction } from '@/db';
import { categoryIcon } from '@/features/money/category-icon';
import { createTransaction, deleteTransaction, updateTransaction, useCategories, useTransaction, useWallets } from '@/features/money/queries';
import { isValidDate } from '@/features/tasks/model';
import { currencySymbol, parseAmount } from '@/lib/currency';
import { addDays, toDateKey } from '@/lib/date';
import { useConfirm } from '@/lib/use-confirm';
import { useTheme, type TintName } from '@/theme';

type Kind = Transaction['type'];
const kinds: { key: Kind; tint: TintName }[] = [
  { key: 'expense', tint: 'priorityHigh' },
  { key: 'income', tint: 'done' },
  { key: 'transfer', tint: 'priorityLow' },
];

export default function TransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { row, loaded } = useTransaction(isNew ? '' : id);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/money'));
  if (!isNew && !row) return loaded ? <NotFound onClose={close} /> : null;
  return <TransactionForm key={row?.id ?? 'new'} existing={row} onClose={close} />;
}

function TransactionForm({ existing, onClose }: { existing?: Transaction; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { colors, tints, spacing, radius, typography, fontFamily } = useTheme();
  const input = useInputStyle();
  const wallets = useWallets();
  const categories = useCategories();
  const { armed, confirm } = useConfirm();
  const th = i18n.language === 'th';

  const [kind, setKind] = useState<Kind>(existing?.type ?? 'expense');
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [walletId, setWalletId] = useState<string | null>(existing?.walletId ?? null);
  const [toWalletId, setToWalletId] = useState<string | null>(existing?.toWalletId ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
  const [date, setDate] = useState(existing?.date ?? toDateKey());
  const [note, setNote] = useState(existing?.note ?? '');
  const [showErrors, setShowErrors] = useState(false);

  // Wallets load asynchronously; fall back to the first one until the user picks.
  const from = wallets.find((w) => w.id === walletId) ?? wallets[0];
  const toOptions = wallets.filter((w) => w.id !== from?.id && w.currency === from?.currency);
  const to = toOptions.find((w) => w.id === toWalletId);
  const cats = categories.filter((c) => c.type === (kind === 'income' ? 'income' : 'expense'));
  const parsed = parseAmount(amount);

  const errors = {
    amount: parsed === null || parsed <= 0 ? t('money.invalid_amount') : null,
    wallet: !from ? t('money.need_account') : null,
    to: kind === 'transfer' && !to ? t('money.pick_destination') : null,
    date: !isValidDate(date) ? t('tasks.invalid_date') : null,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const save = () => {
    if (hasErrors || !from || parsed === null) {
      setShowErrors(true);
      return;
    }
    const values = {
      type: kind,
      amount: parsed,
      walletId: from.id,
      toWalletId: kind === 'transfer' ? (to?.id ?? null) : null,
      categoryId: kind === 'transfer' ? null : categoryId,
      date,
      note: note.trim() || null,
    };
    if (existing) updateTransaction(existing.id, values);
    else createTransaction(values);
    onClose();
  };

  const kindTint = tints[kinds.find((k) => k.key === kind)!.tint];

  return (
    <Sheet
      onClose={onClose}
      title={existing ? t('money.edit_transaction') : t('money.add')}
      footer={
        <View style={{ gap: spacing.sm }}>
          <Button fullWidth icon="check" label={t('common.save')} onPress={save} />
          {existing ? <Button fullWidth variant="ghost" icon="trash-2" label={armed ? t('tasks.delete_confirm') : t('common.delete')} onPress={() => confirm(() => (deleteTransaction(existing.id), onClose()))} /> : null}
        </View>
      }
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {kinds.map((k) => {
            const on = kind === k.key;
            const tint = tints[k.tint];
            return (
              <PressableScale
                key={k.key}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={t(`money.type_${k.key}`)}
                onPress={() => {
                  setKind(k.key);
                  setCategoryId(null);
                }}
                style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1.5, borderColor: on ? tint.fg : colors.border, backgroundColor: on ? tint.bg : 'transparent' }}
              >
                <Text variant="label" weight="semibold" tone={on ? tint.fg : colors.textSecondary}>{t(`money.type_${k.key}`)}</Text>
              </PressableScale>
            );
          })}
        </View>

        <View style={{ gap: spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, paddingHorizontal: spacing.lg, borderWidth: 1.5, borderColor: showErrors && errors.amount ? tints.priorityHigh.fg : colors.border }}>
            <Text variant="title" tone={kindTint.fg}>{currencySymbol(from?.currency ?? 'THB')}</Text>
            <TextInput
              autoFocus={!existing}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel={t('money.amount')}
              style={{ flex: 1, minWidth: 0, minHeight: 64, color: colors.text, fontSize: 32, fontFamily: fontFamily.bold, fontVariant: ['tabular-nums'] }}
            />
          </View>
          <FieldError message={showErrors ? errors.amount : null} />
        </View>

        <Field label={kind === 'transfer' ? t('money.from_account') : t('money.account')} icon="credit-card">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {wallets.map((w) => (
              <Chip key={w.id} label={`${w.name} · ${w.currency}`} selected={from?.id === w.id} onPress={() => setWalletId(w.id)} />
            ))}
          </View>
          <FieldError message={showErrors ? errors.wallet : null} />
        </Field>

        {kind === 'transfer' ? (
          <Field label={t('money.to_account')} icon="arrow-right">
            {toOptions.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {toOptions.map((w) => (
                  <Chip key={w.id} label={w.name} selected={to?.id === w.id} onPress={() => setToWalletId(w.id)} />
                ))}
              </View>
            ) : (
              <Text variant="caption" color="textSecondary">{t('money.no_same_currency')}</Text>
            )}
            <FieldError message={showErrors ? errors.to : null} />
          </Field>
        ) : (
          <Field label={t('money.category')} icon="tag">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {cats.map((c) => (
                <Chip key={c.id} icon={categoryIcon(c.icon)} label={th ? c.nameTh : c.nameEn} selected={categoryId === c.id} onPress={() => setCategoryId(categoryId === c.id ? null : c.id)} />
              ))}
            </View>
          </Field>
        )}

        <Field label={t('task.date')} icon="calendar">
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Chip label={t('capture.today')} selected={date === toDateKey()} onPress={() => setDate(toDateKey())} />
            <Chip label={t('tasks.yesterday')} selected={date === toDateKey(addDays(new Date(), -1))} onPress={() => setDate(toDateKey(addDays(new Date(), -1)))} />
          </View>
          <TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textTertiary} accessibilityLabel={t('task.date')} style={input(errors.date, showErrors)} />
          <FieldError message={showErrors ? errors.date : null} />
        </Field>

        <Field label={t('money.note')} icon="edit-3">
          <TextInput value={note} onChangeText={setNote} placeholder={t('money.note_placeholder')} placeholderTextColor={colors.textTertiary} accessibilityLabel={t('money.note')} style={[input(), { fontSize: typography.body.fontSize }]} />
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
