import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Mascot } from '@/components/brand/mascot';
import { Button, Card, IconButton, Screen, Text } from '@/components/ui';
import { ThreadCard } from '@/features/gmail/components/thread-card';
import { gmailEnabled, mergeInbox, useInbox, type InboxAccount } from '@/features/gmail';
import { connectGoogle } from '@/features/google-calendar';
import { useTheme } from '@/theme';

/** P4-01: emails waiting on a reply, across every linked Google account. */
export default function InboxScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const inbox = useInbox();
  const [openId, setOpenId] = useState<string | null>(null);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

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
          <Button size="sm" icon="mail" label={t('gmail.connect')} onPress={() => void connectGoogle().then(() => inbox.refetch())} />
        </EmptyState>
      ) : (
        <>
          {problems.map((a) => (
            <AccountProblem key={a.id} account={a} onFixed={() => void inbox.refetch()} />
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
          <Text variant="caption" color="textTertiary" align="center">{t('gmail.privacy')}</Text>
        </>
      )}
    </Screen>
  );
}

/** Account linked for Calendar but Gmail isn't usable yet: ask again with Gmail ticked, or reconnect. */
function AccountProblem({ account, onFixed }: { account: InboxAccount; onFixed: () => void }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const text = account.status === 'scope' ? t('gmail.needs_scope', { email: account.email }) : account.status === 'reauth' ? t('gmail.needs_reauth', { email: account.email }) : t('gmail.account_error', { email: account.email });
  return (
    <Card variant="muted" padding="md" style={{ gap: spacing.sm }}>
      <Text variant="bodySm">{text}</Text>
      {account.status !== 'error' ? (
        <View style={{ alignItems: 'flex-start' }}>
          <Button size="sm" variant="secondary" icon="unlock" label={t('gmail.allow')} onPress={() => void connectGoogle(account.email).then(onFixed)} />
        </View>
      ) : null}
    </Card>
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
