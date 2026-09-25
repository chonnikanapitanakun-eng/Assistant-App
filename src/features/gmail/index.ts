export { completeGmailConnect, connectGmail, type GmailConnectResult, type GmailReturn } from './connect';
export { followUpTask, gmailThreadUrl, mergeInbox, waitingDays, type InboxRow } from './model';
export { useInbox, useInsight } from './queries';
export { gmailEnabled, GmailError, revokeAccount, saveDraft } from './remote';
export type { InboxAccount, InboxThread, ThreadInsight } from './types';
