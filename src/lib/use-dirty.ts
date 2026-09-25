import { useState } from 'react';

/** True once `values` differ from what they were on first render (form has unsaved edits). */
export function useDirty(values: unknown): boolean {
  const [initial] = useState(() => JSON.stringify(values));
  return JSON.stringify(values) !== initial;
}
