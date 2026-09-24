export const supportedCurrencies = ['THB', 'GBP', 'USD'] as const;
export type Currency = (typeof supportedCurrencies)[number];

const symbols: Record<Currency, string> = { THB: '฿', GBP: '£', USD: '$' };

export function formatMoney(amount: number, currency: string = 'THB', locale: string = 'th-TH'): string {
  const symbol = symbols[currency as Currency] ?? `${currency} `;
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${amount < 0 ? '-' : ''}${symbol}${formatted}`;
}
