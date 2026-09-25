import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, TextInput, View } from 'react-native';

import { Card, Chip, FieldError, PressableScale, Text, Toggle } from '@/components/ui';
import type { Category, Wallet } from '@/db';
import { DateField } from '@/features/calendar/components/date-field';
import { categoryIcon } from '@/features/money/category-icon';
import { currencySymbol } from '@/lib/currency';
import { useTheme, type TintName } from '@/theme';

import { draftErrors, type SlipDraft } from '../draft';

const kinds: { key: SlipDraft['type']; tint: TintName }[] = [
  { key: 'expense', tint: 'priorityHigh' },
  { key: 'income', tint: 'done' },
  { key: 'transfer', tint: 'priorityLow' },
];

type Props = {
  draft: SlipDraft;
  wallets: Wallet[];
  categories: Category[];
  showErrors: boolean;
  onChange: (patch: Partial<SlipDraft>) => void;
};

/** One slip on the review screen: thumbnail, what was read, and the fields to confirm before saving. */
export function SlipCard({ draft: d, wallets, categories, showErrors, onChange }: Props) {
  const { t, i18n } = useTranslation();
  const { colors, tints, spacing, radius, fontFamily, typography } = useTheme();
  const th = i18n.language === 'th';

  const status = d.status === 'scanning' ? null : t(`slip.status_${d.status}`);
  const statusTone = d.status === 'ready' ? colors.success : d.status === 'duplicate' || d.status === 'not_slip' ? tints.priorityHigh.fg : colors.textSecondary;
  const errors = draftErrors(d);
  const showErr = showErrors && d.include;
  const from = wallets.find((w) => w.id === d.walletId);
  const toOptions = wallets.filter((w) => w.id !== d.walletId && w.currency === from?.currency);
  // Categories scroll sideways, so the suggested one goes first where it is visible.
  const cats = categories
    .filter((c) => c.type === (d.type === 'income' ? 'income' : 'expense'))
    .sort((a, b) => Number(b.id === d.suggestedCategoryId) - Number(a.id === d.suggestedCategoryId));
  const input = { minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, color: colors.text, fontFamily: fontFamily.regular, fontSize: typography.body.fontSize };

  return (
    <Card padding="md" style={{ gap: spacing.md, opacity: d.include || d.status === 'scanning' ? 1 : 0.75 }}>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Image source={{ uri: d.uri }} contentFit="cover" style={{ width: 56, height: 96, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted }} accessibilityIgnoresInvertColors />
        <View style={{ flex: 1, gap: spacing.xs }}>
          {d.status === 'scanning' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <ActivityIndicator color={colors.primary} />
              <Text variant="caption" color="textSecondary" accessibilityLiveRegion="polite">{t('slip.reading')}</Text>
            </View>
          ) : (
            <>
              <Text variant="caption" weight="semibold" tone={statusTone} accessibilityLiveRegion="polite">{status}</Text>
              {d.payee ? <Text variant="label" numberOfLines={1}>{d.payee}</Text> : null}
              {d.slipRef ? <Text variant="caption" color="textTertiary" numberOfLines={1}>{t('slip.ref', { ref: d.slipRef })}</Text> : null}
            </>
          )}
        </View>
        {d.status !== 'scanning' ? <Toggle value={d.include} onValueChange={(include) => onChange({ include })} label={t('slip.include')} tone="success" /> : null}
      </View>

      {d.status !== 'scanning' && d.include ? (
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {kinds.map((k) => {
              const on = d.type === k.key;
              const tint = tints[k.tint];
              return (
                <PressableScale
                  key={k.key}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={t(`money.type_${k.key}`)}
                  onPress={() => onChange({ type: k.key, categoryId: null })}
                  style={{ flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1.5, borderColor: on ? tint.fg : colors.border, backgroundColor: on ? tint.bg : 'transparent' }}
                >
                  <Text variant="caption" weight="semibold" tone={on ? tint.fg : colors.textSecondary}>{t(`money.type_${k.key}`)}</Text>
                </PressableScale>
              );
            })}
          </View>

          <View style={{ gap: spacing.sm }}>
            <View style={{ gap: spacing.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, ...input, borderColor: showErr && errors.amount ? tints.priorityHigh.fg : colors.border }}>
                <Text variant="label" color="textSecondary">{currencySymbol(from?.currency ?? 'THB')}</Text>
                <TextInput value={d.amount} onChangeText={(amount) => onChange({ amount })} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textTertiary} accessibilityLabel={t('money.amount')} style={{ flex: 1, minWidth: 0, color: colors.text, fontFamily: fontFamily.bold, fontSize: typography.body.fontSize + 2, fontVariant: ['tabular-nums'] }} />
              </View>
              <FieldError message={showErr && errors.amount ? t('money.invalid_amount') : null} />
            </View>
            <View style={{ gap: spacing.xs }}>
              <DateField value={d.date} onChange={(date) => onChange({ date })} invalid={showErr && !!errors.date} />
              <FieldError message={showErr && errors.date ? t('tasks.invalid_date') : null} />
            </View>
          </View>

          <View style={{ gap: spacing.xs }}>
            <Text variant="caption" color="textSecondary">{d.type === 'transfer' ? t('money.from_account') : t('money.account')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {wallets.map((w) => (
                <Chip key={w.id} label={w.name} selected={d.walletId === w.id} onPress={() => onChange({ walletId: w.id })} />
              ))}
            </View>
            <FieldError message={showErr && errors.wallet ? t('money.need_account') : null} />
          </View>

          {d.type === 'transfer' ? (
            <View style={{ gap: spacing.xs }}>
              <Text variant="caption" color="textSecondary">{t('money.to_account')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {toOptions.map((w) => (
                  <Chip key={w.id} label={w.name} selected={d.toWalletId === w.id} onPress={() => onChange({ toWalletId: w.id })} />
                ))}
              </View>
              <FieldError message={showErr && errors.to ? t('money.pick_destination') : null} />
            </View>
          ) : (
            <View style={{ gap: spacing.xs }}>
              <Text variant="caption" color="textSecondary">{t('money.category')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                {cats.map((c) => (
                  <Chip key={c.id} icon={categoryIcon(c.icon)} label={th ? c.nameTh : c.nameEn} selected={d.categoryId === c.id} onPress={() => onChange({ categoryId: d.categoryId === c.id ? null : c.id })} />
                ))}
              </ScrollView>
            </View>
          )}

          <TextInput value={d.note} onChangeText={(note) => onChange({ note })} placeholder={t('money.note_placeholder')} placeholderTextColor={colors.textTertiary} accessibilityLabel={t('money.note')} style={input} />
        </View>
      ) : null}
    </Card>
  );
}
