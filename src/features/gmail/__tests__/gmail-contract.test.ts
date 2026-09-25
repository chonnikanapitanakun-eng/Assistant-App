import { describe, expect, it } from 'vitest';

import {
  awaitingReply,
  buildReplyRaw,
  isAutomated,
  messageText,
  normalizeInsight,
  parseAddress,
  replyPartsFor,
  replySubject,
  stripQuoted,
  type GMessage,
} from '../../../../supabase/functions/_shared/gmail-contract';

const b64url = (s: string) => Buffer.from(s, 'utf8').toString('base64url');
const fromB64url = (s: string) => Buffer.from(s, 'base64url').toString('utf8');

const msg = (headers: Record<string, string>, labelIds: string[] = ['INBOX'], extra: Partial<GMessage> = {}): GMessage => ({
  id: Math.random().toString(16).slice(2),
  labelIds,
  internalDate: '1758700000000',
  snippet: 'Hi &amp; thanks',
  payload: { headers: Object.entries(headers).map(([name, value]) => ({ name, value })) },
  ...extra,
});

const ME = 'proud@example.com';

describe('parseAddress', () => {
  it('reads name + address', () => {
    expect(parseAddress('"Somchai J." <Somchai@Example.com>')).toEqual({ name: 'Somchai J.', email: 'somchai@example.com' });
    expect(parseAddress('คุณแดง <daeng@example.co.th>')).toEqual({ name: 'คุณแดง', email: 'daeng@example.co.th' });
  });
  it('reads a bare address', () => {
    expect(parseAddress('john@example.com')).toEqual({ name: null, email: 'john@example.com' });
  });
});

describe('awaitingReply', () => {
  it('keeps a thread whose last message is from someone else', () => {
    const t = awaitingReply(
      { id: 'abc123', messages: [msg({ From: ME, Subject: 'VAT return' }, ['SENT']), msg({ From: 'John <john@client.co.uk>', Subject: 'Re: VAT return' }, ['INBOX', 'UNREAD'])] },
      ME,
    );
    expect(t).toMatchObject({ id: 'abc123', subject: 'Re: VAT return', from: { email: 'john@client.co.uk' }, snippet: 'Hi & thanks', messageCount: 2, unread: true });
  });
  it('drops threads I replied to last (by label or by From)', () => {
    expect(awaitingReply({ id: 'a1b2c3', messages: [msg({ From: 'john@client.co.uk' }), msg({ From: 'x@y.z' }, ['SENT'])] }, ME)).toBeNull();
    expect(awaitingReply({ id: 'a1b2c3', messages: [msg({ From: 'john@client.co.uk' }), msg({ From: `Proud <${ME.toUpperCase()}>` }, ['INBOX'])] }, ME)).toBeNull();
  });
  it('ignores my unsent draft at the end', () => {
    const t = awaitingReply({ id: 'a1b2c3', messages: [msg({ From: 'john@client.co.uk', Subject: 'Q' }), msg({ From: ME }, ['DRAFT'])] }, ME);
    expect(t?.messageCount).toBe(1);
  });
  it('drops archived and automated mail', () => {
    expect(awaitingReply({ id: 'a1b2c3', messages: [msg({ From: 'john@client.co.uk' }, [])] }, ME)).toBeNull();
    expect(awaitingReply({ id: 'a1b2c3', messages: [msg({ From: 'no-reply@bank.com' })] }, ME)).toBeNull();
    expect(awaitingReply({ id: 'a1b2c3', messages: [msg({ From: 'news@shop.com', 'List-Unsubscribe': '<mailto:u@shop.com>' })] }, ME)).toBeNull();
  });
});

describe('isAutomated', () => {
  it('flags robots, not people', () => {
    expect(isAutomated(msg({ From: 'notifications@github.com' }))).toBe(true);
    expect(isAutomated(msg({ From: 'a@b.com', 'Auto-Submitted': 'auto-replied' }))).toBe(true);
    expect(isAutomated(msg({ From: 'a@b.com', Precedence: 'bulk' }))).toBe(true);
    expect(isAutomated(msg({ From: 'a@b.com', 'Auto-Submitted': 'no' }))).toBe(false);
    expect(isAutomated(msg({ From: 'noreen@b.com' }))).toBe(false);
  });
});

