import { useQuery } from '@tanstack/react-query';

import { fetchInbox, fetchInsight, gmailEnabled } from './remote';

const INBOX_KEY = ['gmail', 'inbox'] as const;

/** Threads waiting on a reply, across every linked Google account. Refetched when the screen opens again after 5 minutes. */
export function useInbox() {
  return useQuery({ queryKey: INBOX_KEY, queryFn: fetchInbox, enabled: gmailEnabled, staleTime: 5 * 60_000, gcTime: 30 * 60_000 });
}

/** Claude's summary + suggested reply for one thread — only fetched once the thread is opened. */
export function useInsight(accountId: string, threadId: string, locale: 'th' | 'en', enabled: boolean) {
  return useQuery({
    queryKey: ['gmail', 'insight', accountId, threadId, locale],
    queryFn: () => fetchInsight(accountId, threadId, locale),
    enabled: gmailEnabled && enabled,
    gcTime: 30 * 60_000,
  });
}
