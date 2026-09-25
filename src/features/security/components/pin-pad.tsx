import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon, PressableScale, Text, type IconName } from '@/components/ui';
import { useTheme } from '@/theme';

import { PIN_LENGTH } from '../pin';

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['biometric', '0', 'backspace'],
] as const;

type Props = {
  /** Resolves true for a correct PIN once the last digit is entered. False shakes and clears the pad. */
  onSubmit: (pin: string) => boolean | Promise<boolean>;
  /** Icon for the bottom-left key, shown only when biometric unlock is offered here. */
  biometricIcon?: IconName;
  biometricLabel?: string;
  onBiometric?: () => void;
};

/** Dot indicator + numeric keypad. Auto-submits once `PIN_LENGTH` digits are entered. */
export function PinPad({ onSubmit, biometricIcon, biometricLabel, onBiometric }: Props) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const [digits, setDigits] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const press = async (key: string) => {
    if (busy) return;
    if (key === 'backspace') {
      setError(false);
      setDigits((d) => d.slice(0, -1));
      return;
    }
    if (key === 'biometric') {
      onBiometric?.();
      return;
    }
    if (digits.length >= PIN_LENGTH) return;
    const next = digits + key;
    setDigits(next);
    if (next.length < PIN_LENGTH) return;
    setBusy(true);
    const ok = await onSubmit(next);
    if (!ok) {
      setError(true);
      setDigits('');
    }
    setBusy(false);
  };

  return (
    <View style={{ alignItems: 'center', gap: spacing.xxxl }}>
      <View style={{ flexDirection: 'row', gap: spacing.lg }}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View
            key={i}
            style={{
              width: 16,
              height: 16,
              borderRadius: 8,
              borderWidth: 1.5,
              borderColor: error ? colors.danger : colors.borderStrong,
              backgroundColor: i < digits.length ? (error ? colors.danger : colors.primary) : 'transparent',
            }}
          />
        ))}
      </View>
      <View style={{ gap: spacing.lg }}>
        {ROWS.map((row, ri) => (
          <View key={ri} style={{ flexDirection: 'row', gap: spacing.lg }}>
            {row.map((key) => {
              if (key === 'biometric') {
                return (
                  <View key={key} style={{ width: 72, height: 72, alignItems: 'center', justifyContent: 'center' }}>
                    {biometricIcon ? (
                      <PressableScale accessibilityRole="button" accessibilityLabel={biometricLabel} onPress={() => void press('biometric')} style={{ width: 72, height: 72, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name={biometricIcon} size={26} color="textSecondary" />
                      </PressableScale>
                    ) : null}
                  </View>
                );
              }
              if (key === 'backspace') {
                return (
                  <PressableScale key={key} accessibilityRole="button" accessibilityLabel={t('security.backspace')} onPress={() => void press('backspace')} style={{ width: 72, height: 72, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="delete" size={22} color="textSecondary" />
                  </PressableScale>
                );
              }
              return (
                <PressableScale
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={key}
                  onPress={() => void press(key)}
                  style={{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted }}
                >
                  <Text variant="title">{key}</Text>
                </PressableScale>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
