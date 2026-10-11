// Tools exposed by the `mcp` function. Rows live in the cloud-sync tables (20260925010000_sync_tables.sql);
// every write stamps `updated_at` so the app's pull (src/features/sync/pull.ts) picks it up on next sync.
import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const TZ = Deno.env.get('MCP_TZ') ?? 'Asia/Bangkok';

type Args = Record<string, unknown>;
type Row = Record<string, unknown>;

// ---------- helpers ----------

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()); // YYYY-MM-DD
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isTime = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const isMonth = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}$/.test(v);
const round2 = (n: number) => Math.round(n * 100) / 100;

function str(args: Args, key: string, required = false): string | undefined {
  const v = args[key];
  if (v === undefined || v === null || v === '') {
    if (required) throw new Error(`${key} is required`);
    return undefined;
  }
  if (typeof v !== 'string') throw new Error(`${key} must be a string`);
  return v.trim();
}
function date(args: Args, key: string, required = false) {
  const v = str(args, key, required);
  if (v !== undefined && !isDate(v)) throw new Error(`${key} must be YYYY-MM-DD`);
  return v;
}
function time(args: Args, key: string) {
  const v = str(args, key);
  if (v !== undefined && !isTime(v)) throw new Error(`${key} must be HH:mm`);
  return v;
}
function limit(args: Args, def = 50, max = 200) {
  const n = Number(args.limit ?? def);
  return Number.isFinite(n) ? Math.min(Math.max(1, Math.floor(n)), max) : def;
}
const like = (q: string) => `%${q.replace(/[%_,()]/g, ' ')}%`;

function check<T = Row[]>({ data, error }: { data: unknown; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

/** Live rows of one table for the owner. */
const live = (table: string, userId: string, columns = '*') => admin.from(table).select(columns).eq('user_id', userId).is('deleted_at', null);

/** Every live row (paged), for totals that must not be cut off by the default row limit. */
async function all(table: string, userId: string, columns: string): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const page = check(await live(table, userId, columns).order('id').range(from, from + 999)) as Row[];
    out.push(...page);
    if (page.length < 1000) return out;
  }
}

async function getOne(table: string, userId: string, id: string): Promise<Row> {
  const row = check(await live(table, userId).eq('id', id).maybeSingle()) as Row | null;
  if (!row) throw new Error(`${table} ${id} not found`);
  return row;
}

const strip = ({ user_id: _u, deleted_at: _d, ...rest }: Row) => rest;

// ---------- money ----------

type Tx = { wallet_id: string; to_wallet_id: string | null; amount: number; currency: string; type: string; date: string; category_id: string | null };

/** Same rule as src/features/money/model.ts walletBalance: opening balance + this wallet's leg of every transaction, same currency only. */
function balanceOf(w: Row, txs: Tx[]) {
  let b = Number(w.balance);
  for (const t of txs) {
    if (t.currency !== w.currency) continue;
    if (t.wallet_id === w.id) b += t.type === 'income' ? t.amount : -t.amount;
    else if (t.type === 'transfer' && t.to_wallet_id === w.id) b += t.amount;
  }
  return round2(b);
}

async function walletsWithBalance(userId: string) {
  const [wallets, txs] = await Promise.all([
    check(await live('wallets', userId, 'id, name, type, currency, balance, sort_order').order('sort_order')) as Row[],
    all('transactions', userId, 'wallet_id, to_wallet_id, amount, currency, type, date, category_id') as Promise<Tx[]>,
  ]);
  return wallets.map((w) => ({ id: w.id, name: w.name, type: w.type, currency: w.currency, balance: balanceOf(w, txs) }));
}

async function monthSummary(userId: string, month: string) {
  const [txs, cats] = await Promise.all([
    check(await live('transactions', userId, 'amount, currency, type, category_id').like('date', `${month}-%`)) as Tx[],
    check(await live('categories', userId, 'id, name_th, name_en, budget_monthly')) as Row[],
  ]);
  const catName = new Map(cats.map((c) => [c.id, `${c.name_th} / ${c.name_en}`]));
  const budget = new Map(cats.map((c) => [c.id, c.budget_monthly as number | null]));
  const byCurrency: Record<string, { income: number; expense: number; byCategory: Record<string, { type: string; total: number; budget?: number }> }> = {};
  for (const t of txs) {
    if (t.type === 'transfer') continue;
    const cur = (byCurrency[t.currency] ??= { income: 0, expense: 0, byCategory: {} });
    if (t.type === 'income') cur.income += t.amount;
    else cur.expense += t.amount;
    const key = t.category_id ? (catName.get(t.category_id) ?? t.category_id) : '(no category)';
    const c = (cur.byCategory[key] ??= { type: t.type, total: 0 });
    c.total = round2(c.total + t.amount);
    const b = t.category_id ? budget.get(t.category_id) : null;
    if (b) c.budget = b;
  }
  for (const cur of Object.values(byCurrency)) {
    cur.income = round2(cur.income);
    cur.expense = round2(cur.expense);
  }
  return { month, byCurrency };
}

