-- One-off cleanup: fold duplicate default areas / categories / wallets in the cloud into the oldest copy.
-- Same rule as the app's src/features/sync/dedupe.ts (which does this on every sync from now on); run
-- this in Supabase Dashboard → SQL Editor to clean up rows that piled up before that shipped.
-- Copies are soft-deleted and references moved, all with a fresh updated_at, so every device pulls the result.
-- Default names below mirror src/db/defaults.ts.
begin;

create temp table merge_map (tbl text not null, dupe text not null, keeper text not null) on commit drop;

-- Wallets (a copy with its own opening balance is left alone)
insert into merge_map
select 'wallets', id, keeper from (
  select id, balance,
         first_value(id) over w as keeper,
         first_value(balance) over w as keeper_balance,
         row_number() over w as rn
  from public.wallets
  where deleted_at is null
    and (name, type, currency) in (values ('เงินสด', 'cash', 'THB'), ('บัญชีธนาคาร (THB)', 'bank', 'THB'), ('UK Bank (GBP)', 'bank', 'GBP'))
  window w as (partition by user_id, name, type, currency order by created_at, id)
) x
where rn > 1 and (balance = 0 or balance = keeper_balance);

-- Categories
insert into merge_map
select 'categories', id, keeper from (
  select id, first_value(id) over w as keeper, row_number() over w as rn
  from public.categories
  where deleted_at is null
    and (name_en, type) in (values
      ('Food', 'expense'), ('Transport', 'expense'), ('Housing', 'expense'), ('Utilities', 'expense'),
      ('Subscriptions', 'expense'), ('Shopping', 'expense'), ('Health', 'expense'), ('Education', 'expense'),
      ('Entertainment', 'expense'), ('Gifts', 'expense'), ('Tax', 'expense'), ('Other', 'expense'),
      ('Salary', 'income'), ('Fees', 'income'), ('Dividend', 'income'), ('Interest', 'income'), ('Other income', 'income'))
  window w as (partition by user_id, name_en, type order by created_at, id)
) x
where rn > 1;

-- Top-level areas
insert into merge_map
select 'areas', id, keeper from (
  select id, first_value(id) over w as keeper, row_number() over w as rn
  from public.areas
  where deleted_at is null and parent_id is null and name_en in ('Work', 'Personal', 'Learning', 'Business')
  window w as (partition by user_id, name_en order by created_at, id)
) x
where rn > 1;

-- Child areas, grouped under their parent's keeper
insert into merge_map
select 'areas', id, keeper from (
  select c.id, first_value(c.id) over w as keeper, row_number() over w as rn
  from public.areas c
  join public.areas p on p.id = c.parent_id and p.deleted_at is null and p.parent_id is null
  left join merge_map pm on pm.tbl = 'areas' and pm.dupe = p.id
  where c.deleted_at is null
    and (p.name_en, c.name_en) in (values
      ('Work', 'Accounting'), ('Work', 'Audit'), ('Work', 'Tax'), ('Work', 'Clients'),
      ('Personal', 'Health'), ('Personal', 'Travel'), ('Personal', 'Finance'), ('Personal', 'Shopping'),
      ('Learning', 'CIMA'), ('Learning', 'Courses'), ('Learning', 'Reading'),
      ('Business', 'App'), ('Business', 'Marketing'))
  window w as (partition by c.user_id, coalesce(pm.keeper, p.id), c.name_en order by c.created_at, c.id)
) x
where rn > 1;

-- Move references to the keeper
do $$
declare
  t bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  update public.transactions r set wallet_id = m.keeper, updated_at = t from merge_map m where m.tbl = 'wallets' and r.wallet_id = m.dupe;
  update public.transactions r set to_wallet_id = m.keeper, updated_at = t from merge_map m where m.tbl = 'wallets' and r.to_wallet_id = m.dupe;
  update public.recurring_bills r set wallet_id = m.keeper, updated_at = t from merge_map m where m.tbl = 'wallets' and r.wallet_id = m.dupe;

  update public.transactions r set category_id = m.keeper, updated_at = t from merge_map m where m.tbl = 'categories' and r.category_id = m.dupe;
  update public.recurring_bills r set category_id = m.keeper, updated_at = t from merge_map m where m.tbl = 'categories' and r.category_id = m.dupe;
  -- Keep a budget set only on a copy
  update public.categories k set budget_monthly = b.budget, updated_at = t
  from (select m.keeper, max(d.budget_monthly) as budget from merge_map m join public.categories d on d.id = m.dupe
        where m.tbl = 'categories' and d.budget_monthly is not null group by m.keeper) b
  where k.id = b.keeper and k.budget_monthly is null;

  update public.areas r set parent_id = m.keeper, updated_at = t from merge_map m
    where m.tbl = 'areas' and r.parent_id = m.dupe and r.id not in (select dupe from merge_map where tbl = 'areas');
  update public.tasks r set area_id = m.keeper, updated_at = t from merge_map m where m.tbl = 'areas' and r.area_id = m.dupe;
  update public.notes r set area_id = m.keeper, updated_at = t from merge_map m where m.tbl = 'areas' and r.area_id = m.dupe;
  update public.routines r set area_id = m.keeper, updated_at = t from merge_map m where m.tbl = 'areas' and r.area_id = m.dupe;
  update public.contacts r set area_id = m.keeper, updated_at = t from merge_map m where m.tbl = 'areas' and r.area_id = m.dupe;
  update public.transactions r set area_id = m.keeper, updated_at = t from merge_map m where m.tbl = 'areas' and r.area_id = m.dupe;
  update public.links r set from_id = m.keeper, updated_at = t from merge_map m where m.tbl = 'areas' and r.from_type = 'area' and r.from_id = m.dupe;
  update public.links r set to_id = m.keeper, updated_at = t from merge_map m where m.tbl = 'areas' and r.to_type = 'area' and r.to_id = m.dupe;

  -- Retire the copies
  update public.wallets set deleted_at = t, updated_at = t where id in (select dupe from merge_map where tbl = 'wallets');
  update public.categories set deleted_at = t, updated_at = t where id in (select dupe from merge_map where tbl = 'categories');
  update public.areas set deleted_at = t, updated_at = t where id in (select dupe from merge_map where tbl = 'areas');
end $$;

select tbl, count(*) as merged from merge_map group by tbl order by tbl;

commit;
