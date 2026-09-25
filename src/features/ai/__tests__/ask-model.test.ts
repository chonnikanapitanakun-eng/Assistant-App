import { describe, expect, it } from 'vitest';

import { addCandidate, detectFocus, detectWindow, extractTerms, moneyFacts, planRetrieval, rankRecords, renderBill, renderTask, renderTx, taskFacts, type Candidate } from '../ask/model';

// Friday 2026-09-25, 10:00 local
const now = new Date(2026, 8, 25, 10, 0);

describe('detectWindow', () => {
  it('resolves Thai and English relative phrases against now', () => {
    expect(detectWindow('เดือนนี้ใช้เงินไปเท่าไหร่', now).window).toEqual({ from: '2026-09-01', to: '2026-09-30', label: 'this month' });
    expect(detectWindow('how much did I spend last month', now).window).toEqual({ from: '2026-08-01', to: '2026-08-31', label: 'last month' });
    expect(detectWindow('พรุ่งนี้มีนัดอะไรบ้าง', now).window).toEqual({ from: '2026-09-26', to: '2026-09-26', label: 'tomorrow' });
    expect(detectWindow('เมื่อวานนี้จ่ายอะไรไป', now).window?.label).toBe('yesterday');
    expect(detectWindow('what is due this week', now).window).toEqual({ from: '2026-09-21', to: '2026-09-27', label: 'this week' });
    expect(detectWindow('สัปดาห์ที่แล้วประชุมกับใคร', now).window).toEqual({ from: '2026-09-14', to: '2026-09-20', label: 'last week' });
    expect(detectWindow('ปีที่แล้วรายได้เท่าไหร่', now).window).toEqual({ from: '2025-01-01', to: '2025-12-31', label: 'last year' });
  });

  it('understands "last N days" in both languages', () => {
    expect(detectWindow('last 7 days spending', now).window).toEqual({ from: '2026-09-19', to: '2026-09-25', label: 'last 7 days' });
    expect(detectWindow('30 วันที่ผ่านมาใช้ไปเท่าไหร่', now).window).toEqual({ from: '2026-08-27', to: '2026-09-25', label: 'last 30 days' });
  });

  it('understands month names, including Thai abbreviations and พ.ศ. years', () => {
    expect(detectWindow('ค่าใช้จ่ายเดือนสิงหาคม', now).window).toEqual({ from: '2026-08-01', to: '2026-08-31', label: 'august 2026' });
    expect(detectWindow('ยอด ก.ค. 2569', now).window).toEqual({ from: '2026-07-01', to: '2026-07-31', label: 'july 2026' });
    expect(detectWindow('meetings in January 2025', now).window).toEqual({ from: '2025-01-01', to: '2025-01-31', label: 'january 2025' });
  });

  it('does not read the modal verb "may" as a month, and strips the phrase it matched', () => {
    expect(detectWindow('what may be overdue', now).window).toBeNull();
    expect(detectWindow('what happened today with ABC', now).rest.replace(/\s+/g, ' ').trim()).toBe('what happened with ABC');
  });
});

describe('extractTerms', () => {
  it('drops question words, particles and generic money words, keeps names and topics', () => {
    expect(extractTerms('how much did I pay ABC Ltd for VAT?')).toEqual(['abc', 'ltd', 'vat']);
    expect(extractTerms('งานของคุณสมชายมีอะไรค้างบ้าง')).toEqual(['งาน', 'คุณสมชาย', 'ค้าง']);
    expect(extractTerms('ใช้เงินไปเท่าไหร่')).toEqual([]);
  });

  it('cuts Thai tokens at function words; a sliced fragment still matches the full word in the trigram index', () => {
    expect(extractTerms('มีตติ้งกับลูกค้า')).toEqual(['ตติ้ง', 'ลูกค้า']);
    expect(extractTerms('ซื้อของขวัญให้แม่')).toEqual(['ขวัญ', 'แม่']);
  });

  it('caps at six unique terms', () => {
    expect(extractTerms('alpha beta gamma delta epsilon zeta eta theta alpha')).toHaveLength(6);
  });
});

describe('detectFocus + planRetrieval', () => {
  it('flags the kinds of data a question is about', () => {
    expect(detectFocus('เดือนนี้ใช้เงินไปเท่าไหร่')).toEqual(['money']);
    expect(detectFocus('what tasks are overdue')).toEqual(['tasks']);
    expect(detectFocus('พรุ่งนี้มีนัดกับลูกค้าไหม')).toEqual(['events', 'contacts']);
    expect(detectFocus('บิลอะไรใกล้ครบกำหนด')).toEqual(['bills']);
    expect(detectFocus('ABC')).toEqual([]);
  });

  it('removes the time phrase before extracting keywords', () => {
    expect(planRetrieval('เดือนที่แล้วจ่ายค่าสอบบัญชี ABC ไปเท่าไหร่', now)).toEqual({
      terms: ['ค่าสอบบัญชี', 'abc'],
      window: { from: '2026-08-01', to: '2026-08-31', label: 'last month' },
      focus: [],
    });
  });
});

