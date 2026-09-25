import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { create } from 'zustand';

import { Mascot } from '@/components/brand/mascot';
import { Button, Card, IconButton, Screen, Text } from '@/components/ui';
import { ThreadCard } from '@/features/gmail/components/thread-card';
import {
  completeGmailConnect,
  connectGmail,
  gmailEnabled,
  mergeInbox,
  revokeAccount,
  useInbox,
  type GmailConnectResult,
  type GmailReturn,
  type InboxAccount,
} from '@/features/gmail';
import { useConfirm } from '@/lib/use-confirm';
import { useTheme } from '@/theme';

const LINK_ERRORS = ['denied', 'scope', 'too_many_accounts', 'not_configured'];

type Notice = { text: string; error?: boolean } | null;
// Outside the component: finishing a redirect replaces the route, which remounts the screen.
const useLinkUi = create<{ busy: boolean; notice: Notice }>(() => ({ busy: false, notice: null }));

/** P4-01: emails waiting on a reply, across every Google account linked for Gmail. */
export default function InboxScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const inbox = useInbox();
  const params = useLocalSearchParams<GmailReturn>();
  const [openId, setOpenId] = useState<string | null>(null);
  const { busy, notice } = useLinkUi();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  /** Link / re-link / remove, then reload the inbox and say what happened. */
  const act = async (work: () => Promise<GmailConnectResult | void>) => {
    const errorText = (code: string) => t(`gmail.link_error_${LINK_ERRORS.includes(code) ? code : 'failed'}`);
    useLinkUi.setState({ busy: true, notice: null });
    let next: Notice = null;
    try {
      const r = await work();
      if (r && 'email' in r) next = { text: t('gmail.linked', { email: r.email }) };
      else if (r && 'error' in r) next = { text: errorText(r.error), error: true };
    } catch (e) {
      console.error('Gmail link failed:', e);
      next = { text: errorText(e instanceof Error ? e.message : ''), error: true };
    }
    useLinkUi.setState({ busy: false, notice: next });
    void inbox.refetch();
  };

  // Back from Google (web, or Android's deep link): ?gmail=<ticket> | ?gmail_error=<code>.
  const { gmail, gmail_error } = params;
  useEffect(() => {
    if (!gmail && !gmail_error) return;
    // Drop the params so a reload doesn't re-claim a used ticket.
    router.replace('/inbox');
    void act(() => completeGmailConnect({ gmail, gmail_error }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per redirect; `act` only sets the store
  }, [gmail, gmail_error]);

  const accounts = inbox.data ?? [];
  const rows = mergeInbox(accounts);
  const problems = accounts.filter((a) => a.status !== 'ok');
  const multi = accounts.length > 1;

  return (
    <Screen maxWidth={720}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginLeft: -spacing.sm }}>
        <IconButton icon="chevron-left" label={t('common.back')} onPress={back} />
        <View style={{ flex: 1 }}>
          <Text variant="title" accessibilityRole="header">{t('gmail.title')}</Text>
          {inbox.data && accounts.length ? <Text variant="caption" color="textSecondary">{t('gmail.subtitle', { count: rows.length })}</Text> : null}
        </View>
        {gmailEnabled && accounts.length ? (
          <IconButton icon="refresh-cw" label={inbox.isFetching ? t('gmail.refreshing') : t('gmail.refresh')} onPress={() => !inbox.isFetching && void inbox.refetch()} />
        ) : null}
      </View>

      {notice ? (
        <Text variant="caption" color={notice.error ? 'danger' : 'success'} accessibilityLiveRegion="polite">{notice.text}</Text>
      ) : null}

      {!gmailEnabled ? (
        <EmptyState pose="oops" title={t('gmail.title')} body={t('gmail.unavailable')} />
      ) : inbox.isPending ? (
        <EmptyState pose="search" title={t('gmail.loading')} body={t('gmail.loading_body')} />
      ) : inbox.isError ? (
        <EmptyState pose="oops" title={t('gmail.error_title')} body={t('gmail.error_load')}>
          <Button size="sm" variant="secondary" icon="refresh-cw" label={t('gmail.retry')} onPress={() => void inbox.refetch()} />
        </EmptyState>
      ) : !accounts.length ? (
        <EmptyState pose="wave" title={t('gmail.connect_title')} body={t('gmail.connect_body')}>
          <Button size="sm" icon="mail" label={busy ? t('gmail.working') : t('gmail.connect')} disabled={busy} onPress={() => void act(() => connectGmail())} />
        </EmptyState>
      ) : (
        <>
          {problems.map((a) => (
            <AccountProblem key={a.id} account={a} busy={busy} onReconnect={() => void act(() => connectGmail(a.email))} />
          ))}
          {rows.length ? (
            <Card padding="md" style={{ gap: 0, paddingVertical: spacing.xs }}>
              {rows.map((row, i) => (
                <View key={`${row.accountId}/${row.id}`} style={i ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined}>
                  {multi ? <Text variant="caption" color="textTertiary" style={{ paddingTop: spacing.sm, paddingHorizontal: spacing.xs }}>{row.accountEmail}</Text> : null}
                  <ThreadCard row={row} open={openId === `${row.accountId}/${row.id}`} onToggle={() => setOpenId((cur) => (cur === `${row.accountId}/${row.id}` ? null : `${row.accountId}/${row.id}`))} />
                </View>
              ))}
            </Card>
          ) : problems.length < accounts.length ? (
            <EmptyState pose="celebrate" title={t('gmail.all_clear')} body={t('gmail.all_clear_body')} />
          ) : null}

          <View style={{ gap: spacing.xs }}>
            <Text variant="overline" color="textSecondary">{t('gmail.accounts').toUpperCase()}</Text>
            {accounts.map((a) => (
              <AccountRow key={a.id} account={a} busy={busy} onRemove={() => void act(() => revokeAccount(a.id).then(() => undefined))} />
            ))}
            <View style={{ alignItems: 'flex-start' }}>
              <Button size="sm" variant="ghost" icon="plus" label={t('gmail.add_another')} disabled={busy} onPress={() => void act(() => connectGmail())} />
            </View>
          </View>
          <Text variant="caption" color="textTertiary" align="center">{t('gmail.privacy')}</Text>
        </>
      )}
    </Screen>
  );
}

