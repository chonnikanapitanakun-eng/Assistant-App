import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';

import { Gradient, Icon, IconButton, PressableScale } from '@/components/ui';
import { useTheme } from '@/theme';

/**
 * "Tell Veyra anything…" — one input, no category picker. Veyra classifies
 * the text into event / task / money / note / contact on the capture screen.
 */
export function QuickCapture() {
  const { t } = useTranslation();
  const { colors, spacing, radius, shadow, typography, fontFamily } = useTheme();
  const [text, setText] = useState('');

  const submit = () => {
    const value = text.trim();
    router.push({ pathname: '/capture', params: value ? { text: value } : {} });
    setText('');
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: colors.surfaceElevated,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.border,
        paddingLeft: spacing.lg + 2,
        paddingRight: spacing.xs + 2,
        minHeight: 56,
        boxShadow: shadow.lg,
      }}
    >
      <TextInput
        value={text}
        onChangeText={setText}
        onSubmitEditing={submit}
        returnKeyType="send"
        placeholder={t('home.capture_placeholder')}
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel={t('home.capture_placeholder')}
        style={{ flex: 1, minWidth: 0, minHeight: 44, color: colors.text, fontSize: typography.body.fontSize, fontFamily: fontFamily.regular }}
      />
      {text ? null : (
        <>
          <IconButton icon="mic" label={t('home.capture_voice')} onPress={() => router.push({ pathname: '/capture', params: { voice: '1' } })} />
          <IconButton icon="camera" label={t('home.capture_photo')} onPress={() => router.push('/slip')} />
        </>
      )}
      {text ? (
        <PressableScale accessibilityRole="button" accessibilityLabel={t('home.capture_send')} onPress={submit}>
          <Gradient variant="ai" style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="arrow-up" size={20} tone={colors.onPrimary} />
          </Gradient>
        </PressableScale>
      ) : null}
    </View>
  );
}
