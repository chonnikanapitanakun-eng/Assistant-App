import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Mascot } from '@/components/brand/mascot';
import { Button, Icon, PressableScale, Text } from '@/components/ui';
import { useTheme } from '@/theme';

import { authenticateWithBiometrics, biometricLabelKey, useBiometricSupport } from '../biometrics';
import { eraseForForgottenPin } from '../forgot-pin';
import { useSecurity } from '../store';
import { PinPad } from './pin-pad';

type Phase = 'pin' | 'confirm-erase' | 'erasing';

/** Full-screen PIN/Face ID gate, shown by `LockGate` whenever the app is locked. */
export function LockScreen() {
  const { t } = useTranslation();
  const { colors, spacing, radius, touchTarget } = useTheme();
  const insets = useSafeAreaInsets();
  const verifyPin = useSecurity((s) => s.verifyPin);
  const unlock = useSecurity((s) => s.unlock);
  const biometricEnabled = useSecurity((s) => s.biometricEnabled);
  const { available, kind } = useBiometricSupport();
  const [phase, setPhase] = useState<Phase>('pin');
  const [eraseFailed, setEraseFailed] = useState(false);

  const useBiometric = biometricEnabled && available;

  const tryBiometric = async () => {
    const ok = await authenticateWithBiometrics(t('security.unlock_prompt'));
    if (ok) unlock();
  };

  useEffect(() => {
    if (useBiometric) void tryBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-trigger when availability flips, not on every render
  }, [useBiometric]);

  // "Forgot PIN" never just unlocks: the data on this device is erased (PDPA erase) and the app starts
  // over at onboarding, like Settings → Privacy → Erase. The lock stays on if the erase fails.
  const eraseAndReset = async () => {
    setEraseFailed(false);
    setPhase('erasing');
    try {
      await eraseForForgottenPin();
      router.replace('/onboarding');
    } catch (e) {
      console.error('Forgot-PIN erase failed:', e);
      setEraseFailed(true);
      setPhase('confirm-erase');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top, paddingBottom: insets.bottom, paddingHorizontal: spacing.xl, gap: spacing.xxxl }}>
      <View style={{ alignItems: 'center', gap: spacing.md }}>
        <Mascot pose="calm" size={72} />
        <Text variant="heading">{t('security.locked_title')}</Text>
      </View>
      {phase === 'pin' ? (
        <>
          <PinPad
            onSubmit={async (pin) => {
              const ok = await verifyPin(pin);
              if (ok) unlock();
              return ok;
            }}
            biometricIcon={useBiometric ? (kind === 'face' ? 'smile' : 'unlock') : undefined}
            biometricLabel={useBiometric ? t(biometricLabelKey(kind)) : undefined}
            onBiometric={() => void tryBiometric()}
          />
          <PressableScale accessibilityRole="button" accessibilityLabel={t('security.forgot_pin')} onPress={() => setPhase('confirm-erase')} hitSlop={8}>
            <Text variant="caption" color="textTertiary">{t('security.forgot_pin')}</Text>
          </PressableScale>
        </>
      ) : (
        <View
          accessibilityRole="alert"
          style={{ width: '100%', maxWidth: 420, padding: spacing.xl, gap: spacing.lg, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name="alert-triangle" size={20} color="danger" />
            <Text variant="title" style={{ flex: 1 }}>{t('security.forgot_title')}</Text>
          </View>
          <Text color="textSecondary">{t('security.forgot_body')}</Text>
          <Text color="textSecondary">{t('security.forgot_restore')}</Text>
          {eraseFailed ? <Text variant="caption" color="danger">{t('security.forgot_failed')}</Text> : null}
          {phase === 'erasing' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: touchTarget }}>
              <ActivityIndicator color={colors.danger} />
              <Text color="textSecondary">{t('security.forgot_erasing')}</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.sm }}>
              <Button variant="ghost" label={t('common.cancel')} onPress={() => { setEraseFailed(false); setPhase('pin'); }} />
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={t('security.forgot_erase')}
                accessibilityHint={t('security.forgot_body')}
                onPress={() => void eraseAndReset()}
                style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.xl, borderRadius: radius.button, backgroundColor: colors.danger }}
              >
                <Text variant="label" weight="semibold" tone={colors.onPrimary}>{t('security.forgot_erase')}</Text>
              </PressableScale>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
