import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View } from 'react-native';

import { Card, Screen, Text } from '@/components/ui';
import { parseCaptureLocally } from '@/features/ai/capture';
import { saveCaptureItems } from '@/features/ai/save';
import type { CaptureItem } from '@/features/ai/types';
import { useTheme } from '@/theme';

export default function CaptureScreen() {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const params = useLocalSearchParams<{ text?: string }>();
  const [text, setText] = useState(params.text ?? '');
  const [preview, setPreview] = useState<CaptureItem[] | null>(null);

  const onSubmit = () => {
    if (!text.trim()) return;
    // Phase 0: local rule-based parser. Phase 1: replace with ai-capture Edge Function.
    setPreview(parseCaptureLocally(text));
  };

  const onConfirm = () => {
    if (!preview) return;
    saveCaptureItems(preview);
    router.back();
  };

  return (
    <Screen scroll={false}>
      <Text variant="title">{t('capture.title')}</Text>
      <TextInput
        autoFocus
        multiline
        value={text}
        onChangeText={setText}
        placeholder={t('capture.placeholder')}
        placeholderTextColor={colors.textSecondary}
        style={{ minHeight: 100, backgroundColor: colors.surface, color: colors.text, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, fontSize: 16, textAlignVertical: 'top' }}
      />
      {preview ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="caption" color="textSecondary">{t('capture.preview')}</Text>
          {preview.map((item, i) => (
            <Card key={i}>
              <Text variant="caption" color="primary">{item.type.toUpperCase()}</Text>
              <Text>{describe(item)}</Text>
            </Card>
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: 'auto' }}>
        <Pressable onPress={() => router.back()} style={{ flex: 1, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, alignItems: 'center' }}>
          <Text>{t('capture.cancel')}</Text>
        </Pressable>
        <Pressable onPress={preview ? onConfirm : onSubmit} style={{ flex: 1, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center' }}>
          <Text color="onPrimary">{preview ? t('common.save') : t('capture.preview')}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function describe(item: CaptureItem): string {
  switch (item.type) {
    case 'task':
      return `${item.title}${item.date ? ` · ${item.date}` : ''}${item.startTime ? ` ${item.startTime}` : ''}`;
    case 'expense':
    case 'income':
      return `${item.amount} ${item.currency}${item.note ? ` · ${item.note}` : ''}`;
    case 'note':
      return item.body;
  }
}