describe('render*', () => {
  it('renders a task with its due state relative to today', () => {
    const base = { id: 't1', notes: null, startTime: null, endTime: null, isDone: false, priority: 2, checklist: null };
    expect(renderTask({ ...base, title: 'ส่งงบ ABC', date: '2026-09-22', priority: 1 }, now)).toBe('Task: ส่งงบ ABC | 2026-09-22 | open, overdue by 3 days | priority high');
    expect(renderTask({ ...base, title: 'Call John', date: '2026-09-25', startTime: '14:00', endTime: '14:30' }, now)).toBe('Task: Call John | 2026-09-25 14:00-14:30 | open, due today | priority normal');
    expect(renderTask({ ...base, title: 'Read', date: null, isDone: true, checklist: [{ text: 'a', done: true }, { text: 'b', done: false }] }, now)).toBe('Task: Read | no date | done | priority normal | checklist 1/2 done');
  });

  it('renders money with thousands separators and names instead of ids', () => {
    const tx = { id: 'x1', amount: 5000, currency: 'GBP', type: 'expense' as const, date: '2026-09-10', note: 'VAT Q2', categoryId: 'c1', walletId: 'w1', toWalletId: null };
    expect(renderTx(tx, { category: 'Tax', wallet: 'HSBC' })).toBe('Expense 5,000 GBP | 2026-09-10 | VAT Q2 | category Tax | wallet HSBC');
    expect(renderBill({ id: 'b1', name: 'Netflix', amount: 419, currency: 'THB', frequency: 'monthly', isSubscription: true, due: '2026-10-01', paidThrough: '2026-09-01' }, now)).toBe(
      'Bill: Netflix | 419 THB monthly | next 2026-10-01 (due in 6 days) | subscription | paid through 2026-09-01',
    );
  });
});

describe('facts', () => {
  const tx = (over: Partial<Parameters<typeof moneyFacts>[0][number]>) => ({ id: 'x', amount: 100, currency: 'THB', type: 'expense' as const, date: '2026-09-01', note: null, categoryId: 'food', walletId: 'w', toWalletId: null, ...over });
  const catName = (id: string | null) => (id === 'food' ? 'Food' : id === 'tax' ? 'Tax' : 'Uncategorised');

  it('totals per currency, ranks categories and ignores transfers', () => {
    const facts = moneyFacts([tx({ amount: 1200 }), tx({ amount: 3000, categoryId: 'tax' }), tx({ amount: 50000, type: 'income', categoryId: null }), tx({ amount: 250, currency: 'GBP' }), tx({ amount: 999, type: 'transfer' })], 'this month', 'THB', catName);
    expect(facts).toEqual([
      'this month, THB: expense 4,200, income 50,000, net +45,800 (3 transactions, transfers excluded)',
      'this month, GBP: expense 250, income 0, net -250 (1 transactions, transfers excluded)',
      'Top expense categories this month (THB): Tax 3,000; Food 1,200',
    ]);
    expect(moneyFacts([], 'last month', 'THB', catName)).toEqual(['No transactions last month.']);
  });

  it('counts open, overdue, due-today and undated tasks', () => {
    const t = (over: Partial<Parameters<typeof taskFacts>[0][number]>) => ({ id: 't', title: 'x', notes: null, date: null, startTime: null, endTime: null, isDone: false, priority: 2, ...over });
    expect(taskFacts([t({ date: '2026-09-20' }), t({ date: '2026-09-25' }), t({}), t({ date: '2026-09-30', isDone: true })], 'open', now)).toEqual(['Tasks open: 4 total, 3 open, 1 done; 1 overdue; 1 due today; 1 without a date']);
  });
});

describe('rankRecords', () => {
  const c = (type: Candidate['type'], id: string, score: number, text = `${type} ${id}`): Candidate => ({ type, id, title: id, text, score, recency: 0 });

  it('sums scores for rows found by several sources, orders by score and assigns refs per type', () => {
    const map = new Map<string, Candidate>();
    addCandidate(map, c('task', 'a', 1));
    addCandidate(map, c('task', 'a', 0.6));
    addCandidate(map, c('task', 'b', 1.2));
    addCandidate(map, c('note', 'n', 0.5));
    const out = rankRecords(map.values());
    expect(out.map((r) => [r.ref, r.id, r.score])).toEqual([
      ['T1', 'a', 1.6],
      ['T2', 'b', 1.2],
      ['N1', 'n', 0.5],
    ]);
  });

  it('applies per-type caps and the character budget', () => {
    const many = Array.from({ length: 40 }, (_, i) => c('transaction', `x${i}`, 40 - i));
    expect(rankRecords(many).length).toBe(30);
    const big = [c('note', 'big', 2, 'x'.repeat(7000)), c('note', 'small', 1, 'y'.repeat(1500)), c('task', 't', 0.5, 'z'.repeat(2000))];
    expect(rankRecords(big).map((r) => r.id)).toEqual(['big']);
  });
});
