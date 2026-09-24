/**
 * Universal search — pure helpers (no DB) so they can be unit tested.
 * The index is SQLite FTS5 with the trigram tokenizer (src/db/fts.sql): it matches
 * substrings, which is what makes Thai work without word segmentation, but it can't
 * match terms shorter than 3 characters. Those fall back to LIKE.
 */

/** Result groups, in display order. Matches `fts_index.type`. */
export const searchTypes = ['task', 'event', 'note', 'transaction', 'contact'] as const;
export type SearchType = (typeof searchTypes)[number];

export type SearchPlan = {
  /** FTS5 MATCH expression (implicit AND of quoted phrases), or null when every term is short. */
  match: string | null;
  /** LIKE patterns for terms the trigram index can't match. */
  likes: string[];
  /** Lower-cased terms, for highlighting. */
  terms: string[];
};

const MAX_TERMS = 8;
const charLength = (s: string) => [...s].length;

/** Split the query into terms and decide how each is matched. Null for an empty query. */
export function planSearch(input: string): SearchPlan | null {
  const terms = [...new Set(input.trim().toLowerCase().split(/\s+/).filter(Boolean))].slice(0, MAX_TERMS);
  if (!terms.length) return null;
  const long = terms.filter((t) => charLength(t) >= 3);
  const short = terms.filter((t) => charLength(t) < 3);
  return {
    match: long.length ? long.map((t) => `"${t.replace(/"/g, '""')}"`).join(' ') : null,
    likes: short.map((t) => `%${t.replace(/[\\%_]/g, (c) => `\\${c}`)}%`),
    terms,
  };
}

/** Keep the first hit per (type, id) — the index can hold duplicates — and bucket by type in rank order. */
export function bucketHits(hits: { type: string; id: string }[]): Record<SearchType, string[]> {
  const out = Object.fromEntries(searchTypes.map((t) => [t, [] as string[]])) as Record<SearchType, string[]>;
  const seen = new Set<string>();
  for (const h of hits) {
    const key = `${h.type}:${h.id}`;
    if (seen.has(key) || !(searchTypes as readonly string[]).includes(h.type)) continue;
    seen.add(key);
    out[h.type as SearchType].push(h.id);
  }
  return out;
}

/** Sort `rows` to follow `ids` (rank order); rows not in `ids` are dropped. */
export function orderByIds<T extends { id: string }>(rows: T[], ids: string[]): T[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

/** Earliest case-insensitive occurrence of any term. */
function firstMatch(text: string, terms: string[]): { start: number; end: number } | null {
  const lower = text.toLowerCase();
  let best: { start: number; end: number } | null = null;
  for (const term of terms) {
    const i = lower.indexOf(term);
    if (i >= 0 && (!best || i < best.start)) best = { start: i, end: i + term.length };
  }
  return best;
}

/** A single-line excerpt of `text` around the first match (or its start when nothing matches). */
export function snippet(text: string, terms: string[], radius = 40): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (!flat) return '';
  const m = firstMatch(flat, terms);
  if (!m || m.end <= radius * 2) return flat.length > radius * 2 ? `${flat.slice(0, radius * 2).trimEnd()}…` : flat;
  const start = Math.max(0, m.start - radius);
  const end = Math.min(flat.length, m.end + radius);
  return `${start > 0 ? '…' : ''}${flat.slice(start, end).trim()}${end < flat.length ? '…' : ''}`;
}

export type HighlightPart = { text: string; match: boolean };

/** Split `text` into matched / unmatched parts (case-insensitive, longest term wins on overlap). */
export function highlight(text: string, terms: string[]): HighlightPart[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const marks = new Array<boolean>(text.length).fill(false);
  for (const term of terms) {
    if (!term) continue;
    for (let i = lower.indexOf(term); i >= 0; i = lower.indexOf(term, i + 1)) marks.fill(true, i, i + term.length);
  }
  const parts: HighlightPart[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = parts[parts.length - 1];
    if (last && last.match === marks[i]) last.text += text[i];
    else parts.push({ text: text[i], match: marks[i] });
  }
  return parts;
}
