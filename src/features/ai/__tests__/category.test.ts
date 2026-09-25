import { describe, expect, it } from 'vitest';

import { matchCategory } from '../category';

const cats = [
  { id: 'food', nameTh: 'อาหาร', nameEn: 'Food', type: 'expense' as const },
  { id: 'salary', nameTh: 'เงินเดือน', nameEn: 'Salary', type: 'income' as const },
  { id: 'food-income', nameTh: 'ขายอาหาร', nameEn: 'Food', type: 'income' as const },
];

describe('matchCategory', () => {
  it('matches either language, ignoring case and spaces', () => {
    expect(matchCategory(' food ', 'expense', cats)).toBe('food');
    expect(matchCategory('อาหาร', 'expense', cats)).toBe('food');
    expect(matchCategory('SALARY', 'income', cats)).toBe('salary');
  });

  it('only matches a category of the same type', () => {
    expect(matchCategory('Food', 'income', cats)).toBe('food-income');
    expect(matchCategory('Salary', 'expense', cats)).toBeUndefined();
  });

  it('is undefined for a missing or unknown hint', () => {
    expect(matchCategory(undefined, 'expense', cats)).toBeUndefined();
    expect(matchCategory('  ', 'expense', cats)).toBeUndefined();
    expect(matchCategory('Travel', 'expense', cats)).toBeUndefined();
  });
});
