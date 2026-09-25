import type { CalendarEvent, Contact, Task, Transaction } from '@/db';
import { parseCaptureLocally } from '@/features/ai/capture';
import type { CaptureItem } from '@/features/ai/types';
import { allDayKey } from '@/features/calendar/model';
import { toDateKey } from '@/lib/date';

import { parseBlocks, parseInline, plainText } from './markdown';

const inline = (t: string) => parseInline(t).map((s) => s.text).join('');

/**
 * On-device summary (no AI call): the headline, up to three key points from the
 * note's headings or bullets, and checklist progress. Honest about what it is.
 */
export function summarize(body: string) {
  const blocks = parseBlocks(body);
  const words = plainText(body).split(/\s+/).filter(Boolean).length;
  const checks = blocks.filter((b) => b.type === 'check');
  const headings = blocks.filter((b) => b.type === 'h2' || b.type === 'h3').map((b) => inline((b as { text: string }).text));
  const bullets = blocks.filter((b) => b.type === 'bullet' || b.type === 'number').map((b) => inline((b as { text: string }).text));
  const firstPara = blocks.find((b) => b.type === 'p');
  const sentences = firstPara && firstPara.type === 'p' ? inline(firstPara.text).split(/(?<=[.!?])\s+/).filter(Boolean) : [];
  const points = (headings.length >= 2 ? headings : bullets.length ? bullets : sentences).slice(0, 3);
  return {
    points,
    words,
    readMinutes: Math.max(1, Math.round(words / 200)),
    checklist: { done: checks.filter((c) => c.type === 'check' && c.checked).length, total: checks.length },
  };
}

/**
 * Find actionable items in a note: each line goes through the Quick Capture parser;
 * open checklist lines become tasks even without a date. Duplicate contacts are merged.
 */
export function extractItems(body: string, today: Date = new Date()): CaptureItem[] {
  const out: CaptureItem[] = [];
  const contacts = new Set<string>();
  for (const b of parseBlocks(body)) {
    if (b.type === 'hr' || b.type === 'code' || b.type === 'h1') continue;
    if (b.type === 'check' && b.checked) continue;
    const text = inline(b.text).trim();
    if (!text) continue;
    const found = parseCaptureLocally(text, today, { strictMoney: true }).filter((i) => i.type !== 'note');
    if (!found.length && b.type === 'check') found.push({ type: 'task', title: text });
    for (const item of found) {
      if (item.type === 'contact') {
        if (contacts.has(item.name.toLowerCase())) continue;
        contacts.add(item.name.toLowerCase());
      }
      out.push(item);
    }
  }
  return out;
}

/**
 * Identity of an extracted item, used to tell whether it was already saved from this note
 * (type + title + date; money uses type + note + amount, since an undated amount is saved with
 * today's date). Stable across re-parses, so editing other lines doesn't re-offer saved items.
 */
export function itemSignature(item: CaptureItem): string {
  const norm = (s?: string | null) => (s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  switch (item.type) {
    case 'task':
    case 'event':
      return `${item.type}|${norm(item.title)}|${item.date ?? ''}`;
    case 'expense':
    case 'income':
      return `${item.type}|${norm(item.note)}|${item.amount}`;
    case 'contact':
      return `contact|${norm(item.name)}`;
    case 'note':
      return `note|${norm(item.body)}`;
  }
}

/** Signature of a record saved by Extract (see `itemSignature`), or null for records Extract never creates. */
export function recordSignature(
  record: { type: 'task'; row: Pick<Task, 'title' | 'date'> } | { type: 'event'; row: Pick<CalendarEvent, 'title' | 'start' | 'isAllDay'> } | { type: 'transaction'; row: Pick<Transaction, 'type' | 'note' | 'amount' | 'currency'> } | { type: 'contact'; row: Pick<Contact, 'name'> },
): string | null {
  switch (record.type) {
    case 'task':
      return itemSignature({ type: 'task', title: record.row.title, date: record.row.date ?? undefined });
    case 'event': {
      const { title, start, isAllDay } = record.row;
      return itemSignature({ type: 'event', title, date: isAllDay ? allDayKey(start) : toDateKey(new Date(start)) });
    }
    case 'transaction': {
      const { type, note, amount, currency } = record.row;
      return type === 'transfer' ? null : itemSignature({ type, amount, currency, note: note ?? undefined });
    }
    case 'contact':
      return itemSignature({ type: 'contact', name: record.row.name });
  }
}

type Searchable = { title: string; body: string; tags: string[] | null };

/** Case-insensitive match on title, body and tags (works for Thai without word breaks). */
export function matchesQuery(note: Searchable, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [note.title, note.body, ...(note.tags ?? [])].some((s) => s.toLowerCase().includes(q));
}

/** All tags in use, most used first then alphabetical. */
export function allTags(notes: { tags: string[] | null }[]): string[] {
  const count = new Map<string, number>();
  for (const n of notes) for (const t of n.tags ?? []) count.set(t, (count.get(t) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}

/** "#Work , client " → "work", "client"-style normalisation for the tag input. */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#+/, '').replace(/\s+/g, '-').toLowerCase().slice(0, 30);
}
