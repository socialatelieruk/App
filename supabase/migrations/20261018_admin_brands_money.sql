-- Brands as records, and money tracking (collab fees and retainers).
-- Run in Supabase → SQL Editor after schema.sql. Safe to run more than once.
--
-- Everything here is admin-only: creators can't read brand contact details,
-- fees or payments. Creators still see a collab's brand name through
-- collabs.brand, which is kept in step with the brand record below.

-- Brands ---------------------------------------------------------------------

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  instagram text not null default '',
  contact_name text not null default '',
  email text not null default '',
  phone text not null default '',
  area text not null default '', -- address or area, e.g. "Ancoats, Manchester"
  deal_type text not null default 'gifted' check (deal_type in ('gifted', 'paid', 'retainer')),
  monthly_fee numeric(10, 2) check (monthly_fee >= 0), -- retainer brands only
  retainer_start date, -- first month of the retainer
  notes text not null default '',
  created_at timestamptz not null default now()
);

create unique index if not exists brands_name_key on public.brands (lower(name));

alter table public.collabs add column if not exists brand_id uuid references public.brands on delete set null;
create index if not exists collabs_brand_id_idx on public.collabs (brand_id);

-- Money ----------------------------------------------------------------------

-- One row per paid collab. No row (or no fee) means the collab is gifted.
create table if not exists public.collab_finances (
  collab_id uuid primary key references public.collabs on delete cascade,
  fee numeric(10, 2) check (fee >= 0),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'invoiced', 'paid')),
  invoiced_on date,
  paid_on date,
  updated_at timestamptz not null default now()
);

-- One row per retainer month that has been invoiced or paid. A month with no
-- row is unpaid at the brand's monthly fee.
create table if not exists public.retainer_payments (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands on delete cascade,
  month date not null check (extract(day from month) = 1), -- first day of the month
  amount numeric(10, 2) not null check (amount >= 0),
  status text not null default 'unpaid' check (status in ('unpaid', 'invoiced', 'paid')),
  invoiced_on date,
  paid_on date,
  unique (brand_id, month)
);

-- Triggers -------------------------------------------------------------------

-- collabs.brand (the name creators see) follows the chosen brand record.
create or replace function public.collab_brand_name() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.brand_id is not null then
    select name into new.brand from brands where id = new.brand_id;
  end if;
  return new;
end;
$$;

drop trigger if exists collab_brand_name on public.collabs;
create trigger collab_brand_name before insert or update of brand_id, brand on public.collabs
  for each row execute function public.collab_brand_name();

create or replace function public.rename_brand_collabs() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update collabs set brand = new.name where brand_id = new.id and brand <> new.name;
  return new;
end;
$$;

drop trigger if exists rename_brand_collabs on public.brands;
create trigger rename_brand_collabs after update of name on public.brands
  for each row execute function public.rename_brand_collabs();

-- Payment dates follow the status: invoicing stamps today unless a date is
-- given, paying stamps today, and going back to unpaid clears them.
create or replace function public.payment_dates() returns trigger
language plpgsql as $$
declare
  -- collab_finances calls it payment_status, retainer_payments calls it status.
  st text := coalesce(to_jsonb(new) ->> 'payment_status', to_jsonb(new) ->> 'status');
begin
  if st = 'unpaid' then
    new.invoiced_on := null;
    new.paid_on := null;
  elsif st = 'invoiced' then
    new.invoiced_on := coalesce(new.invoiced_on, current_date);
    new.paid_on := null;
  else
    new.paid_on := coalesce(new.paid_on, current_date);
  end if;
  return new;
end;
$$;

drop trigger if exists payment_dates on public.collab_finances;
create trigger payment_dates before insert or update on public.collab_finances
  for each row execute function public.payment_dates();

drop trigger if exists payment_dates on public.retainer_payments;
create trigger payment_dates before insert or update on public.retainer_payments
  for each row execute function public.payment_dates();

-- Move existing collabs onto brand records -----------------------------------

insert into public.brands (name)
select distinct on (lower(trim(c.brand))) trim(c.brand)
from public.collabs c
where c.brand_id is null and trim(c.brand) <> ''
  and not exists (select 1 from public.brands b where lower(b.name) = lower(trim(c.brand)))
order by lower(trim(c.brand)), c.created_at;

update public.collabs c set brand_id = b.id
from public.brands b
where c.brand_id is null and lower(b.name) = lower(trim(c.brand));

-- Row level security: admins only --------------------------------------------

alter table public.brands enable row level security;
alter table public.collab_finances enable row level security;
alter table public.retainer_payments enable row level security;

drop policy if exists "Admins only" on public.brands;
create policy "Admins only" on public.brands
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "Admins only" on public.collab_finances;
create policy "Admins only" on public.collab_finances
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "Admins only" on public.retainer_payments;
create policy "Admins only" on public.retainer_payments
  for all to authenticated using (is_admin()) with check (is_admin());
