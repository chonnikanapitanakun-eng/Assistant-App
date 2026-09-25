import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Mascot } from '@/components/brand/mascot';
import { Card, Chip, FieldError, Icon, IconButton, PressableScale, Screen, SectionHeader, Text } from '@/components/ui';
import type { Category, Transaction, Wallet } from '@/db';
import { categoryIcon, walletIcon } from '@/features/money/category-icon';
import { BillRow } from '@/features/money/components/bill-row';
import { BudgetBar } from '@/features/money/components/budget-bar';
import { SpendingChart } from '@/features/money/components/spending-chart';
import { TransactionRow } from '@/features/money/components/transaction-row';
import { exportCsv, transactionsToCsv } from '@/features/money/export';
import { billState, currenciesInUse, groupByDate, monthTotals, netWorth, nextDueDate, spendingByCategory, toPrimary, walletBalance } from '@/features/money/model';
import { useBills, useCategories, useTransactions, useWallets } from '@/features/money/queries';
import { useFxRates, usePrimaryCurrency } from '@/features/profile/store';
import { formatMoney } from '@/lib/currency';
import { daysFromToday, toMonthKey } from '@/lib/date';
import { useAsyncAction } from '@/lib/use-async-action';
import { useBreakpoint, useTheme } from '@/theme';

type Section = 'overview' | 'transactions' | 'budget' | 'bills' | 'accounts' | 'networth';
const sections: Section[] = ['overview', 'transactions', 'budget', 'bills', 'accounts', 'networth'];

