import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View } from 'react-native';

import { Card, Screen, Text } from '@/components/ui';
import { parseCaptureLocally } from '@/features/ai/capture';
import { saveCaptureItems } from '@/features/ai/save';
import type { CaptureItem } from '@/features/ai/types';
import { showAlert } from '@/lib/dialog';
import { closeScreen } from '@/lib/navigation';
import { useTheme } from '@/theme';

export default function CaptureScreen() {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<CaptureItem[] | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = () => {
    if (!text.trim()) return;
    // Phase 0: local rule-based parser. Phase 1: replace with ai-capture Edge Function.
    setPreview(parseCaptureLocally(text));
  };

  const onConfirm = async () => {
    if (!preview || saving) return;
    setSaving(true);
    try {
      await saveCaptureItems(preview);
      closeScreen();
    } catch (e) {
      setSaving(false);
      showAlert(t('common.save_failed'), e instanceof Error ? e.message : String(e));
    }
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
        <Pressable onPress={closeScreen} style={{ flex: 1, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: 'center' }}>
          <Text>{t('capture.cancel')}</Text>
        </Pressable>
        <Pressable onPress={preview ? onConfirm : onSubmit} disabled={saving} style={{ flex: 1, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', opacity: saving ? 0.6 : 1 }}>
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
