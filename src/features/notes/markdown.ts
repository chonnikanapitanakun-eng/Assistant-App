/**
 * Minimal markdown for notes: headings, paragraphs, bullets, numbered lists,
 * checklists, quotes, rules and fenced code; inline bold (**x**), italic (*x* or _x_) and code (`x`).
 * Pure functions only — rendering lives in components/markdown-view.tsx.
 */

export type Block =
  | { type: 'h1' | 'h2' | 'h3' | 'p' | 'quote'; text: string; line: number }
  | { type: 'bullet'; text: string; line: number; indent: number }
  | { type: 'number'; text: string; line: number; n: number }
  | { type: 'check'; text: string; line: number; checked: boolean }
  | { type: 'code'; text: string; line: number }
  | { type: 'hr'; line: number };

export type Span = { text: string; bold?: boolean; italic?: boolean; code?: boolean };

export function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const out: Block[] = [];
  let para: { text: string[]; line: number } | null = null;
  let code: { text: string[]; line: number } | null = null;
  const flush = () => {
    if (para) out.push({ type: 'p', text: para.text.join('\n'), line: para.line });
    para = null;
  };

  lines.forEach((raw, i) => {
    if (code) {
      if (/^```/.test(raw.trim())) {
        out.push({ type: 'code', text: code.text.join('\n'), line: code.line });
        code = null;
      } else code.text.push(raw);
      return;
    }
    const line = raw.trimEnd();
    let m: RegExpMatchArray | null;
    if (/^```/.test(line.trim())) {
      flush();
      code = { text: [], line: i };
    } else if (!line.trim()) flush();
    else if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      flush();
      out.push({ type: (['h1', 'h2', 'h3'] as const)[m[1].length - 1], text: m[2], line: i });
    } else if ((m = line.match(/^\s*[-*]\s+\[( |x|X)\]\s*(.*)$/))) {
      flush();
      out.push({ type: 'check', text: m[2], checked: m[1] !== ' ', line: i });
    } else if ((m = line.match(/^(\s*)[-*]\s+(.*)$/))) {
      flush();
      out.push({ type: 'bullet', text: m[2], indent: Math.floor(m[1].length / 2), line: i });
    } else if ((m = line.match(/^\s*(\d+)[.)]\s+(.*)$/))) {
      flush();
      out.push({ type: 'number', text: m[2], n: Number(m[1]), line: i });
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      flush();
      out.push({ type: 'quote', text: m[1], line: i });
    } else if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      flush();
      out.push({ type: 'hr', line: i });
    } else if (para) para.text.push(line);
    else para = { text: [line], line: i };
  });
  if (code) out.push({ type: 'code', text: (code as { text: string[] }).text.join('\n'), line: (code as { line: number }).line });
  flush();
  return out;
}

/** Inline spans for **bold**, *italic* / _italic_ and `code`. Unclosed markers stay literal. */
export function parseInline(text: string): Span[] {
  const re = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*|_[^_\n]+_)/g;
  const out: Span[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ text: text.slice(last, idx) });
    const tok = m[0];
    if (tok.startsWith('**')) out.push({ text: tok.slice(2, -2), bold: true });
    else if (tok.startsWith('`')) out.push({ text: tok.slice(1, -1), code: true });
    else out.push({ text: tok.slice(1, -1), italic: true });
    last = idx + tok.length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out.length ? out : [{ text: '' }];
}

/** Flip the checkbox on a given source line. */
export function toggleCheck(src: string, line: number): string {
  const lines = src.split('\n');
  const l = lines[line];
  if (l === undefined) return src;
  lines[line] = l.replace(/^(\s*[-*]\s+\[)( |x|X)(\])/, (_, a, c, b) => `${a}${c === ' ' ? 'x' : ' '}${b}`);
  return lines.join('\n');
}

/** Plain-text preview (markers stripped) for list snippets and search. */
export function plainText(src: string): string {
  return parseBlocks(src)
    .map((b) => (b.type === 'hr' ? '' : parseInline(b.text).map((s) => s.text).join('')))
    .filter(Boolean)
    .join(' · ');
}

export type Format = 'bold' | 'italic' | 'heading' | 'bullet' | 'check' | 'quote';
type Selection = { start: number; end: number };

/**
 * Apply a toolbar format at the selection. Inline formats wrap the selection
 * (or insert an empty pair with the cursor between); line formats prefix the
 * current line, and toggle off when already present.
 */
export function applyFormat(text: string, sel: Selection, format: Format): { text: string; selection: Selection } {
  if (format === 'bold' || format === 'italic') {
    const mark = format === 'bold' ? '**' : '_';
    const inner = text.slice(sel.start, sel.end);
    const next = text.slice(0, sel.start) + mark + inner + mark + text.slice(sel.end);
    const cursor = sel.start + mark.length;
    return { text: next, selection: inner ? { start: cursor, end: cursor + inner.length } : { start: cursor, end: cursor } };
  }
  const prefix = { heading: '## ', bullet: '- ', check: '- [ ] ', quote: '> ' }[format];
  const lineStart = text.lastIndexOf('\n', sel.start - 1) + 1;
  const existing = text.slice(lineStart).match(/^(#{1,3} |- \[[ xX]\] |[-*] |> )/)?.[0] ?? '';
  const replacing = existing === prefix || (format === 'check' && existing.startsWith('- ['));
  const insert = replacing ? '' : prefix;
  const next = text.slice(0, lineStart) + insert + text.slice(lineStart + existing.length);
  const delta = insert.length - existing.length;
  return { text: next, selection: { start: Math.max(lineStart, sel.start + delta), end: Math.max(lineStart, sel.end + delta) } };
}
