import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Mascot } from '@/components/brand/mascot';
import { Button, Gradient, IconButton, PressableScale, Text, type IconName } from '@/components/ui';
import { parseCaptureLocally } from '@/features/ai/capture';
import { saveCaptureItems } from '@/features/ai/save';
import type { CaptureItem } from '@/features/ai/types';
import { DetectedItem } from '@/features/capture/detected-item';
import { useBreakpoint, useTheme } from '@/theme';

const examples = [
  'Meeting with John tomorrow at 10 about VAT £5,000',
  'ข้าวเที่ยง 120',
  'Fri 9am submit VAT return',
  'Idea: offer a Xero onboarding package',
];

const media: { icon: IconName; key: string }[] = [
  { icon: 'mic', key: 'voice' },
  { icon: 'camera', key: 'photo' },
  { icon: 'paperclip', key: 'document' },
];

type Phase = { kind: 'edit' } | { kind: 'saved'; count: number } | { kind: 'error' };

/**
 * Quick Capture — bottom sheet on phones, centred dialog on larger screens.
 * Type anything; Veyra detects events, tasks, money, notes and contacts. No category picker.
 */
export default function CaptureScreen() {
  const { t } = useTranslation();
  const { colors, spacing, radius, shadow, typography, fontFamily, motion } = useTheme();
  const { isMobile } = useBreakpoint();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ text?: string }>();

  const [text, setText] = useState(params.text ?? '');
  const [focused, setFocused] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [moneyType, setMoneyType] = useState<Record<string, 'income' | 'expense'>>({});
  const [mediaHint, setMediaHint] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'edit' });

  const detected = useMemo(() => {
    return parseCaptureLocally(text).map((item, i) => {
      const key = `${i}:${item.type === 'income' ? 'expense' : item.type}`;
      const override = moneyType[key];
      const resolved: CaptureItem = override && (item.type === 'income' || item.type === 'expense') ? { ...item, type: override } : item;
      return { key, item: resolved };
    });
  }, [text, moneyType]);
  const selected = detected.filter((d) => !excluded.has(d.key));

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  useEffect(() => {
    if (phase.kind !== 'saved') return;
    const id = setTimeout(close, 1600);
    return () => clearTimeout(id);
  }, [phase]);

  const toggle = (key: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const save = () => {
    if (!selected.length) return;
    try {
      const count = saveCaptureItems(selected.map((d) => d.item));
      setPhase({ kind: 'saved', count });
    } catch {
      setPhase({ kind: 'error' });
    }
  };

  const sheetStyle = isMobile
    ? { width: '100%' as const, maxHeight: '92%' as const, borderTopLeftRadius: radius.panel, borderTopRightRadius: radius.panel, paddingBottom: insets.bottom + spacing.lg }
    : { width: '100%' as const, maxWidth: 560, maxHeight: '86%' as const, borderRadius: radius.panel, paddingBottom: spacing.xl };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: isMobile ? 'flex-end' : 'center', alignItems: 'center', padding: isMobile ? 0 : spacing.xxl }}>
      <Animated.View entering={FadeIn.duration(motion.fast)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={close} style={{ flex: 1 }} />
      </Animated.View>

      <Animated.View
        entering={isMobile ? SlideInDown.duration(motion.base) : FadeInDown.duration(motion.base)}
        accessibilityViewIsModal
        style={[sheetStyle, { backgroundColor: colors.surface, boxShadow: shadow.lg, overflow: 'hidden' }]}
      >
        {isMobile ? <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginTop: spacing.sm }} /> : null}

        {phase.kind === 'saved' ? (
          <Result mascot="success" title={t('capture.saved_title')} body={t('capture.saved_body', { count: phase.count })} action={t('common.done')} onAction={close} />
        ) : phase.kind === 'error' ? (
          <Result mascot="oops" title={t('capture.error_title')} body={t('capture.error_body')} action={t('capture.try_again')} onAction={() => setPhase({ kind: 'edit' })} />
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="heading" accessibilityRole="header">{t('capture.title')}</Text>
                <Text variant="caption" color="textSecondary">{t('capture.subtitle')}</Text>
              </View>
              <IconButton icon="x" label={t('common.close')} onPress={close} filled />
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl }}>
              <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, borderWidth: 1.5, borderColor: focused ? colors.primary : colors.border }}>
                <TextInput
                  autoFocus
                  multiline
                  value={text}
                  onChangeText={setText}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder={t('home.capture_placeholder')}
                  placeholderTextColor={colors.textTertiary}
                  accessibilityLabel={t('capture.title')}
                  style={{ minHeight: 96, padding: spacing.lg, color: colors.text, fontSize: typography.body.fontSize + 1, lineHeight: typography.body.lineHeight, fontFamily: fontFamily.regular, textAlignVertical: 'top' }}
                />
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xs, paddingBottom: spacing.xs }}>
                  {media.map((m) => (
                    <IconButton key={m.key} icon={m.icon} label={t(`home.capture_${m.key}`)} onPress={() => setMediaHint(t(`capture.media_${m.key}`))} />
                  ))}
                  {text ? (
                    <View style={{ marginLeft: 'auto' }}>
                      <IconButton icon="x-circle" label={t('capture.clear')} onPress={() => setText('')} />
                    </View>
                  ) : null}
                </View>
              </View>

              {mediaHint ? (
                <Animated.View entering={FadeIn.duration(motion.fast)} accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.aiWash, borderRadius: radius.md, padding: spacing.md }}>
                  <Text variant="caption" color="textSecondary" style={{ flex: 1 }}>{mediaHint}</Text>
                  <IconButton icon="x" label={t('common.close')} onPress={() => setMediaHint(null)} />
                </Animated.View>
              ) : null}

              {detected.length ? (
                <View style={{ gap: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Gradient variant="ai" style={{ width: 8, height: 8, borderRadius: 4 }} />
                    <Text variant="overline" color="primary" accessibilityLiveRegion="polite">
                      {t('capture.found', { count: detected.length }).toUpperCase()}
                    </Text>
                  </View>
                  {detected.map((d) => (
                    <Animated.View key={d.key} entering={FadeInDown.duration(motion.fast)}>
                      <DetectedItem
                        item={d.item}
                        included={!excluded.has(d.key)}
                        onToggle={() => toggle(d.key)}
                        onSwitchMoneyType={(type) => setMoneyType((m) => ({ ...m, [d.key]: type }))}
                      />
                    </Animated.View>
                  ))}
                </View>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  <Text variant="overline" color="textSecondary">{t('capture.try_saying').toUpperCase()}</Text>
                  {examples.map((ex) => (
                    <PressableScale
                      key={ex}
                      accessibilityRole="button"
                      accessibilityLabel={ex}
                      onPress={() => setText(ex)}
                      style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }}
                    >
                      <Text variant="bodySm" color="textSecondary">“{ex}”</Text>
                    </PressableScale>
                  ))}
                </View>
              )}
            </ScrollView>

            <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm }}>
              <Button
                fullWidth
                icon="check"
                label={selected.length ? t('capture.save_count', { count: selected.length }) : t('capture.save')}
                disabled={!selected.length}
                onPress={save}
              />
            </View>
          </>
        )}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

function Result({ mascot, title, body, action, onAction }: { mascot: 'success' | 'oops'; title: string; body: string; action: string; onAction: () => void }) {
  const { spacing, motion } = useTheme();
  return (
    <Animated.View entering={FadeIn.duration(motion.slow)} accessibilityLiveRegion="polite" style={{ alignItems: 'center', gap: spacing.md, padding: spacing.xxl }}>
      <Mascot pose={mascot} size={112} />
      <Text variant="heading" align="center">{title}</Text>
      <Text variant="bodySm" color="textSecondary" align="center">{body}</Text>
      <View style={{ marginTop: spacing.sm }}>
        <Button label={action} variant="secondary" onPress={onAction} />
      </View>
    </Animated.View>
  );
}