describe('messageText', () => {
  it('prefers text/plain and decodes UTF-8', () => {
    const payload = {
      mimeType: 'multipart/alternative',
      parts: [
        { mimeType: 'text/plain', body: { data: b64url('สวัสดีค่ะ\r\nยอด £1,200') } },
        { mimeType: 'text/html', body: { data: b64url('<p>ignored</p>') } },
      ],
    };
    expect(messageText(payload)).toBe('สวัสดีค่ะ\nยอด £1,200');
  });
  it('falls back to stripped HTML and skips attachments', () => {
    const payload = {
      mimeType: 'multipart/mixed',
      parts: [
        { mimeType: 'text/plain', filename: 'notes.txt', body: { data: b64url('attachment') } },
        { mimeType: 'text/html', body: { data: b64url('<style>p{}</style><p>Hello&nbsp;there</p><p>Line&amp;2</p>') } },
      ],
    };
    expect(messageText(payload)).toBe('Hello there\nLine&2');
  });
});

describe('stripQuoted', () => {
  it('cuts the quoted history', () => {
    expect(stripQuoted('Sounds good.\n\nOn Mon, 1 Sep 2026 at 10:00, John <j@x.com> wrote:\n> old')).toBe('Sounds good.');
    expect(stripQuoted('ok\n> quoted\nmore')).toBe('ok\nmore');
  });
});

describe('reply draft', () => {
  const last = msg({
    From: 'John Smith <john@client.co.uk>',
    'Reply-To': 'accounts@client.co.uk',
    Subject: 'ภาษี VAT Q3',
    'Message-ID': '<m2@client.co.uk>',
    References: '<m1@client.co.uk>',
  });

  it('threads the reply and addresses Reply-To', () => {
    const p = replyPartsFor(last, 'Thanks John');
    expect(p).toMatchObject({ to: { email: 'accounts@client.co.uk' }, subject: 'Re: ภาษี VAT Q3', inReplyTo: '<m2@client.co.uk>', references: '<m1@client.co.uk> <m2@client.co.uk>' });
  });

  it('builds a UTF-8 RFC 2822 message', () => {
    const raw = fromB64url(buildReplyRaw(replyPartsFor(last, 'เรียนคุณจอห์น\nได้รับแล้วค่ะ')));
    const [head, body] = raw.split('\r\n\r\n');
    expect(head).toContain('To: accounts@client.co.uk');
    expect(head).toContain(`Subject: =?UTF-8?B?${Buffer.from('Re: ภาษี VAT Q3').toString('base64')}?=`);
    expect(head).toContain('In-Reply-To: <m2@client.co.uk>');
    expect(Buffer.from(body.replace(/\r\n/g, ''), 'base64').toString('utf8')).toBe('เรียนคุณจอห์น\r\nได้รับแล้วค่ะ');
  });

  it('keeps an existing Re: and blocks header injection', () => {
    expect(replySubject('RE: hello')).toBe('RE: hello');
    const p = replyPartsFor(msg({ From: 'a@b.com', Subject: 'hi\r\nBcc: evil@x.com' }), 'x');
    expect(p.subject).toBe('Re: hi Bcc: evil@x.com');
  });
});

describe('normalizeInsight', () => {
  it('clamps and trims', () => {
    expect(normalizeInsight({ summary: ' s ', keyPoints: ['a', '', 'b', 'c', 'd', 'e'], suggestedReply: ' r ', followUpDays: 30 })).toEqual({
      summary: 's',
      keyPoints: ['a', 'b', 'c', 'd'],
      suggestedReply: 'r',
      followUpDays: 14,
    });
  });
  it('never throws on junk', () => {
    expect(normalizeInsight('nope')).toEqual({ summary: '', keyPoints: [], suggestedReply: '', followUpDays: null });
  });
});