export default function MoneyScreen() {
  const { t, i18n } = useTranslation();
  const { spacing, motion } = useTheme();
  const { isDesktop } = useBreakpoint();
  const locale = i18n.language === 'th' ? 'th-TH' : 'en-GB';

  const [section, setSection] = useState<Section>('overview');
  const [month, setMonth] = useState(toMonthKey());
  const wallets = useWallets();
  const txs = useTransactions();
  const categories = useCategories();
  const bills = useBills();
  const primary = usePrimaryCurrency();
  const currencies = currenciesInUse(wallets, primary);
  const [currencyPick, setCurrency] = useState<string>(primary);
  const currency = currencies.includes(currencyPick) ? currencyPick : (currencies[0] ?? primary);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const walletById = useMemo(() => new Map(wallets.map((w) => [w.id, w])), [wallets]);
  const walletIds = new Set(wallets.map((w) => w.id));
  // Hidden (deleted) accounts drop out of totals; their history stays in the database.
  const liveTxs = txs.filter((x) => walletIds.has(x.walletId));

  const shiftMonth = (dir: 1 | -1) => {
    const [y, m] = month.split('-').map(Number);
    setMonth(toMonthKey(new Date(y, m - 1 + dir, 1)));
  };
  const monthLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString(locale, { month: isDesktop ? 'long' : 'short', year: 'numeric' });
  const showMonth = section !== 'bills' && section !== 'accounts' && section !== 'networth';
  const showCurrency = (section === 'overview' || section === 'transactions') && currencies.length > 1;

  const props = { month, currency, wallets, txs: liveTxs, categories, bills, catById, walletById, isDesktop };

  return (
    <Screen maxWidth={isDesktop ? 1200 : 880}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text variant="title" accessibilityRole="header" style={{ flex: 1 }}>{t('nav.money')}</Text>
        {section !== 'networth' ? (
          <IconButton
            icon="plus"
            label={section === 'bills' ? t('money.add_bill') : section === 'accounts' ? t('money.add_account') : t('money.add')}
            color="primary"
            filled
            onPress={() =>
              section === 'bills'
                ? router.push({ pathname: '/bill/[id]', params: { id: 'new' } })
                : section === 'accounts'
                  ? router.push({ pathname: '/wallet/[id]', params: { id: 'new' } })
                  : router.push({ pathname: '/tx/[id]', params: { id: 'new' } })
            }
          />
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {sections.map((s) => (
          <Chip key={s} label={t(`money.section_${s}`)} selected={section === s} onPress={() => setSection(s)} />
        ))}
      </ScrollView>

      {showMonth || showCurrency ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {showMonth ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconButton icon="chevron-left" label={t('calendar.previous')} onPress={() => shiftMonth(-1)} />
              <Text variant="subheading" numberOfLines={1} style={{ minWidth: 84, textAlign: 'center' }}>{monthLabel}</Text>
              <IconButton icon="chevron-right" label={t('calendar.next')} onPress={() => shiftMonth(1)} />
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          {showCurrency
            ? currencies.map((c) => <Chip key={c} label={c} selected={currency === c} onPress={() => setCurrency(c)} />)
            : null}
        </View>
      ) : null}

      <Animated.View key={section} entering={FadeIn.duration(motion.base)} style={{ gap: spacing.xl }}>
        {section === 'overview' ? <Overview {...props} goTo={setSection} /> : null}
        {section === 'transactions' ? <Transactions {...props} /> : null}
        {section === 'budget' ? <Budget {...props} /> : null}
        {section === 'bills' ? <Bills {...props} /> : null}
        {section === 'accounts' ? <Accounts {...props} /> : null}
        {section === 'networth' ? <NetWorth {...props} /> : null}
      </Animated.View>
    </Screen>
  );
}

type Props = {
  month: string;
  currency: string;
  wallets: Wallet[];
  txs: Transaction[];
  categories: Category[];
  bills: ReturnType<typeof useBills>;
  catById: Map<string, Category>;
  walletById: Map<string, Wallet>;
  isDesktop: boolean;
};

// ── Overview ───────────────────────────────────────────────────────────

function Overview({ month, currency, wallets, txs, categories, bills, catById, walletById, isDesktop, goTo }: Props & { goTo: (s: Section) => void }) {
  const { t } = useTranslation();
  const { colors, tints, spacing } = useTheme();
  const balance = wallets.filter((w) => w.currency === currency).reduce((s, w) => s + walletBalance(w, txs), 0);
  const totals = monthTotals(txs, month, currency);
  const spending = spendingByCategory(txs, month, currency);
  const upcoming = [...bills].sort((a, b) => nextDueDate(a).localeCompare(nextDueDate(b))).slice(0, 3);
  const recent = txs.filter((x) => x.date.startsWith(month) && x.currency === currency).slice(0, 5);
  const fmt = (n: number) => formatMoney(n, currency, 'en-GB');

  const summary = (
    <Card style={{ gap: spacing.lg }}>
      <View style={{ gap: 2 }}>
        <Text variant="overline" color="textSecondary">{t('money.total_balance', { currency }).toUpperCase()}</Text>
        <Text variant="display" color="balance" style={{ fontVariant: ['tabular-nums'] }}>{fmt(balance)}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Stat icon="arrow-down-left" tint={tints.done} label={t('money.income')} value={fmt(totals.income)} />
        <Stat icon="arrow-up-right" tint={tints.priorityHigh} label={t('money.expense')} value={fmt(totals.expense)} />
      </View>
      <Text variant="caption" color="textSecondary">
        {totals.net >= 0 ? t('money.net_positive', { amount: fmt(totals.net) }) : t('money.net_negative', { amount: fmt(-totals.net) })}
      </Text>
    </Card>
  );

  const chart = (
    <Card>
      <SectionHeader title={t('money.spending_by_category')} action={t('money.section_budget')} onAction={() => goTo('budget')} />
      {spending.length ? <SpendingChart rows={spending} categories={categories} currency={currency} /> : <Empty pose="calm" title={t('money.no_spending')} />}
    </Card>
  );

  const billsCard = (
    <Card>
      <SectionHeader title={t('home.upcoming_bills')} action={t('money.section_bills')} onAction={() => goTo('bills')} />
      {upcoming.length ? upcoming.map((b) => <BillRow key={b.id} bill={b} category={catById.get(b.categoryId ?? '')} compact />) : <Text variant="bodySm" color="textSecondary">{t('money.no_bills')}</Text>}
    </Card>
  );

  const recentCard = (
    <Card>
      <SectionHeader title={t('money.recent')} action={t('money.section_transactions')} onAction={() => goTo('transactions')} />
      {recent.length ? (
        recent.map((x, i) => (
          <View key={x.id} style={i ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined}>
            <TransactionRow tx={x} category={catById.get(x.categoryId ?? '')} walletName={walletById.get(x.walletId)?.name} toWalletName={walletById.get(x.toWalletId ?? '')?.name} />
          </View>
        ))
      ) : (
        <Text variant="bodySm" color="textSecondary">{t('money.no_transactions')}</Text>
      )}
    </Card>
  );

  return isDesktop ? (
    <View style={{ flexDirection: 'row', gap: spacing.xxl, alignItems: 'flex-start' }}>
      <View style={{ flex: 1.2, gap: spacing.xxl }}>
        {summary}
        {chart}
      </View>
      <View style={{ flex: 1, gap: spacing.xxl }}>
        {billsCard}
        {recentCard}
      </View>
    </View>
  ) : (
    <>
      {summary}
      {billsCard}
      {chart}
      {recentCard}
    </>
  );
}

function Stat({ icon, tint, label, value }: { icon: 'arrow-down-left' | 'arrow-up-right'; tint: { bg: string; fg: string }; label: string; value: string }) {
  const { spacing, radius } = useTheme();
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: tint.bg }}>
      <Icon name={icon} size={18} tone={tint.fg} />
      <View style={{ flex: 1 }}>
        <Text variant="caption" color="textSecondary">{label}</Text>
        <Text variant="subheading" weight="bold" style={{ fontVariant: ['tabular-nums'] }} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

// ── Transactions ───────────────────────────────────────────────────────

function Transactions({ month, currency, txs, catById, walletById }: Props) {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const [kind, setKind] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');
  const rows = txs.filter((x) => x.date.startsWith(month) && x.currency === currency && (kind === 'all' || x.type === kind));
  const groups = groupByDate(rows);
  const locale = i18n.language === 'th' ? 'th-TH' : 'en-GB';
  const { failed, run } = useAsyncAction();

  const handleExport = () =>
    run(async () => {
      if (!rows.length) return;
      const categoryName = (c: Category) => (i18n.language === 'th' ? c.nameTh : c.nameEn);
      const csv = transactionsToCsv(rows, catById, walletById, categoryName, {
        date: t('money.csv_date'),
        type: t('money.csv_type'),
        amount: t('money.csv_amount'),
        currency: t('money.csv_currency'),
        category: t('money.csv_category'),
        account: t('money.csv_account'),
        note: t('money.csv_note'),
        income: t('money.type_income'),
        expense: t('money.type_expense'),
        transfer: t('money.type_transfer'),
        uncategorised: t('money.uncategorised'),
      });
      await exportCsv(csv, `transactions-${month}-${currency}.csv`);
    });

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, flexGrow: 1 }}>
          {(['all', 'expense', 'income', 'transfer'] as const).map((k) => (
            <Chip key={k} label={t(`money.filter_${k}`)} selected={kind === k} onPress={() => setKind(k)} />
          ))}
        </ScrollView>
        <IconButton icon="download" label={rows.length ? t('money.export') : t('money.export_empty')} onPress={handleExport} />
      </View>
      <FieldError message={failed ? t('common.export_failed') : null} />
      {groups.length === 0 ? (
        <Empty pose="thinking" title={t('money.no_transactions')} body={t('money.no_transactions_body')} />
      ) : (
        groups.map((g) => {
          const diff = daysFromToday(g.date);
          const label = diff === 0 ? t('capture.today') : diff === -1 ? t('tasks.yesterday') : new Date(`${g.date}T00:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' });
          const net = g.rows.reduce((s, r) => s + (r.type === 'income' ? r.amount : r.type === 'expense' ? -r.amount : 0), 0);
          return (
            <View key={g.date} style={{ gap: spacing.xs }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xs }}>
                <Text variant="overline" color="textSecondary">{label.toUpperCase()}</Text>
                <Text variant="overline" color="textTertiary" style={{ fontVariant: ['tabular-nums'] }}>{`${net >= 0 ? '+' : '−'}${formatMoney(Math.abs(net), currency, 'en-GB')}`}</Text>
              </View>
              <Card padding="md" style={{ gap: 0, paddingVertical: spacing.xs }}>
                {g.rows.map((x, i) => (
                  <View key={x.id} style={i ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined}>
                    <TransactionRow tx={x} category={catById.get(x.categoryId ?? '')} walletName={walletById.get(x.walletId)?.name} toWalletName={walletById.get(x.toWalletId ?? '')?.name} />
                  </View>
                ))}
              </Card>
            </View>
          );
        })
      )}
    </>
  );
}

// ── Budget ─────────────────────────────────────────────────────────────

function Budget({ month, txs, categories }: Props) {
  const { t, i18n } = useTranslation();
  const budgetCurrency = usePrimaryCurrency();
  const { colors, spacing } = useTheme();
  const spent = new Map(spendingByCategory(txs, month, budgetCurrency).map((r) => [r.categoryId, r.total]));
  const expenseCats = categories.filter((c) => c.type === 'expense');
  const budgeted = expenseCats.filter((c) => c.budgetMonthly && c.budgetMonthly > 0);
  const unbudgeted = expenseCats.filter((c) => !c.budgetMonthly);
  const totalBudget = budgeted.reduce((s, c) => s + (c.budgetMonthly ?? 0), 0);
  const totalSpent = budgeted.reduce((s, c) => s + (spent.get(c.id) ?? 0), 0);
  const name = (c: Category) => (i18n.language === 'th' ? c.nameTh : c.nameEn);
  const open = (c: Category) => router.push({ pathname: '/budget/[id]', params: { id: c.id } });

  return (
    <>
      <Card>
        <Text variant="overline" color="textSecondary">{t('money.budget_total', { currency: budgetCurrency }).toUpperCase()}</Text>
        {budgeted.length ? <BudgetBar spent={totalSpent} budget={totalBudget} /> : <Text variant="bodySm" color="textSecondary">{t('money.no_budgets')}</Text>}
      </Card>
      {budgeted.length ? (
        <Card style={{ gap: spacing.lg }}>
          {budgeted.map((c) => (
            <PressableScale key={c.id} accessibilityRole="button" accessibilityLabel={t('money.edit_budget', { name: name(c) })} onPress={() => open(c)} style={{ gap: spacing.sm }}>
              <CategoryTitle category={c} label={name(c)} />
              <BudgetBar spent={spent.get(c.id) ?? 0} budget={c.budgetMonthly!} />
            </PressableScale>
          ))}
        </Card>
      ) : null}
      {unbudgeted.length ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="overline" color="textSecondary">{t('money.no_budget_yet').toUpperCase()}</Text>
          <Card padding="md" style={{ gap: 0, paddingVertical: spacing.xs }}>
            {unbudgeted.map((c, i) => (
              <PressableScale
                key={c.id}
                accessibilityRole="button"
                accessibilityLabel={t('money.set_budget_for', { name: name(c) })}
                onPress={() => open(c)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}
              >
                <View style={{ flex: 1 }}>
                  <CategoryTitle category={c} label={name(c)} />
                </View>
                <Text variant="caption" color="textSecondary" style={{ fontVariant: ['tabular-nums'] }}>{formatMoney(spent.get(c.id) ?? 0, budgetCurrency, 'en-GB')}</Text>
                <Text variant="label" color="primary">{t('money.set_budget')}</Text>
              </PressableScale>
            ))}
          </Card>
        </View>
      ) : null}
    </>
  );
}

function CategoryTitle({ category, label }: { category: Category; label: string }) {
  const { spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Icon name={categoryIcon(category.icon)} size={16} color="textSecondary" />
      <Text variant="subheading">{label}</Text>
    </View>
  );
}

// ── Bills ──────────────────────────────────────────────────────────────

function Bills({ bills, catById }: Props) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const sorted = [...bills].sort((a, b) => nextDueDate(a).localeCompare(nextDueDate(b)));
  const due = sorted.filter((b) => billState(nextDueDate(b), b.remindDaysBefore).state !== 'later');
  const later = sorted.filter((b) => billState(nextDueDate(b), b.remindDaysBefore).state === 'later');
  const monthlyByCurrency = new Map<string, number>();
  for (const b of bills) monthlyByCurrency.set(b.currency, (monthlyByCurrency.get(b.currency) ?? 0) + (b.frequency === 'yearly' ? b.amount / 12 : b.amount));

  if (!bills.length) return <Empty pose="calm" title={t('money.no_bills')} body={t('money.no_bills_body')} />;

  const list = (rows: typeof bills) => (
    <Card padding="md" style={{ gap: 0 }}>
      {rows.map((b, i) => (
        <View key={b.id} style={i ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined}>
          <BillRow bill={b} category={catById.get(b.categoryId ?? '')} />
        </View>
      ))}
    </Card>
  );

  return (
    <>
      <Card>
        <Text variant="overline" color="textSecondary">{t('money.monthly_commitments').toUpperCase()}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl }}>
          {[...monthlyByCurrency.entries()].map(([c, v]) => (
            <Text key={c} variant="title" color="balance" style={{ fontVariant: ['tabular-nums'] }}>{formatMoney(Math.round(v), c, 'en-GB')}</Text>
          ))}
        </View>
      </Card>
      {due.length ? (
        <Group title={t('money.needs_paying')}>{list(due)}</Group>
      ) : null}
      {later.length ? <Group title={t('money.later_this_cycle')}>{list(later)}</Group> : null}
    </>
  );
}

// ── Accounts ───────────────────────────────────────────────────────────

function Accounts({ wallets, txs, isDesktop }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const month = toMonthKey();
  if (!wallets.length) return <Empty pose="calm" title={t('money.no_accounts')} body={t('money.no_accounts_body')} />;

  return (
    <View style={{ flexDirection: isDesktop ? 'row' : 'column', flexWrap: 'wrap', gap: spacing.lg }}>
      {wallets.map((w) => {
        const own = txs.filter((x) => x.walletId === w.id || x.toWalletId === w.id);
        const m = monthTotals(own.filter((x) => x.walletId === w.id), month, w.currency);
        return (
          <PressableScale
            key={w.id}
            accessibilityRole="button"
            accessibilityLabel={`${w.name}, ${formatMoney(walletBalance(w, own), w.currency, 'en-GB')}`}
            onPress={() => router.push({ pathname: '/wallet/[id]', params: { id: w.id } })}
            style={{ width: isDesktop ? '31.5%' : '100%' }}
          >
            <Card style={{ gap: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={walletIcon[w.type]} size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="subheading" numberOfLines={1}>{w.name}</Text>
                  <Text variant="caption" color="textSecondary">{t(`money.wallet_${w.type}`)} · {w.currency}</Text>
                </View>
              </View>
              <Text variant="title" color="balance" style={{ fontVariant: ['tabular-nums'] }}>{formatMoney(walletBalance(w, own), w.currency, 'en-GB')}</Text>
              <Text variant="caption" color="textSecondary">
                {t('money.this_month_flow', { income: formatMoney(m.income, w.currency, 'en-GB'), expense: formatMoney(m.expense, w.currency, 'en-GB') })}
              </Text>
            </Card>
          </PressableScale>
        );
      })}
    </View>
  );
}

// ── Net worth ──────────────────────────────────────────────────────────

function NetWorth({ wallets, txs }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const primary = usePrimaryCurrency();
  const rates = useFxRates();
  if (!wallets.length) return <Empty pose="calm" title={t('money.no_accounts')} body={t('money.no_accounts_body')} />;

  const { total, missing } = netWorth(wallets, txs, primary, rates);
  const fmt = (n: number, c: string) => formatMoney(n, c, 'en-GB');

  return (
    <>
      <Card style={{ gap: spacing.sm }}>
        <Text variant="overline" color="textSecondary">{t('money.net_worth', { currency: primary }).toUpperCase()}</Text>
        <Text variant="display" color="balance" style={{ fontVariant: ['tabular-nums'] }}>{fmt(total, primary)}</Text>
        {missing.map((c) => (
          <Text key={c} variant="caption" tone={colors.warning}>{t('money.missing_fx_rate', { currencies: c })}</Text>
        ))}
      </Card>
      <Card padding="md" style={{ gap: 0, paddingVertical: spacing.xs }}>
        {wallets.map((w, i) => {
          const bal = walletBalance(w, txs);
          const converted = toPrimary(bal, w.currency, primary, rates);
          return (
            <View key={w.id} style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56 }, i ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined]}>
              <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={walletIcon[w.type]} size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="subheading" numberOfLines={1}>{w.name}</Text>
                <Text variant="caption" color="textSecondary">{w.currency}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text variant="label" weight="semibold" style={{ fontVariant: ['tabular-nums'] }}>{fmt(bal, w.currency)}</Text>
                {converted !== null && w.currency !== primary ? (
                  <Text variant="caption" color="textSecondary" style={{ fontVariant: ['tabular-nums'] }}>{t('money.networth_convert', { amount: fmt(converted, primary) })}</Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </Card>
    </>
  );
}

// ── Shared bits ────────────────────────────────────────────────────────

function Group({ title, children }: { title: string; children: ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="overline" color="textSecondary" accessibilityRole="header">{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

function Empty({ pose, title, body }: { pose: 'calm' | 'thinking'; title: string; body?: string }) {
  const { spacing } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl }}>
      <Mascot pose={pose} size={96} />
      <Text variant="subheading" align="center">{title}</Text>
      {body ? <Text variant="caption" color="textSecondary" align="center">{body}</Text> : null}
    </View>
  );
}
