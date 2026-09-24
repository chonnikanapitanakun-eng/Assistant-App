export const supportedCurrencies = ['THB', 'GBP', 'USD', 'EUR'] as const;
export type Currency = (typeof supportedCurrencies)[number];

const symbols: Record<Currency, string> = { THB: '฿', GBP: '£', USD: '$', EUR: '€' };

export function formatMoney(amount: number, currency: string = 'THB', locale: string = 'th-TH'): string {
  const symbol = symbols[currency as Currency] ?? `${currency} `;
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${amount < 0 ? '-' : ''}${symbol}${formatted}`;
}

export const currencySymbol = (currency: string): string => symbols[currency as Currency] ?? currency;

/** "1,240.50" / "฿1240" / " 12 " → number; returns null when not a finite amount. */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[^\d.,-]/g, '').replace(/,/g, '');
  if (!cleaned || !/^-?\d*\.?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}
