import { asc, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { contacts, db } from '@/db';
import { useCategories, useWallets } from '@/features/money/queries';
import { useProfile } from '@/features/profile/store';
import { useAreas } from '@/features/tasks/queries';

import type { CaptureContext } from './remote';

/**
 * What `ai-capture` needs to resolve names, currencies and categories — names only, never whole rows
 * (SPEC §6.4: send only what is relevant). Returns a function so each call sees the current date.
 */
export function useCaptureContext(): () => CaptureContext {
  const language = useProfile((p) => p.language);
  const currency = useProfile((p) => p.currency);
  const { data: contactRows } = useLiveQuery(db.select({ name: contacts.name }).from(contacts).where(isNull(contacts.deletedAt)).orderBy(asc(contacts.name)));
  const areas = useAreas();
  const wallets = useWallets();
  const categories = useCategories();

  return useMemo(() => {
    const name = (c: { nameTh: string; nameEn: string }) => (language === 'th' ? c.nameTh : c.nameEn);
    return () => ({
      locale: language,
      today: new Date(),
      defaultCurrency: currency,
      contacts: (contactRows ?? []).map((c) => c.name),
      areas: areas.map(name),
      wallets: wallets.map((w) => `${w.name} (${w.currency})`),
      categories: {
        expense: categories.filter((c) => c.type === 'expense').map(name),
        income: categories.filter((c) => c.type === 'income').map(name),
      },
    });
  }, [language, currency, contactRows, areas, wallets, categories]);
}
