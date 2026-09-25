import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, TextInput, View } from 'react-native';

import { Avatar, Button, Chip, Icon, PressableScale, Text, useInputStyle } from '@/components/ui';
import { createTask } from '@/features/tasks/queries';
import { useAsyncAction } from '@/lib/use-async-action';
import { useTheme } from '@/theme';

import { followUpTask, gmailThreadUrl, waitingDays, type InboxRow } from '../model';
import { useInsight } from '../queries';
import { GmailError, saveDraft } from '../remote';

const FOLLOW_UP_DAYS = [1, 3, 7];

/** One waiting thread. Tap to open: Claude's summary, an editable reply to save as a Gmail draft, and follow-up reminders. */
export function ThreadCard({ row, open, onToggle }: { row: InboxRow; open: boolean; onToggle: () => void }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const days = waitingDays(row.lastAt);
  const sender = row.from.name ?? row.from.email;
  const age = days === 0 ? t('gmail.today') : t('gmail.days_ago', { count: days });

  return (
    <View>
      <PressableScale
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${sender}: ${row.subject}, ${age}`}
        onPress={onToggle}
        style={{ flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xs }}
      >
        <Avatar name={sender} size={40} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            {row.unread ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} /> : null}
            <Text variant="subheading" weight={row.unread ? 'semibold' : undefined} numberOfLines={1} style={{ flex: 1 }}>{sender}</Text>
            <Text variant="caption" tone={days >= 3 ? colors.danger : colors.textSecondary}>{age}</Text>
          </View>
          <Text variant="label" numberOfLines={1}>{row.subject || t('gmail.no_subject')}</Text>
          {!open ? <Text variant="bodySm" color="textSecondary" numberOfLines={2}>{row.snippet}</Text> : null}
        </View>
      </PressableScale>
      {open ? <ThreadDetail row={row} locale={i18n.language === 'th' ? 'th' : 'en'} /> : null}
    </View>
  );
}

function ThreadDetail({ row, locale }: { row: InboxRow; locale: 'th' | 'en' }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const inputStyle = useInputStyle();
  const insight = useInsight(row.accountId, row.id, locale, true);
  // Claude's suggestion until the person types; their edits win after that.
  const [edited, setReply] = useState<string | null>(null);
  const reply = edited ?? insight.data?.suggestedReply ?? '';
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const draft = useAsyncAction();
  const followUp = useAsyncAction();

  const saveReply = () =>
    draft.run(async () => {
      try {
        await saveDraft(row.accountId, row.id, reply);
        setNotice({ text: t('gmail.draft_saved') });
      } catch (e) {
        setNotice({ text: t(e instanceof GmailError && e.message === 'scope' ? 'gmail.error_scope' : 'gmail.error_draft'), error: true });
        throw e;
      }
    });

  const remind = (days: number) =>
    followUp.run(async () => {
      const values = followUpTask(row, days, t('gmail.follow_up_title', { subject: row.subject || row.from.email }));
      await createTask(values);
      const [y, m, d] = values.date!.split('-').map(Number);
      const when = new Date(y, m - 1, d).toLocaleDateString(i18n.language === 'th' ? 'th-TH' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      setNotice({ text: t('gmail.follow_up_set', { when }) });
    });

  const openInGmail = () => {
    const url = gmailThreadUrl(row.accountEmail, row.id);
    if (Platform.OS === 'web') window.open(url, '_blank', 'noopener');
    else void WebBrowser.openBrowserAsync(url);
  };

  return (
    <View style={{ gap: spacing.md, paddingBottom: spacing.lg, paddingHorizontal: spacing.xs }}>
      <View style={{ gap: spacing.sm, backgroundColor: colors.aiWash, borderRadius: radius.lg, padding: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Icon name="zap" size={14} />
          <Text variant="overline" color="primary">{t('gmail.ai_summary').toUpperCase()}</Text>
        </View>
        {insight.isPending ? (
          <Text variant="bodySm" color="textSecondary" accessibilityLiveRegion="polite">{t('gmail.summarising')}</Text>
        ) : insight.isError ? (
          <View style={{ gap: spacing.sm, alignItems: 'flex-start' }}>
            <Text variant="bodySm" color="danger">{t('gmail.error_summary')}</Text>
            <Button size="sm" variant="ghost" icon="refresh-cw" label={t('gmail.retry')} onPress={() => void insight.refetch()} />
          </View>
        ) : (
          <>
            <Text variant="body">{insight.data.summary}</Text>
            {insight.data.keyPoints.map((p) => (
              <View key={p} style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Text variant="bodySm" color="textSecondary">•</Text>
                <Text variant="bodySm" style={{ flex: 1 }}>{p}</Text>
              </View>
            ))}
          </>
        )}
      </View>

      <View style={{ gap: spacing.xs }}>
        <Text variant="label" color="textSecondary">{t('gmail.reply')}</Text>
        <TextInput
          value={reply}
          onChangeText={setReply}
          multiline
          editable={!insight.isPending}
          placeholder={insight.isPending ? t('gmail.summarising') : t('gmail.reply_placeholder')}
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel={t('gmail.reply')}
          style={[inputStyle(), { minHeight: 140, paddingVertical: spacing.md, textAlignVertical: 'top' }]}
        />
        <Text variant="caption" color="textTertiary">{t('gmail.reply_hint')}</Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Button size="sm" icon="edit-3" label={draft.busy ? t('gmail.saving') : t('gmail.save_draft')} disabled={draft.busy || !reply.trim()} onPress={() => void saveReply()} />
        <Button size="sm" variant="ghost" icon="external-link" label={t('gmail.open_in_gmail')} onPress={openInGmail} />
      </View>

      <View style={{ gap: spacing.xs }}>
        <Text variant="label" color="textSecondary">
          {insight.data?.followUpDays ? t('gmail.follow_up_suggested', { count: insight.data.followUpDays }) : t('gmail.follow_up')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {[...new Set([...(insight.data?.followUpDays ? [insight.data.followUpDays] : []), ...FOLLOW_UP_DAYS])]
            .sort((a, b) => a - b)
            .map((d) => (
              <Chip key={d} icon="bell" label={t('gmail.in_days', { count: d })} selected={d === insight.data?.followUpDays} onPress={() => void remind(d)} />
            ))}
        </View>
      </View>

      {notice ? (
        <Text variant="caption" color={notice.error ? 'danger' : 'success'} accessibilityLiveRegion="polite">{notice.text}</Text>
      ) : followUp.failed ? (
        <Text variant="caption" color="danger">{t('gmail.error_follow_up')}</Text>
      ) : null}
    </View>
  );
}
