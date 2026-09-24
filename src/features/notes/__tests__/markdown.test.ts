import { describe, expect, it } from 'vitest';

import { applyFormat, parseBlocks, parseInline, plainText, toggleCheck } from '../markdown';

describe('parseBlocks', () => {
  it('parses common blocks with their source line', () => {
    const src = ['# Title', '', 'Intro line one', 'line two', '- bullet', '  - nested', '- [ ] open', '- [x] done', '1. first', '> quote', '---', '```', 'code', '```'].join('\n');
    expect(parseBlocks(src)).toEqual([
      { type: 'h1', text: 'Title', line: 0 },
      { type: 'p', text: 'Intro line one\nline two', line: 2 },
      { type: 'bullet', text: 'bullet', indent: 0, line: 4 },
      { type: 'bullet', text: 'nested', indent: 1, line: 5 },
      { type: 'check', text: 'open', checked: false, line: 6 },
      { type: 'check', text: 'done', checked: true, line: 7 },
      { type: 'number', text: 'first', n: 1, line: 8 },
      { type: 'quote', text: 'quote', line: 9 },
      { type: 'hr', line: 10 },
      { type: 'code', text: 'code', line: 11 },
    ]);
  });
  it('keeps Thai text intact', () => {
    expect(parseBlocks('## ประชุมลูกค้า')).toEqual([{ type: 'h2', text: 'ประชุมลูกค้า', line: 0 }]);
  });
});

describe('parseInline', () => {
  it('splits bold, italic and code', () => {
    expect(parseInline('a **b** _c_ `d`')).toEqual([{ text: 'a ' }, { text: 'b', bold: true }, { text: ' ' }, { text: 'c', italic: true }, { text: ' ' }, { text: 'd', code: true }]);
  });
  it('leaves unclosed markers literal', () => {
    expect(parseInline('2 * 3 = 6')).toEqual([{ text: '2 * 3 = 6' }]);
  });
});

describe('editing helpers', () => {
  it('toggles a checkbox on one line', () => {
    expect(toggleCheck('- [ ] a\n- [x] b', 0)).toBe('- [x] a\n- [x] b');
    expect(toggleCheck('- [ ] a\n- [x] b', 1)).toBe('- [ ] a\n- [ ] b');
  });
  it('wraps a selection in bold', () => {
    expect(applyFormat('hello world', { start: 6, end: 11 }, 'bold')).toEqual({ text: 'hello **world**', selection: { start: 8, end: 13 } });
  });
  it('prefixes and un-prefixes the current line', () => {
    const on = applyFormat('one\ntwo', { start: 5, end: 5 }, 'check');
    expect(on.text).toBe('one\n- [ ] two');
    expect(applyFormat(on.text, on.selection, 'check').text).toBe('one\ntwo');
    expect(applyFormat('- item', { start: 3, end: 3 }, 'heading').text).toBe('## item');
  });
  it('makes a plain-text preview', () => {
    expect(plainText('# Title\n- **bold** item')).toBe('Title · bold item');
  });
});
