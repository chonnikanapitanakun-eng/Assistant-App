import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Mascot } from '@/components/brand/mascot';
import { Button, Gradient, IconButton, PressableScale, Sheet, Text, type IconName } from '@/components/ui';
import { parseCaptureLocally } from '@/features/ai/capture';
import { captureRemote, captureRemoteEnabled } from '@/features/ai/remote';
import { saveCaptureItems } from '@/features/ai/save';
import type { CaptureItem } from '@/features/ai/types';
import { useCaptureContext } from '@/features/ai/use-capture-context';
import { DetectedItem } from '@/features/capture/detected-item';
import { defaultSpeechLang, type SpeechLang } from '@/features/capture/speech';
import { useVoiceCapture } from '@/features/capture/use-voice-capture';
import { useDraft } from '@/lib/use-draft';
import { useTheme } from '@/theme';

const examples = [
  'Meeting with John tomorrow at 10 about VAT £5,000',
  'ข้าวเที่ยง 120',
  'Fri 9am submit VAT return',
  'Idea: offer a Xero onboarding package',
];

const media: { icon: IconName; key: string }[] = [
  { icon: 'camera', key: 'photo' },
  { icon: 'paperclip', key: 'document' },
];

type Phase = { kind: 'edit' } | { kind: 'saved'; count: number } | { kind: 'error' };

/**
 * Quick Capture — bottom sheet on phones, centred dialog on larger screens.
 * Type anything; Veyra detects events, tasks, money, notes and contacts. No category picker.
 */