// ---------- tool definitions ----------

const S = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false });
const DATE = { type: 'string', description: 'YYYY-MM-DD' };
const TIME = { type: 'string', description: 'HH:mm (24h)' };
const LIMIT = { type: 'integer', minimum: 1, maximum: 200 };
const READ = { readOnlyHint: true };

export const TOOLS = [
  { name: 'get_overview', description: "Today's snapshot: date, open tasks due today / overdue, this month's income & expense, wallet balances.", inputSchema: S({}), annotations: READ },
  {
    name: 'list_tasks',
    description: 'Tasks, filtered by date range, status and text. Undated tasks are included only when no date range is given.',
    inputSchema: S({ from: DATE, to: DATE, status: { type: 'string', enum: ['open', 'done', 'all'], default: 'open' }, query: { type: 'string' }, area_id: { type: 'string' }, limit: LIMIT }),
    annotations: READ,
  },
  { name: 'list_routines', description: 'Routines (habits). rule is "daily" or "weekly:<days>" with 0=Sunday.', inputSchema: S({}), annotations: READ },
  { name: 'search_notes', description: 'Notes by text in title/body (omit query for recent notes). Returns a snippet; use get_note for the full body.', inputSchema: S({ query: { type: 'string' }, limit: LIMIT }), annotations: READ },
  { name: 'get_note', description: 'One note with its full body.', inputSchema: S({ id: { type: 'string' } }, ['id']), annotations: READ },
  { name: 'list_wallets', description: 'Wallets with current balances.', inputSchema: S({}), annotations: READ },
  { name: 'list_categories', description: 'Income / expense categories with monthly budgets.', inputSchema: S({}), annotations: READ },
  { name: 'list_areas', description: 'Life areas (e.g. work, family) used to group tasks and notes.', inputSchema: S({}), annotations: READ },
  {
    name: 'list_transactions',
    description: 'Transactions, newest first.',
    inputSchema: S({ from: DATE, to: DATE, type: { type: 'string', enum: ['income', 'expense', 'transfer'] }, wallet_id: { type: 'string' }, category_id: { type: 'string' }, query: { type: 'string', description: 'Matches note or payee' }, limit: LIMIT }),
    annotations: READ,
  },
  { name: 'money_summary', description: 'Income / expense totals for one month, per currency and per category (with budget).', inputSchema: S({ month: { type: 'string', description: 'YYYY-MM (default: this month)' } }), annotations: READ },
  { name: 'list_bills', description: 'Recurring bills and subscriptions. paid_through is the last period paid.', inputSchema: S({}), annotations: READ },
  {
    name: 'create_task',
    description: 'Add a task. Leave date empty for an inbox task.',
    inputSchema: S(
      { title: { type: 'string' }, date: DATE, start_time: TIME, end_time: TIME, notes: { type: 'string' }, priority: { type: 'integer', enum: [1, 2, 3], description: '1 high, 2 normal, 3 low' }, area_id: { type: 'string' } },
      ['title'],
    ),
  },
  {
    name: 'update_task',
    description: 'Edit a task; only the fields given change. Pass null to clear date / times / notes. Completing a repeating task here does not create its next occurrence.',
    inputSchema: S(
      {
        id: { type: 'string' },
        title: { type: 'string' },
        date: { type: ['string', 'null'] },
        start_time: { type: ['string', 'null'] },
        end_time: { type: ['string', 'null'] },
        notes: { type: ['string', 'null'] },
        priority: { type: 'integer', enum: [1, 2, 3] },
        is_done: { type: 'boolean' },
        area_id: { type: ['string', 'null'] },
      },
      ['id'],
    ),
  },
  { name: 'create_note', description: 'Add a note.', inputSchema: S({ title: { type: 'string' }, body: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } }, ['title']) },
  {
    name: 'update_note',
    description: 'Edit a note; only the fields given change. Use append to add text to the end of the body instead of replacing it.',
    inputSchema: S({ id: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' }, append: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } }, pinned: { type: 'boolean' } }, ['id']),
  },
  {
    name: 'create_transaction',
    description: 'Record income, an expense or a transfer. Currency follows the wallet. Look up wallet_id / category_id with list_wallets / list_categories first.',
    inputSchema: S(
      {
        type: { type: 'string', enum: ['income', 'expense', 'transfer'] },
        amount: { type: 'number', exclusiveMinimum: 0 },
        wallet_id: { type: 'string' },
        to_wallet_id: { type: 'string', description: 'transfer only' },
        category_id: { type: 'string' },
        date: { ...DATE, description: 'YYYY-MM-DD (default: today)' },
        note: { type: 'string' },
        payee: { type: 'string' },
      },
      ['type', 'amount', 'wallet_id'],
    ),
  },
];

// ---------- tool handlers ----------

type Handler = (args: Args, userId: string) => Promise<unknown>;

const handlers: Record<string, Handler> = {
  async get_overview(_args, userId) {
    const d = today();
    const [dueToday, overdue, wallets, month] = await Promise.all([
      live('tasks', userId, 'id, title, start_time, end_time, priority').eq('date', d).eq('is_done', false).order('start_time', { nullsFirst: false }).then(check),
      live('tasks', userId, 'id, title, date, priority').lt('date', d).eq('is_done', false).order('date').limit(50).then(check),
      walletsWithBalance(userId),
      monthSummary(userId, d.slice(0, 7)),
    ]);
    return { today: d, timezone: TZ, dueToday, overdue, thisMonth: month.byCurrency, wallets };
  },

  async list_tasks(args, userId) {
    const from = date(args, 'from');
    const to = date(args, 'to');
    const status = str(args, 'status') ?? 'open';
    const query = str(args, 'query');
    const area = str(args, 'area_id');
    let q = live('tasks', userId, 'id, title, notes, date, start_time, end_time, is_done, priority, area_id, checklist, repeat, routine_id');
    if (from) q = q.gte('date', from);
    if (to) q = q.lte('date', to);
    if (status === 'open') q = q.eq('is_done', false);
    else if (status === 'done') q = q.eq('is_done', true);
    if (query) q = q.or(`title.ilike.${like(query)},notes.ilike.${like(query)}`);
    if (area) q = q.eq('area_id', area);
    return check(await q.order('date', { nullsFirst: true }).order('start_time').limit(limit(args)));
  },

  async list_routines(_args, userId) {
    return check(await live('routines', userId, 'id, title, rule, period, active, area_id').order('title'));
  },

  async search_notes(args, userId) {
    const query = str(args, 'query');
    let q = live('notes', userId, 'id, title, body, tags, pinned, updated_at');
    if (query) q = q.or(`title.ilike.${like(query)},body.ilike.${like(query)}`);
    const rows = check(await q.order('pinned', { ascending: false }).order('updated_at', { ascending: false }).limit(limit(args, 20))) as Row[];
    return rows.map(({ body, updated_at, ...r }) => ({ ...r, snippet: String(body ?? '').slice(0, 300), updated: new Date(Number(updated_at)).toISOString() }));
  },

  async get_note(args, userId) {
    return strip(await getOne('notes', userId, str(args, 'id', true)!));
  },

  list_wallets: (_args, userId) => walletsWithBalance(userId),

  async list_categories(_args, userId) {
    return check(await live('categories', userId, 'id, name_th, name_en, type, budget_monthly').order('type').order('sort_order'));
  },

  async list_areas(_args, userId) {
    return check(await live('areas', userId, 'id, name_th, name_en, parent_id').order('sort_order'));
  },

  async list_transactions(args, userId) {
    const from = date(args, 'from');
    const to = date(args, 'to');
    const type = str(args, 'type');
    const wallet = str(args, 'wallet_id');
    const category = str(args, 'category_id');
    const query = str(args, 'query');
    let q = live('transactions', userId, 'id, date, type, amount, currency, wallet_id, to_wallet_id, category_id, note, payee, source');
    if (from) q = q.gte('date', from);
    if (to) q = q.lte('date', to);
    if (type) q = q.eq('type', type);
    if (wallet) {
      if (!/^[\w-]+$/.test(wallet)) throw new Error('invalid wallet_id');
      q = q.or(`wallet_id.eq.${wallet},to_wallet_id.eq.${wallet}`);
    }
    if (category) q = q.eq('category_id', category);
    if (query) q = q.or(`note.ilike.${like(query)},payee.ilike.${like(query)}`);
    return check(await q.order('date', { ascending: false }).order('created_at', { ascending: false }).limit(limit(args)));
  },

  async money_summary(args, userId) {
    const month = str(args, 'month') ?? today().slice(0, 7);
    if (!isMonth(month)) throw new Error('month must be YYYY-MM');
    return monthSummary(userId, month);
  },

  async list_bills(_args, userId) {
    return check(await live('recurring_bills', userId, 'id, name, amount, currency, due_day, due_month, frequency, is_subscription, paid_through, wallet_id, category_id').order('due_day'));
  },

  async create_task(args, userId) {
    const t = Date.now();
    const priority = args.priority === undefined ? 2 : Number(args.priority);
    if (![1, 2, 3].includes(priority)) throw new Error('priority must be 1, 2 or 3');
    const row = {
      id: crypto.randomUUID(),
      user_id: userId,
      created_at: t,
      updated_at: t,
      title: str(args, 'title', true)!,
      date: date(args, 'date') ?? null,
      start_time: time(args, 'start_time') ?? null,
      end_time: time(args, 'end_time') ?? null,
      notes: str(args, 'notes') ?? null,
      priority,
      area_id: str(args, 'area_id') ?? null,
    };
    return strip(check(await admin.from('tasks').insert(row).select().single()) as Row);
  },

  async update_task(args, userId) {
    const id = str(args, 'id', true)!;
    const existing = await getOne('tasks', userId, id);
    const t = Date.now();
    const patch: Row = { updated_at: t };
    const nullable = (key: string, read: (a: Args, k: string) => string | undefined) => {
      if (!(key in args)) return;
      patch[key] = args[key] === null ? null : (read(args, key) ?? null);
    };
    if ('title' in args) patch.title = str(args, 'title', true);
    nullable('date', date);
    nullable('start_time', time);
    nullable('end_time', time);
    nullable('notes', str);
    nullable('area_id', str);
    if ('priority' in args) {
      if (![1, 2, 3].includes(Number(args.priority))) throw new Error('priority must be 1, 2 or 3');
      patch.priority = Number(args.priority);
    }
    if ('is_done' in args) {
      patch.is_done = !!args.is_done;
      patch.done_at = args.is_done ? (existing.done_at ?? t) : null;
    }
    if (patch.date === null) patch.repeat = null; // same rule as the app: only dated tasks repeat
    return strip(check(await admin.from('tasks').update(patch).eq('id', id).eq('user_id', userId).select().single()) as Row);
  },

  async create_note(args, userId) {
    const t = Date.now();
    const tags = Array.isArray(args.tags) ? args.tags.map(String) : [];
    const row = { id: crypto.randomUUID(), user_id: userId, created_at: t, updated_at: t, title: str(args, 'title', true)!, body: str(args, 'body') ?? '', tags };
    return strip(check(await admin.from('notes').insert(row).select().single()) as Row);
  },

  async update_note(args, userId) {
    const id = str(args, 'id', true)!;
    const existing = await getOne('notes', userId, id);
    const patch: Row = { updated_at: Date.now() };
    if ('title' in args) patch.title = str(args, 'title') ?? '';
    if ('body' in args) patch.body = typeof args.body === 'string' ? args.body : '';
    if (typeof args.append === 'string' && args.append) {
      const base = String(patch.body ?? existing.body ?? '');
      patch.body = base ? `${base}\n\n${args.append}` : args.append;
    }
    if (Array.isArray(args.tags)) patch.tags = args.tags.map(String);
    if (typeof args.pinned === 'boolean') patch.pinned = args.pinned;
    return strip(check(await admin.from('notes').update(patch).eq('id', id).eq('user_id', userId).select().single()) as Row);
  },

  async create_transaction(args, userId) {
    const type = str(args, 'type', true)!;
    if (!['income', 'expense', 'transfer'].includes(type)) throw new Error('type must be income, expense or transfer');
    const amount = Number(args.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('amount must be a positive number');
    const wallet = await getOne('wallets', userId, str(args, 'wallet_id', true)!);
    const toWallet = str(args, 'to_wallet_id');
    if (type === 'transfer') {
      if (!toWallet) throw new Error('to_wallet_id is required for a transfer');
      await getOne('wallets', userId, toWallet);
    }
    const categoryId = type === 'transfer' ? null : (str(args, 'category_id') ?? null);
    if (categoryId) await getOne('categories', userId, categoryId);
    const t = Date.now();
    const row = {
      id: crypto.randomUUID(),
      user_id: userId,
      created_at: t,
      updated_at: t,
      wallet_id: wallet.id,
      to_wallet_id: type === 'transfer' ? toWallet : null,
      amount: round2(amount),
      currency: wallet.currency, // same rule as the app: currency follows the source wallet
      type,
      category_id: categoryId,
      date: date(args, 'date') ?? today(),
      note: str(args, 'note') ?? null,
      payee: str(args, 'payee') ?? null,
      source: 'ai',
    };
    return strip(check(await admin.from('transactions').insert(row).select().single()) as Row);
  },
};

export async function callTool(name: string, args: Args, userId: string): Promise<unknown> {
  const handler = handlers[name];
  if (!handler) throw new Error(`Unknown tool: ${name}`);
  return handler(args, userId);
}
