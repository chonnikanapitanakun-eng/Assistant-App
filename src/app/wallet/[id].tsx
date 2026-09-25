import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, TextInput, View } from 'react-native';

import { Mascot } from '@/components/brand/mascot';
import { Button, Chip, Field, FieldError, Sheet, Text, useInputStyle } from '@/components/ui';
import type { Wallet } from '@/db';
import { walletIcon } from '@/features/money/category-icon';
import { walletBalance } from '@/features/money/model';
import { BANKS } from '@/features/slip/banks';
import { createWallet, deleteWallet, updateWallet, useTransactions, useWallet } from '@/features/money/queries';
import { currencySymbol, formatMoney, parseAmount, supportedCurrencies } from '@/lib/currency';
import { useAsyncAction } from '@/lib/use-async-action';
import { useDraft } from '@/lib/use-draft';
import { useConfirm } from '@/lib/use-confirm';
import { useTheme } from '@/theme';

const types: Wallet['type'][] = ['cash', 'bank', 'card', 'investment'];

export default function WalletScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { row, loaded } = useWallet(isNew ? '' : id);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/money'));
  if (!isNew && !row) return loaded ? <NotFound onClose={close} /> : null;
  return <WalletForm key={row?.id ?? 'new'} existing={row} onClose={close} />;
}

function WalletForm({ existing, onClose }: { existing?: Wallet; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const input = useInputStyle();
  const txs = useTransactions();
  const { armed, confirm } = useConfirm();
  const { busy, failed, run } = useAsyncAction();

  const draft = `wallet:${existing?.id ?? 'new'}`;
  const [name, setName] = useDraft(`${draft}:name`, existing?.name ?? '');
  const [type, setType] = useDraft<Wallet['type']>(`${draft}:type`, existing?.type ?? 'bank');
  const [currency, setCurrency] = useDraft(`${draft}:currency`, existing?.currency ?? 'THB');
  const [opening, setOpening] = useDraft(`${draft}:opening`, existing ? String(existing.balance) : '0');
  const [bankCode, setBankCode] = useDraft<string | null>(`${draft}:bankCode`, existing?.bankCode ?? null);
  const [accountDigits, setAccountDigits] = useDraft(`${draft}:accountDigits`, existing?.accountDigits ?? '');
  const [showErrors, setShowErrors] = useState(false);

  const hasHistory = !!existing && txs.some((x) => x.walletId === existing.id || x.toWalletId === existing.id);
  const parsed = parseAmount(opening);
  const errors = { name: !name.trim() ? t('money.name_required') : null, opening: parsed === null ? t('money.invalid_amount') : null };

  const save = () => {
    if (Object.values(errors).some(Boolean) || parsed === null) {
      setShowErrors(true);
      return;
    }
    // Bank details only mean something for THB bank / card accounts (they match Thai slips).
    const linkable = currency === 'THB' && (type === 'bank' || type === 'card');
    const digits = accountDigits.replace(/\D/g, '');
    const values = { name: name.trim(), type, currency, balance: parsed, bankCode: linkable ? bankCode : null, accountDigits: linkable && digits.length >= 3 ? digits : null };
    void run(async () => {
      if (existing) await updateWallet(existing.id, values);
      else await createWallet(values);
      onClose();
    });
  };

  return (
    <Sheet
      onClose={onClose}
      title={existing ? t('money.edit_account') : t('money.add_account')}
      subtitle={existing ? t('money.current_balance', { amount: formatMoney(walletBalance(existing, txs), existing.currency, 'en-GB') }) : undefined}
      footer={
        <View style={{ gap: spacing.sm }}>
          <FieldError message={failed ? t('common.save_failed') : null} />
          <Button fullWidth icon="check" label={t('common.save')} disabled={busy} onPress={save} />
          {existing ? (
            <Button
              fullWidth
              variant="ghost"
              icon="eye-off"
              label={armed ? t('tasks.delete_confirm') : t('money.hide_account')}
              accessibilityHint={t('money.hide_account_hint')}
              disabled={busy}
              onPress={() => confirm(() => void run(async () => { await deleteWallet(existing.id); onClose(); }))}
            />
          ) : null}
        </View>
      }
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl }}>
        <Field label={t('money.account_name')} icon="credit-card">
          <TextInput autoFocus={!existing} value={name} onChangeText={setName} placeholder={t('money.account_name_placeholder')} placeholderTextColor={colors.textTertiary} accessibilityLabel={t('money.account_name')} style={input(errors.name, showErrors)} />
          <FieldError message={showErrors ? errors.name : null} />
        </Field>

        <Field label={t('money.account_type')} icon="layers">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {types.map((ty) => (
              <Chip key={ty} icon={walletIcon[ty]} label={t(`money.wallet_${ty}`)} selected={type === ty} onPress={() => setType(ty)} />
            ))}
          </View>
        </Field>

        <Field label={t('money.currency')} icon="globe">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {supportedCurrencies.map((c) => (
              <Chip key={c} label={`${currencySymbol(c)} ${c}`} selected={currency === c} onPress={() => !hasHistory && setCurrency(c)} />
            ))}
          </View>
          {hasHistory ? <Text variant="caption" color="textTertiary">{t('money.currency_locked')}</Text> : null}
        </Field>

        {currency === 'THB' && (type === 'bank' || type === 'card') ? (
          <Field label={t('slip.wallet_bank')} icon="hash">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {BANKS.map((b) => (
                <Chip key={b.code} label={b.short} selected={bankCode === b.code} onPress={() => setBankCode(bankCode === b.code ? null : b.code)} />
              ))}
            </View>
            <TextInput value={accountDigits} onChangeText={setAccountDigits} keyboardType="number-pad" placeholder={t('slip.wallet_digits_placeholder')} placeholderTextColor={colors.textTertiary} accessibilityLabel={t('slip.wallet_digits')} style={input()} />
            <Text variant="caption" color="textTertiary">{t('slip.wallet_digits_hint')}</Text>
          </Field>
        ) : null}

        <Field label={t('money.opening_balance')} icon="flag">
          <TextInput value={opening} onChangeText={setOpening} keyboardType="numbers-and-punctuation" accessibilityLabel={t('money.opening_balance')} style={input(errors.opening, showErrors)} />
          <Text variant="caption" color="textTertiary">{t('money.opening_hint')}</Text>
          <FieldError message={showErrors ? errors.opening : null} />
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
