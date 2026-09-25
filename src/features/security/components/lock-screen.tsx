import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Mascot } from '@/components/brand/mascot';
import { PressableScale, Text } from '@/components/ui';
import { useConfirm } from '@/lib/use-confirm';
import { useTheme } from '@/theme';

import { authenticateWithBiometrics, biometricLabelKey, useBiometricSupport } from '../biometrics';
import { useSecurity } from '../store';
import { PinPad } from './pin-pad';

/** Full-screen PIN/Face ID gate, shown by `LockGate` whenever the app is locked. */
export function LockScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const verifyPin = useSecurity((s) => s.verifyPin);
  const unlock = useSecurity((s) => s.unlock);
  const biometricEnabled = useSecurity((s) => s.biometricEnabled);
  const disable = useSecurity((s) => s.disable);
  const { available, kind } = useBiometricSupport();
  const { armed, confirm } = useConfirm();

  const useBiometric = biometricEnabled && available;

  const tryBiometric = async () => {
    const ok = await authenticateWithBiometrics(t('security.unlock_prompt'));
    if (ok) unlock();
  };

  useEffect(() => {
    if (useBiometric) void tryBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-trigger when availability flips, not on every render
  }, [useBiometric]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top, paddingBottom: insets.bottom, gap: spacing.xxxl }}>
      <View style={{ alignItems: 'center', gap: spacing.md }}>
        <Mascot pose="calm" size={72} />
        <Text variant="heading">{t('security.locked_title')}</Text>
      </View>
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
      <PressableScale accessibilityRole="button" accessibilityLabel={t('security.forgot_pin')} onPress={() => confirm(disable)}>
        <Text variant="caption" color="textTertiary">{armed ? t('security.forgot_pin_confirm') : t('security.forgot_pin')}</Text>
      </PressableScale>
    </View>
  );
}
