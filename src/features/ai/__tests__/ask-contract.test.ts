import { describe, expect, it } from 'vitest';

import { ASK_SCHEMA, normalizeAskResponse } from '../../../../supabase/functions/_shared/ask-contract';
import { cleanRecords, userTurn } from '../../../../supabase/functions/ai-ask/prompt';

describe('ai-ask contract', () => {
  it('schema is strict: every property is required and no extras allowed', () => {
    expect(ASK_SCHEMA.required).toEqual(Object.keys(ASK_SCHEMA.properties));
    expect(ASK_SCHEMA.additionalProperties).toBe(false);
    const action = ASK_SCHEMA.properties.suggestedActions.items;
    expect(action.required).toEqual(Object.keys(action.properties));
    expect(action.additionalProperties).toBe(false);
  });

  it('keeps only refs the request sent, de-duplicated and capped at 8', () => {
    const raw = { answer: 'ok', sources: [{ ref: 'T1' }, { ref: 't1' }, { ref: 'T9' }, { ref: 'X2' }, { ref: 'hello' }, { ref: 'N1' }], suggestedActions: [], followUps: [] };
    expect(normalizeAskResponse(raw, ['T1', 'T2', 'X2']).sources).toEqual([{ ref: 'T1' }, { ref: 'X2' }]);
    const many = Array.from({ length: 12 }, (_, i) => ({ ref: `T${i + 1}` }));
    expect(normalizeAskResponse({ ...raw, sources: many }, many.map((s) => s.ref)).sources).toHaveLength(8);
  });

  it('strips nulls from actions, turns an undated event into a task and caps lists at 3', () => {
    const out = normalizeAskResponse(
      {
        answer: ' คำตอบ ',
        sources: [],
        suggestedActions: [
          { label: 'ตามเงิน ABC', type: 'task', title: 'ตามเงินค่าสอบบัญชี ABC', date: '2026-10-01', startTime: null },
          { label: 'นัด', type: 'event', title: 'นัดคุณสมชาย', date: null, startTime: '10:00' },
          { label: 'จด', type: 'note', title: 'ข้อความ', date: '2026-10-01', startTime: '10:00' },
          { label: 'extra', type: 'task', title: 'four', date: null, startTime: null },
          { label: '', type: 'task', title: 'no label', date: null, startTime: null },
        ],
        followUps: ['a', 'a', 'b', 'c', 'd'],
      },
      [],
    );
    expect(out).toEqual({
      answer: 'คำตอบ',
      sources: [],
      suggestedActions: [
        { label: 'ตามเงิน ABC', type: 'task', title: 'ตามเงินค่าสอบบัญชี ABC', date: '2026-10-01' },
        { label: 'นัด', type: 'task', title: 'นัดคุณสมชาย', startTime: '10:00' },
        { label: 'จด', type: 'note', title: 'ข้อความ' },
      ],
      followUps: ['a', 'b', 'c'],
    });
  });

  it('never throws on garbage', () => {
    expect(normalizeAskResponse(null, [])).toEqual({ answer: '', sources: [], suggestedActions: [], followUps: [] });
    expect(normalizeAskResponse({ answer: 1, sources: 'x', suggestedActions: [null, 1], followUps: 'y' }, ['T1'])).toEqual({ answer: '', sources: [], suggestedActions: [], followUps: [] });
  });
});

describe('ai-ask prompt', () => {
  it('cleans records: valid refs and types only, one line each, no duplicates', () => {
    const out = cleanRecords([
      { ref: 't1', type: 'task', text: 'Task: a\n  | open' },
      { ref: 'T1', type: 'task', text: 'dup' },
      { ref: 'Z1', type: 'task', text: 'bad ref' },
      { ref: 'X1', type: 'wallet', text: 'bad type' },
      { ref: 'X2', type: 'transaction', text: '' },
      'nope',
    ]);
    expect(out).toEqual([{ ref: 'T1', type: 'task', text: 'Task: a | open' }]);
  });

  it('renders the volatile turn with facts, records and the question last', () => {
    const turn = userTurn(
      { question: 'เดือนนี้ใช้เงินไปเท่าไหร่', locale: 'th', currency: 'THB', name: 'Proud', facts: ['this month, THB: expense 4,200'], coverage: ['Transactions this month'] },
      '2026-09-25',
      'Friday',
      [{ ref: 'X1', text: 'Expense 1,200 THB | 2026-09-02 | ข้าว' }],
    );
    expect(turn).toBe(
      [
        '<today>2026-09-25 (Friday)</today>',
        '<locale>th</locale>',
        '<currency>THB</currency>',
        '<user_name>Proud</user_name>',
        '',
        '<coverage>',
        '- Transactions this month',
        '</coverage>',
        '',
        '<facts>',
        '- this month, THB: expense 4,200',
        '</facts>',
        '',
        '<records>',
        '[X1] Expense 1,200 THB | 2026-09-02 | ข้าว',
        '</records>',
        '',
        '<question>',
        'เดือนนี้ใช้เงินไปเท่าไหร่',
        '</question>',
      ].join('\n'),
    );
    expect(userTurn({ question: 'q' }, '2026-09-25', 'Friday', [])).toContain('<records>\n(nothing matched)\n</records>');
  });
});