/** Access expired (every 7 days while Gmail's client is in Google's Testing mode) or permission unticked. */
function AccountProblem({ account, busy, onReconnect }: { account: InboxAccount; busy: boolean; onReconnect: () => void }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const text = account.status === 'scope' ? t('gmail.needs_scope', { email: account.email }) : account.status === 'reauth' ? t('gmail.needs_reauth', { email: account.email }) : t('gmail.account_error', { email: account.email });
  return (
    <Card variant="muted" padding="md" style={{ gap: spacing.sm }}>
      <Text variant="bodySm">{text}</Text>
      {account.status !== 'error' ? (
        <View style={{ alignItems: 'flex-start' }}>
          <Button size="sm" variant="secondary" icon="refresh-cw" label={t('gmail.reconnect')} disabled={busy} onPress={onReconnect} />
        </View>
      ) : null}
    </Card>
  );
}

function AccountRow({ account, busy, onRemove }: { account: InboxAccount; busy: boolean; onRemove: () => void }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { armed, confirm } = useConfirm();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 }}>
      <Text variant="bodySm" numberOfLines={1} style={{ flex: 1 }}>{account.email}</Text>
      <Button size="sm" variant="ghost" label={armed ? t('gmail.remove_confirm') : t('gmail.remove')} accessibilityHint={t('gmail.remove_hint', { email: account.email })} disabled={busy} onPress={() => confirm(onRemove)} />
    </View>
  );
}

function EmptyState({ pose, title, body, children }: { pose: 'search' | 'oops' | 'wave' | 'celebrate'; title: string; body: string; children?: ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxxl }}>
      <Mascot pose={pose} size={104} />
      <Text variant="heading" align="center">{title}</Text>
      <Text variant="bodySm" color="textSecondary" align="center" style={{ maxWidth: 360 }}>{body}</Text>
      {children}
    </View>
  );
}
