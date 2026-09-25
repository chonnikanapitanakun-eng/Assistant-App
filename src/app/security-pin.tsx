import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, Text } from '@/components/ui';
import { PinPad } from '@/features/security/components/pin-pad';
import { useSecurity } from '@/features/security/store';
import { useTheme } from '@/theme';

type Step = 'verify' | 'new' | 'confirm';

export default function SecurityPinScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const verifyPin = useSecurity((s) => s.verifyPin);
  const setPin = useSecurity((s) => s.setPin);

  const [step, setStep] = useState<Step>(mode === 'change' ? 'verify' : 'new');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/settings'));

  const title =
    step === 'verify' ? t('security.enter_current_pin') : step === 'new' ? t('security.enter_new_pin') : t('security.confirm_new_pin');

  const handleSubmit = async (pin: string) => {
    setError(null);
    if (step === 'verify') {
      const ok = await verifyPin(pin);
      if (ok) setStep('new');
      else setError(t('security.wrong_pin'));
      return ok;
    }
    if (step === 'new') {
      setFirstPin(pin);
      setStep('confirm');
      return true;
    }
    // step === 'confirm'
    if (pin === firstPin) {
      await setPin(pin);
      close();
      return true;
    }
    setFirstPin('');
    setStep('new');
    setError(t('security.pin_mismatch'));
    return true; // the step change remounts PinPad, which clears it — no need for its own shake here
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, marginLeft: -spacing.sm }}>
        <IconButton icon="chevron-left" label={t('common.back')} onPress={close} />
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xxxl, paddingHorizontal: spacing.xl }}>
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <Text variant="heading">{title}</Text>
          {error ? <Text variant="caption" color="danger">{error}</Text> : null}
        </View>
        <PinPad key={step} onSubmit={handleSubmit} />
      </View>
    </View>
  );
}