export default function CaptureScreen() {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius, typography, fontFamily, motion } = useTheme();
  const params = useLocalSearchParams<{ text?: string; voice?: string }>();

  const [text, setText] = useDraft('capture:text', params.text ?? '');
  const [focused, setFocused] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [moneyType, setMoneyType] = useState<Record<string, 'income' | 'expense'>>({});
  const [mediaHint, setMediaHint] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'edit' });
  const [remote, setRemote] = useState<{ text: string; items: CaptureItem[] } | null>(null);
  const [thinking, setThinking] = useState(false);
  const captureContext = useCaptureContext();
  // Read at fire time: the context changes on every DB write, which must not restart the debounce
  // or abort a request in flight.
  const captureContextRef = useRef(captureContext);
  useEffect(() => {
    captureContextRef.current = captureContext;
  }, [captureContext]);
  const abortRef = useRef<AbortController | null>(null);
  const [voiceLang, setVoiceLang] = useState<SpeechLang>(() => defaultSpeechLang(i18n.language));
  const voice = useVoiceCapture(setText);

  const toggleVoice = () => {
    if (voice.listening) voice.stop();
    else void voice.start(voiceLang, text);
  };

  // Opened from the home mic button → start listening straight away. Speech is appended to the text
  // already in the box (a restored draft, or `params.text`), so nothing typed earlier is lost.
  const autoVoice = useRef(params.voice === '1');
  useEffect(() => {
    if (!autoVoice.current) return;
    autoVoice.current = false;
    void voice.start(voiceLang, text);
  }, [voice, voiceLang, text]);

  // Claude refines the instant local parse once typing pauses. Any failure keeps the local result.
  useEffect(() => {
    if (!captureRemoteEnabled || phase.kind !== 'edit') return;
    const value = text.trim();
    if (!value) return; // a stale `remote` is ignored because it is keyed by text
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    const id = setTimeout(async () => {
      setThinking(true);
      try {
        const res = await captureRemote(value, captureContextRef.current(), controller.signal);
        if (!controller.signal.aborted && res.items.length) {
          setRemote({ text: value, items: res.items });
          // A new list: ticks and income/expense flips made on the old one would land on the wrong items.
          setExcluded(new Set());
          setMoneyType({});
        }
      } catch {
        // offline / rate-limited / upstream error → local parse stays
      } finally {
        setThinking(false); // an aborted request also clears it; the next one sets it again
      }
    }, 700);
    return () => {
      clearTimeout(id);
      controller.abort();
    };
  }, [text, phase.kind]);
  const [saving, setSaving] = useState(false);

  const detected = useMemo(() => {
    const fromRemote = !!remote && remote.text === text.trim();
    const base = fromRemote ? remote.items : parseCaptureLocally(text);
    return base.map((item, i) => {
      // Keys are per list (Claude's vs the local parse) so edits to one never apply to the other.
      const key = `${fromRemote ? 'c' : 'l'}${i}:${item.type === 'income' ? 'expense' : item.type}`;
      const override = moneyType[key];
      const resolved: CaptureItem = override && (item.type === 'income' || item.type === 'expense') ? { ...item, type: override } : item;
      return { key, item: resolved };
    });
  }, [text, moneyType, remote]);
  const fromClaude = !!remote && remote.text === text.trim();
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

  const save = async () => {
    if (!selected.length || saving) return;
    setSaving(true);
    try {
      const count = await saveCaptureItems(selected.map((d) => d.item));
      setText(''); // saved — don't restore it if the page reloads on the success screen
      setPhase({ kind: 'saved', count });
    } catch (e) {
      console.error('Quick capture save failed:', e);
      setPhase({ kind: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      onClose={close}
      title={phase.kind === 'edit' ? t('capture.title') : undefined}
      subtitle={t('capture.subtitle')}
      footer={
        phase.kind === 'edit' ? (
          <Button
            fullWidth
            icon="check"
            label={selected.length ? t('capture.save_count', { count: selected.length }) : t('capture.save')}
            disabled={!selected.length || saving}
            onPress={() => void save()}
          />
        ) : undefined
      }
    >
      {phase.kind === 'saved' ? (
        <Result mascot="success" title={t('capture.saved_title')} body={t('capture.saved_body', { count: phase.count })} action={t('common.done')} onAction={close} />
      ) : phase.kind === 'error' ? (
        <Result mascot="oops" title={t('capture.error_title')} body={t('capture.error_body')} action={t('capture.try_again')} onAction={() => setPhase({ kind: 'edit' })} />
      ) : (
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
              <IconButton
                icon={voice.listening ? 'square' : 'mic'}
                label={voice.listening ? t('capture.voice_stop') : t('home.capture_voice')}
                color={voice.listening ? 'primary' : 'textSecondary'}
                filled={voice.listening}
                onPress={toggleVoice}
              />
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={t('capture.voice_lang', { lang: voiceLang === 'th' ? 'ไทย' : 'English' })}
                disabled={voice.listening}
                onPress={() => setVoiceLang((l) => (l === 'th' ? 'en' : 'th'))}
                hitSlop={8}
                style={{ minHeight: 28, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, opacity: voice.listening ? 0.5 : 1 }}
              >
                <Text variant="caption" color="textSecondary">{voiceLang === 'th' ? 'TH' : 'EN'}</Text>
              </PressableScale>
              {media.map((m) => (
                <IconButton key={m.key} icon={m.icon} label={t(`home.capture_${m.key}`)} onPress={() => (m.key === 'photo' ? router.replace('/slip') : setMediaHint(t(`capture.media_${m.key}`)))} />
              ))}
              {text ? (
                <View style={{ marginLeft: 'auto' }}>
                  <IconButton icon="x-circle" label={t('capture.clear')} onPress={() => setText('')} />
                </View>
              ) : null}
            </View>
          </View>

          {voice.listening ? (
            <Animated.View entering={FadeIn.duration(motion.fast)} accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.aiWash, borderRadius: radius.md, padding: spacing.md }}>
              <Gradient variant="ai" style={{ width: 8, height: 8, borderRadius: 4 }} />
              <Text variant="caption" color="textSecondary" style={{ flex: 1 }}>{t('capture.voice_listening')}</Text>
            </Animated.View>
          ) : voice.error ? (
            <Animated.View entering={FadeIn.duration(motion.fast)} accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.aiWash, borderRadius: radius.md, padding: spacing.md }}>
              <Text variant="caption" color="textSecondary" style={{ flex: 1 }}>{t(`capture.voice_error_${voice.error}`)}</Text>
              <IconButton icon="x" label={t('common.close')} onPress={voice.clearError} />
            </Animated.View>
          ) : null}

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
                {thinking || fromClaude ? (
                  <Text variant="caption" color="textTertiary" style={{ marginLeft: 'auto' }}>
                    {thinking ? t('capture.thinking') : t('capture.by_claude')}
                  </Text>
                ) : null}
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
      )}
    </Sheet>
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
