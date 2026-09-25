// Contract of the `gmail` Edge Function, shared by the function and the app (src/features/gmail).
// Pure TypeScript — no Deno globals — so vitest can test it from the app side.

// ── wire types ──
export type Address = { name: string | null; email: string };

/** A thread whose latest message came from someone else — it is waiting on the person's reply. */
export type InboxThread = {
  id: string;
  subject: string;
  from: Address;
  snippet: string;
  /** Epoch ms of the latest message. */
  lastAt: number;
  messageCount: number;
  unread: boolean;
};

/** `scope`: the Google account is linked but Gmail access was not granted (or was unticked). */
export type GmailStatus = 'ok' | 'reauth' | 'scope' | 'error';
export type InboxAccount = { id: string; email: string; status: GmailStatus; threads?: InboxThread[] };

export type ThreadInsight = {
  summary: string;
  keyPoints: string[];
  /** Draft body in the thread's language, ready to edit. Empty when no reply is needed. */
  suggestedReply: string;
  /** Days to wait before chasing, when a follow-up makes sense; null otherwise. */
  followUpDays: number | null;
};

// ── Gmail API shapes (only the fields we ask for) ──
export type GHeader = { name: string; value: string };
export type GPart = { mimeType?: string; filename?: string; headers?: GHeader[]; body?: { data?: string; size?: number }; parts?: GPart[] };
export type GMessage = { id: string; threadId?: string; labelIds?: string[]; snippet?: string; internalDate?: string; payload?: GPart };
export type GThread = { id: string; messages?: GMessage[] };

export const header = (msg: GMessage | undefined, name: string): string =>
  msg?.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

/** `"Somchai J." <somchai@example.com>` → { name, email }. Takes the first address of a list. */
export function parseAddress(raw: string): Address {
  const angle = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/);
  if (angle) return { name: angle[1].trim() || null, email: angle[2].trim().toLowerCase() };
  const bare = raw.match(/[^\s,<>"]+@[^\s,<>"]+/);
  return { name: null, email: (bare?.[0] ?? raw.trim()).toLowerCase() };
}

const AUTOMATED_SENDER = /^(no-?reply|do-?not-?reply|noreply|notifications?|alerts?|mailer-daemon|postmaster|bounce[s]?)([+.\-_].*)?@/i;

/** Newsletters, receipts and robots never wait on a reply. */
export function isAutomated(msg: GMessage): boolean {
  if (AUTOMATED_SENDER.test(parseAddress(header(msg, 'From')).email)) return true;
  if (header(msg, 'List-Unsubscribe') || header(msg, 'List-Id')) return true;
  if (/^(bulk|list|junk)$/i.test(header(msg, 'Precedence').trim())) return true;
  const auto = header(msg, 'Auto-Submitted').trim().toLowerCase();
  return !!auto && auto !== 'no';
}

const fromMe = (msg: GMessage, me: string) => msg.labelIds?.includes('SENT') || parseAddress(header(msg, 'From')).email === me.toLowerCase();

/**
 * The thread as an inbox row if it is waiting on a reply from `me`: its latest real message
 * (drafts skipped) is from someone else, still in the inbox, and not automated. Otherwise null.
 */
export function awaitingReply(thread: GThread, me: string): InboxThread | null {
  const messages = (thread.messages ?? []).filter((m) => !m.labelIds?.includes('DRAFT'));
  const last = messages[messages.length - 1];
  if (!last || fromMe(last, me) || !last.labelIds?.includes('INBOX') || isAutomated(last)) return null;
  return {
    id: thread.id,
    subject: header(last, 'Subject').trim() || header(messages[0], 'Subject').trim(),
    from: parseAddress(header(last, 'From')),
    snippet: decodeEntities(last.snippet ?? ''),
    lastAt: Number(last.internalDate) || 0,
    messageCount: messages.length,
    unread: messages.some((m) => m.labelIds?.includes('UNREAD')),
  };
}

/** Gmail snippets arrive HTML-escaped. */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

