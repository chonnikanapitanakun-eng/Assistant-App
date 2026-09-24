import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Mascot } from '@/components/brand/mascot';
import { Chip, Gradient, Icon, IconButton, PressableScale, Tag, Text } from '@/components/ui';
import type { AssistantMessage } from '@/db';
import { runProposal } from '@/features/assistant/actions';
import { CardView } from '@/features/assistant/components/cards';
import { Typing } from '@/features/assistant/components/typing';
import { defaultSuggestions, respond } from '@/features/assistant/engine';
import { addMessage, clearChat, updateCard, useMessages, type ChatPayload } from '@/features/assistant/queries';
import { askRemote, remoteEnabled } from '@/features/assistant/remote';
import type { Card, Reply } from '@/features/assistant/types';
import { useAssistantContext } from '@/features/assistant/use-context';
import { MarkdownView } from '@/features/notes/components/markdown-view';
import { useProfile } from '@/features/profile/store';
import { background } from '@/lib/background';
import { useConfirm } from '@/lib/use-confirm';
import { useTheme } from '@/theme';

/** Veyra AI chat. Answers on-device (or with Claude when configured); any change is a card you confirm. */
export default function AssistantScreen() {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius, shadow, typography, fontFamily } = useTheme();
  const insets = useSafeAreaInsets();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const name = useProfile((p) => p.name);
  const messages = useMessages();
  const getContext = useAssistantContext();
  const { armed, confirm } = useConfirm();
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const sentQ = useRef(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || thinking) return;
    setDraft('');
    const history = [...messages.map((m) => ({ role: m.role, text: m.text })), { role: 'user' as const, text }];
    background(addMessage('user', text), 'Save chat message');
    let reply: Reply;
    if (remoteEnabled) {
      setThinking(true);
      try {
        reply = await askRemote(history, getContext(), i18n.language);
      } catch {
        // Offline or the function failed: answer on-device and say so.
        const local = respond(text, getContext(), t);
        reply = { ...local, text: `${local.text}\n\n_${t('assistant.offline_note')}_` };
      }
      setThinking(false);
    } else {
      reply = respond(text, getContext(), t);
    }
    background(addMessage('assistant', reply.text, { cards: reply.cards, suggestions: reply.suggestions, source: reply.source }), 'Save chat reply');
  };

  // Chips on Home open the chat with a question (?q=...); send it once.
  useEffect(() => {
    if (q && !sentQ.current) {
      sentQ.current = true;
      void send(q);
      router.setParams({ q: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const onConfirm = async (message: AssistantMessage, card: Extract<Card, { type: 'proposal' }>) => {
    let ok = false;
    try {
      ok = await runProposal(card.proposal);
    } catch (e) {
      console.error('Assistant proposal failed:', e);
      ok = false;
    }
    await updateCard(message, card.id, { state: ok ? 'done' : 'failed' });
  };

  const last = [...messages].reverse().find((m) => m.role === 'assistant');
  const suggestions = ((last?.payload as ChatPayload | null)?.suggestions ?? []).length ? (last!.payload as ChatPayload).suggestions : defaultSuggestions(t);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
          <IconButton icon="x" label={t('common.close')} onPress={close} />
          <Mascot pose="wave" size={36} />
          <View style={{ flex: 1 }}>
            <Text variant="subheading" accessibilityRole="header">Veyra AI</Text>
            <Text variant="caption" color="textSecondary">{remoteEnabled ? t('assistant.mode_claude') : t('assistant.mode_local')}</Text>
          </View>
          {messages.length ? (
            <PressableScale accessibilityRole="button" accessibilityLabel={armed ? t('assistant.clear_confirm') : t('assistant.clear')} onPress={() => confirm(() => background(clearChat(), 'Clear chat'))} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.sm }}>
              <Icon name="trash-2" size={16} color={armed ? 'danger' : 'textSecondary'} />
              {armed ? <Text variant="caption" color="danger">{t('assistant.clear_confirm')}</Text> : null}
            </PressableScale>
          ) : null}
        </View>

        <ScrollView
          ref={scroll}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, width: '100%', maxWidth: 760, alignSelf: 'center', padding: spacing.lg, gap: spacing.lg }}
        >
          {messages.length === 0 ? (
            <Animated.View entering={FadeIn.duration(400)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.xxl }}>
              <Mascot pose="wave" size={132} />
              <Text variant="title" align="center">{name ? t('assistant.hello', { name }) : t('assistant.hello_anon')}</Text>
              <Text variant="bodySm" color="textSecondary" align="center" style={{ maxWidth: 420 }}>{t('assistant.intro')}</Text>
            </Animated.View>
          ) : (
            messages.map((m) => (m.role === 'user' ? <UserBubble key={m.id} text={m.text} /> : <AssistantBubble key={m.id} message={m} onConfirm={(msg, card) => background(onConfirm(msg, card), 'Confirm proposal')} />))
          )}
          {thinking ? (
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
              <Avatar />
              <Typing />
            </View>
          ) : null}
        </ScrollView>

        <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.md, gap: spacing.sm }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.sm }}>
            {suggestions.map((s) => (
              <Chip key={s} label={s} onPress={() => void send(s)} />
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.panel, borderWidth: 1, borderColor: colors.border, paddingLeft: spacing.lg, paddingRight: spacing.xs + 2, paddingVertical: spacing.xs + 2, boxShadow: shadow.md }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              multiline
              onSubmitEditing={() => void send(draft)}
              // Web: Enter sends, Shift+Enter adds a line (native uses submitBehavior below).
              onKeyPress={(e) => {
                const ev = e.nativeEvent as unknown as { key: string; shiftKey?: boolean };
                if (Platform.OS === 'web' && ev.key === 'Enter' && !ev.shiftKey) {
                  (e as unknown as { preventDefault: () => void }).preventDefault();
                  void send(draft);
                }
              }}
              submitBehavior="submit"
              placeholder={t('assistant.placeholder')}
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel={t('assistant.placeholder')}
              style={{ flex: 1, minWidth: 0, minHeight: 44, maxHeight: 120, paddingVertical: 12, color: colors.text, fontSize: typography.body.fontSize, fontFamily: fontFamily.regular }}
            />
            <PressableScale accessibilityRole="button" accessibilityLabel={t('home.capture_send')} disabled={!draft.trim() || thinking} onPress={() => void send(draft)} style={{ opacity: draft.trim() && !thinking ? 1 : 0.45 }}>
              <Gradient variant="ai" style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="arrow-up" size={20} tone={colors.onPrimary} />
              </Gradient>
            </PressableScale>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Avatar() {
  return (
    <Gradient variant="ai" style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
      <Text variant="caption" weight="bold" tone="#FFFFFF">V</Text>
    </Gradient>
  );
}

function UserBubble({ text }: { text: string }) {
  const { colors, spacing, radius } = useTheme();
  return (
    <Animated.View entering={FadeInDown.duration(220)} style={{ alignSelf: 'flex-end', maxWidth: '85%', backgroundColor: colors.primary, borderRadius: radius.lg, borderBottomRightRadius: 6, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
      <Text variant="body" tone={colors.onPrimary}>{text}</Text>
    </Animated.View>
  );
}

/** Veyra's message: soft gradient accent on the left edge, text, then cards. */
function AssistantBubble({ message, onConfirm }: { message: AssistantMessage; onConfirm: (m: AssistantMessage, c: Extract<Card, { type: 'proposal' }>) => void }) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const payload = (message.payload as ChatPayload | null) ?? { cards: [], suggestions: [] };
  return (
    <Animated.View entering={FadeInDown.duration(300)} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', maxWidth: '100%' }}>
      <Avatar />
      <View style={{ flex: 1, gap: spacing.sm, minWidth: 0 }}>
        {message.text ? (
          <View style={{ flexDirection: 'row', backgroundColor: colors.aiWash, borderRadius: radius.lg, borderTopLeftRadius: 6, overflow: 'hidden' }}>
            <Gradient variant="brand" style={{ width: 3 }} />
            <View style={{ flex: 1, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
              <MarkdownView source={message.text} />
            </View>
          </View>
        ) : null}
        {payload.cards.map((c, i) => (
          <CardView key={c.type === 'proposal' ? c.id : `${c.type}${i}`} card={c} onConfirm={(card) => onConfirm(message, card)} onDismiss={(card) => background(updateCard(message, card.id, { state: 'dismissed' }), 'Dismiss proposal')} />
        ))}
        {payload.source === 'claude' ? <Tag label="Claude" tint="focus" icon="zap" /> : null}
        {payload.cards.some((c) => c.type === 'proposal' && c.state === 'pending') ? <Text variant="caption" color="textTertiary">{t('assistant.confirm_hint')}</Text> : null}
      </View>
    </Animated.View>
  );
}
