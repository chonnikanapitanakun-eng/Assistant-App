import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, TextInput, View } from 'react-native';

import { Mascot } from '@/components/brand/mascot';
import { Button, Chip, Field, FieldError, Sheet, Text, useInputStyle } from '@/components/ui';
import type { Wallet } from '@/db';
import { walletIcon } from '@/features/money/category-icon';
import { walletBalance } from '@/features/money/model';
import { createWallet, deleteWallet, updateWallet, useTransactions, useWallet } from '@/features/money/queries';
import { currencySymbol, formatMoney, parseAmount, supportedCurrencies } from '@/lib/currency';
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

  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<Wallet['type']>(existing?.type ?? 'bank');
  const [currency, setCurrency] = useState(existing?.currency ?? 'THB');
  const [opening, setOpening] = useState(existing ? String(existing.balance) : '0');
  const [showErrors, setShowErrors] = useState(false);

  const hasHistory = !!existing && txs.some((x) => x.walletId === existing.id || x.toWalletId === existing.id);
  const parsed = parseAmount(opening);
  const errors = { name: !name.trim() ? t('money.name_required') : null, opening: parsed === null ? t('money.invalid_amount') : null };

  const save = () => {
    if (Object.values(errors).some(Boolean) || parsed === null) {
      setShowErrors(true);
      return;
    }
    const values = { name: name.trim(), type, currency, balance: parsed };
    if (existing) updateWallet(existing.id, values);
    else createWallet(values);
    onClose();
  };

  return (
    <Sheet
      onClose={onClose}
      title={existing ? t('money.edit_account') : t('money.add_account')}
      subtitle={existing ? t('money.current_balance', { amount: formatMoney(walletBalance(existing, txs), existing.currency, 'en-GB') }) : undefined}
      footer={
        <View style={{ gap: spacing.sm }}>
          <Button fullWidth icon="check" label={t('common.save')} onPress={save} />
          {existing ? (
            <Button fullWidth variant="ghost" icon="eye-off" label={armed ? t('tasks.delete_confirm') : t('money.hide_account')} accessibilityHint={t('money.hide_account_hint')} onPress={() => confirm(() => (deleteWallet(existing.id), onClose()))} />
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