// ── message text ──
function b64urlToUtf8(data: string): string {
  const bin = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Plain text of a message: the text/plain part if there is one, else the HTML part stripped. */
export function messageText(payload: GPart | undefined): string {
  let plain = '';
  let html = '';
  const walk = (part: GPart | undefined) => {
    if (!part) return;
    if (part.filename) return; // attachment
    const data = part.body?.data;
    if (data && part.mimeType === 'text/plain' && !plain) plain = b64urlToUtf8(data);
    else if (data && part.mimeType === 'text/html' && !html) html = b64urlToUtf8(data);
    part.parts?.forEach(walk);
  };
  walk(payload);
  return (plain || htmlToText(html)).replace(/\r\n/g, '\n').trim();
}

/** Drop the quoted history under a reply ("On … wrote:", "> …") so each message is counted once. */
export function stripQuoted(text: string): string {
  const lines = text.split('\n');
  const cut = lines.findIndex(
    (l, i) =>
      /^On .+ wrote:\s*$/.test(l) ||
      /^เมื่อ .+ เขียนว่า:?\s*$/.test(l) ||
      /^-{2,}\s*(Original Message|Forwarded message)\s*-{2,}/i.test(l) ||
      (/^From:\s/.test(l) && i > 0 && lines[i - 1].trim() === '' && /^(Sent|Date):\s/.test(lines[i + 1] ?? '')),
  );
  return (cut >= 0 ? lines.slice(0, cut) : lines)
    .filter((l) => !l.startsWith('>'))
    .join('\n')
    .trim();
}

// ── reply draft (RFC 2822, gmail.compose) ──
export const replySubject = (subject: string) => (/^(re|ตอบกลับ)\s*:/i.test(subject.trim()) ? subject.trim() : `Re: ${subject.trim()}`);

const utf8B64 = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};
/** RFC 2047 for non-ASCII header values (Thai subjects / names). */
const encodeHeader = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${utf8B64(s)}?=`);
const formatAddress = (a: Address) => (a.name ? `${encodeHeader(a.name.replace(/["\r\n]/g, ''))} <${a.email}>` : a.email);
const noBreaks = (s: string) => s.replace(/[\r\n]+/g, ' ').trim();

export type ReplyParts = { to: Address; subject: string; inReplyTo: string; references: string; body: string };

/** Reply headers for the thread's latest message: to its Reply-To (or From), threaded by Message-ID. */
export function replyPartsFor(last: GMessage, body: string): ReplyParts {
  const messageId = noBreaks(header(last, 'Message-ID') || header(last, 'Message-Id'));
  const refs = noBreaks(header(last, 'References'));
  return {
    to: parseAddress(header(last, 'Reply-To') || header(last, 'From')),
    subject: replySubject(noBreaks(header(last, 'Subject'))),
    inReplyTo: messageId,
    references: [refs, messageId].filter(Boolean).join(' '),
    body,
  };
}

/** base64url of the raw message, for `users.drafts.create`. */
export function buildReplyRaw(p: ReplyParts): string {
  const lines = [
    `To: ${formatAddress(p.to)}`,
    `Subject: ${encodeHeader(p.subject)}`,
    ...(p.inReplyTo ? [`In-Reply-To: ${p.inReplyTo}`] : []),
    ...(p.references ? [`References: ${p.references}`] : []),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    (utf8B64(p.body.replace(/\r?\n/g, '\r\n')).match(/.{1,76}/g) ?? []).join('\r\n'),
  ];
  return utf8B64(lines.join('\r\n')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── AI summary (structured output) ──
/** Same rules as capture-contract: every key required, optional values nullable, limits enforced below. */
export const INSIGHT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: '1–2 sentences: what this thread is about and what is being asked of the user' },
    keyPoints: { type: 'array', items: { type: 'string' }, description: 'At most 4 short facts: amounts, dates, deadlines, decisions, attachments mentioned' },
    suggestedReply: { type: 'string', description: 'Reply body only (greeting to sign-off), in the language of the thread; empty string if no reply is needed' },
    followUpDays: { anyOf: [{ type: 'integer' }, { type: 'null' }], description: 'Days to wait for their answer before chasing (1–14), or null if no follow-up is needed' },
  },
  required: ['summary', 'keyPoints', 'suggestedReply', 'followUpDays'],
  additionalProperties: false,
} as const;

const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Never throws — a bad response still gives the app a usable (if empty) insight. */
export function normalizeInsight(raw: unknown): ThreadInsight {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const days = typeof r.followUpDays === 'number' && Number.isFinite(r.followUpDays) ? Math.round(r.followUpDays) : null;
  return {
    summary: clean(r.summary).slice(0, 600),
    keyPoints: (Array.isArray(r.keyPoints) ? r.keyPoints : []).map(clean).filter(Boolean).slice(0, 4).map((p) => p.slice(0, 200)),
    suggestedReply: clean(r.suggestedReply).slice(0, 4000),
    followUpDays: days === null ? null : Math.min(14, Math.max(1, days)),
  };
}

export const MAX_REPLY_CHARS = 5000;
