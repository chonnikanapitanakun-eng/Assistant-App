type CategoryName = { id: string; nameTh: string; nameEn: string; type: 'income' | 'expense' };

/**
 * The category Claude's `categoryHint` names, among the user's categories of the same type.
 * `ai-capture` is sent the category names (use-capture-context.ts), so a hint is one of them:
 * match either language's name, ignoring case and surrounding spaces. Undefined when none matches.
 */
export function matchCategory(hint: string | undefined, type: 'income' | 'expense', categories: CategoryName[]): string | undefined {
  const key = hint?.trim().toLowerCase();
  if (!key) return undefined;
  return categories.find((c) => c.type === type && (c.nameEn.trim().toLowerCase() === key || c.nameTh.trim().toLowerCase() === key))?.id;
}
