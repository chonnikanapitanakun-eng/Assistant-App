import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, ScrollView, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';

import { Mascot } from '@/components/brand/mascot';
import { Button, Icon, Sheet, Text, type IconName } from '@/components/ui';
import { authEnabled, signInWithGoogle, useSession } from '@/features/auth';
import { buy, getPackages, loadServerStatus, purchasesEnabled, restore, usePremiumStore, usePro, UsageMeter, type PurchaseOutcome } from '@/features/premium';
import { useTheme } from '@/theme';

const PRO_FEATURES: { icon: IconName; key: string }[] = [
  { icon: 'zap', key: 'capture' },
  { icon: 'message-circle', key: 'assistant' },
  { icon: 'camera', key: 'slip' },
  { icon: 'cloud', key: 'sync' },
];

/** Veyra Pro (P4-06): what's included, plans from RevenueCat, restore, and this month's AI usage. */
export default function PremiumScreen() {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const session = useSession();
  const pro = usePro();
  const { used, limit, expiresAt, willRenew, manageUrl } = usePremiumStore();
  const [packages, setPackages] = useState<PurchasesPackage[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  useEffect(() => {
    if (!session || pro || !purchasesEnabled) return;
    let live = true;
    getPackages()
      .then((p) => live && setPackages(p))
      .catch((e) => {
        console.error('Load offerings failed:', e);
        if (live) setPackages([]);
      });
    return () => {
      live = false;
    };
  }, [session, pro]);

  const afterStore = async (outcome: PurchaseOutcome, restoring: boolean) => {
    if (outcome === 'cancelled') return;
    if (outcome === 'pro') {
      // Tell the server now so the AI gate opens before RevenueCat's webhook arrives.
      await loadServerStatus({ refresh: true }).catch((e) => console.error('Premium refresh failed:', e));
      setNotice({ text: t('premium.welcome') });
    } else {
      setNotice({ text: t(outcome === 'not_pro' && restoring ? 'premium.nothing_to_restore' : 'premium.purchase_failed'), error: true });
    }
  };

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setNotice(null);
    try {
      await work();
    } finally {
      setBusy(false);
    }
  };

  const locale = i18n.language === 'th' ? 'th-TH' : 'en-GB';
  const until = expiresAt ? new Date(expiresAt).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : null;

  return (
    <Sheet onClose={close} title={t('premium.title')} subtitle={pro ? t('premium.active') : t('premium.subtitle')}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
        <View style={{ alignItems: 'center' }}>
          <Mascot pose={pro ? 'success' : 'wave'} size={88} />
        </View>

        <View style={{ gap: spacing.md }}>
          {PRO_FEATURES.map((f) => (
            <View key={f.key} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={f.icon} size={17} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="subheading">{t(`premium.feature_${f.key}`)}</Text>
                <Text variant="caption" color="textSecondary">{t(`premium.feature_${f.key}_body`)}</Text>
              </View>
            </View>
          ))}
          <Text variant="caption" color="textTertiary">{t('premium.free_note')}</Text>
        </View>

        {pro ? (
          <View style={{ gap: spacing.md }}>
            <UsageMeter used={used} limit={limit} />
            <Text variant="caption" color="textSecondary">
              {until ? t(willRenew === false ? 'premium.ends_on' : 'premium.renews_on', { date: until }) : t('premium.no_end')}
            </Text>
            {manageUrl ? <Button variant="secondary" icon="external-link" label={t('premium.manage')} onPress={() => void Linking.openURL(manageUrl)} /> : null}
          </View>
        ) : !authEnabled ? (
          <Text variant="caption" color="textTertiary">{t('sync.unavailable')}</Text>
        ) : !session ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="bodySm" color="textSecondary">{t('premium.sign_in_first')}</Text>
            <Button icon="log-in" label={t('sync.sign_in')} disabled={busy} onPress={() => void run(async () => void (await signInWithGoogle()))} />
          </View>
        ) : !purchasesEnabled ? (
          <Text variant="caption" color="textTertiary">{t('premium.unavailable')}</Text>
        ) : packages === null ? (
          <ActivityIndicator color={colors.primary} />
        ) : packages.length === 0 ? (
          <Text variant="caption" color="textTertiary">{t('premium.no_plans')}</Text>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {packages.map((p) => (
              <Button
                key={p.identifier}
                fullWidth
                variant={p.packageType === 'ANNUAL' ? 'primary' : 'secondary'}
                label={t(p.packageType === 'ANNUAL' ? 'premium.plan_annual' : p.packageType === 'MONTHLY' ? 'premium.plan_monthly' : 'premium.plan_other', { price: p.product.priceString, title: p.product.title })}
                disabled={busy}
                onPress={() => void run(async () => afterStore(await buy(p), false))}
              />
            ))}
            <Button variant="ghost" icon="rotate-ccw" label={t('premium.restore')} disabled={busy} onPress={() => void run(async () => afterStore(await restore(), true))} />
            <Text variant="caption" color="textTertiary">{t('premium.terms')}</Text>
          </View>
        )}

        {notice ? (
          <Text variant="caption" color={notice.error ? 'danger' : 'success'} accessibilityLiveRegion="polite">{notice.text}</Text>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}
