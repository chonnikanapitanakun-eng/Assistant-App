/**
 * Links — "เกี่ยวข้องกับ" (docs/LINKS.md)
 *
 * A link is stored once (from → to) and read from both ends, so this module
 * is written in terms of the record being viewed (`self`) and the "other end".
 * Everything here is pure so it can be unit-tested and reused by the AI layer.
 */
import type { IconName } from '@/components/ui';
import type { Area, CalendarEvent, Contact, Link, LinkableType, Note, Task, Transaction } from '@/db';
import { formatMoney } from '@/lib/currency';
import type { TintName } from '@/theme';

export type LinkRef = { type: LinkableType; id: string };

/** `out`: self is the `from` end. `in`: self is the `to` end. */
export type Direction = 'out' | 'in';

/** Known relation values. `with` = a person on a record, `extracted` = pulled out of a note, `related` = manual. */
export type Relation = 'with' | 'extracted' | 'related';

/** One row of the "Related" section: the other end of a link, resolved to a label. */
export type RelatedItem = {
  linkId: string;
  ref: LinkRef;
  direction: Direction;
  relation: string | null;
  /** May be empty — the UI falls back to the type label. */
  title: string;
  subtitle: string | null;
};

/** A candidate to link to (picker result). */
export type Candidate = { ref: LinkRef; title: string; subtitle: string | null };

export const refKey = (r: LinkRef): string => `${r.type}:${r.id}`;
export const sameRef = (a: LinkRef, b: LinkRef): boolean => a.type === b.type && a.id === b.id;

/** Which end of `link` is not `self`, or null when `self` is not on the link. */
export function otherEnd(link: Pick<Link, 'fromType' | 'fromId' | 'toType' | 'toId'>, self: LinkRef): { ref: LinkRef; direction: Direction } | null {
  if (link.fromType === self.type && link.fromId === self.id) return { ref: { type: link.toType, id: link.toId }, direction: 'out' };
  if (link.toType === self.type && link.toId === self.id) return { ref: { type: link.fromType, id: link.fromId }, direction: 'in' };
  return null;
}

/** i18n key (under `links.`) describing how an item relates to the record being viewed. */
export function relationKey(relation: string | null, direction: Direction): string {
  switch (relation) {
    case 'with':
      return direction === 'out' ? 'rel_with' : 'rel_with_in';
    case 'extracted':
      return direction === 'out' ? 'rel_extracted' : 'rel_extracted_in';
    default:
      return 'rel_related';
  }
}

/** Default relation when the user links manually: people are "with", everything else "related". */
export const defaultRelation = (to: LinkableType): Relation => (to === 'contact' ? 'with' : 'related');

/** Detail route for a linked record, or null for types without a screen yet (contact, area). */
export function routeFor(ref: LinkRef): { pathname: '/task/[id]' | '/event/[id]' | '/tx/[id]' | '/note/[id]'; params: { id: string } } | null {
  switch (ref.type) {
    case 'task':
      return { pathname: '/task/[id]', params: { id: ref.id } };
    case 'event':
      return { pathname: '/event/[id]', params: { id: ref.id } };
    case 'transaction':
      return { pathname: '/tx/[id]', params: { id: ref.id } };
    case 'note':
      return { pathname: '/note/[id]', params: { id: ref.id } };
    default:
      return null;
  }
}

export const typeStyle: Record<LinkableType, { icon: IconName; tint: TintName }> = {
  contact: { icon: 'user', tint: 'personal' },
  event: { icon: 'calendar', tint: 'meeting' },
  task: { icon: 'check-square', tint: 'priorityLow' },
  transaction: { icon: 'credit-card', tint: 'priorityHigh' },
  note: { icon: 'file-text', tint: 'focus' },
  area: { icon: 'folder', tint: 'bill' },
};

/** Display order: people first, then time-bound things, then money, notes, areas. */
export const typeOrder: LinkableType[] = ['contact', 'event', 'task', 'transaction', 'note', 'area'];

/** Types the picker offers by default (areas are set through the record's own field). */
export const linkableInPicker: LinkableType[] = ['task', 'event', 'note', 'transaction', 'contact'];

export type LinkableRow =
  | { type: 'task'; row: Task }
  | { type: 'event'; row: CalendarEvent }
  | { type: 'transaction'; row: Transaction }
  | { type: 'note'; row: Note }
  | { type: 'contact'; row: Contact }
  | { type: 'area'; row: Area };

const locale = (lang: string) => (lang.startsWith('th') ? 'th-TH' : 'en-GB');

/** Title + subtitle for a linked record. Title may be '' (UI substitutes the type label). */
export function describe(item: LinkableRow, lang: string): { title: string; subtitle: string | null } {
  switch (item.type) {
    case 'task':
      return { title: item.row.title, subtitle: item.row.date ?? null };
    case 'event': {
      const d = new Date(item.row.start);
      const opts: Intl.DateTimeFormatOptions = item.row.isAllDay ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
      return { title: item.row.title, subtitle: d.toLocaleString(locale(lang), opts) };
    }
    case 'transaction': {
      const sign = item.row.type === 'income' ? '+' : item.row.type === 'expense' ? '−' : '';
      return { title: item.row.note ?? '', subtitle: `${sign}${formatMoney(item.row.amount, item.row.currency, 'en-GB')} · ${item.row.date}` };
    }
    case 'note': {
      // First line with real words, minus markdown prefixes (#, -, >, [ ]).
      const firstLine = item.row.body
        .split('\n')
        .map((l) => l.replace(/^[#>\-*\s[\]x]+/, '').trim())
        .find(Boolean) ?? '';
      const tags = item.row.tags?.length ? item.row.tags.map((t) => `#${t}`).join(' ') : null;
      return { title: item.row.title || firstLine.slice(0, 60), subtitle: tags };
    }
    case 'contact':
      return { title: item.row.name, subtitle: [item.row.role, item.row.company].filter(Boolean).join(' · ') || null };
    case 'area':
      return { title: lang.startsWith('th') ? item.row.nameTh : item.row.nameEn, subtitle: null };
  }
}

/** Stable order for the Related section: by type, then title. */
export function sortRelated<T extends { ref: LinkRef; title: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => typeOrder.indexOf(a.ref.type) - typeOrder.indexOf(b.ref.type) || a.title.localeCompare(b.title));
}
