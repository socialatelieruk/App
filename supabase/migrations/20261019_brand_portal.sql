-- Brand portal: brand accounts, packages and payments (Stripe), briefs, and
-- the shortlist brands approve creators from.
-- Run in Supabase → SQL Editor after schema.sql and 20261018_admin_brands_money.sql.
-- Safe to run more than once.
--
-- Who can see what:
--   - Brands only see their own account, briefs, payments and collabs, and the
--     creators an admin has shortlisted for them (through brand_shortlist(),
--     which never includes emails, phone numbers or admin notes).
--   - Creators never see packages, payments, brand accounts or the shortlist.
--   - Nothing a brand submits is published until an admin approves it.

-- Roles ------------------------------------------------------------------------

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('influencer', 'admin', 'brand'));

-- New users who sign up through "I'm a brand" get the brand role.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, role)
  values (
    new.id,
    coalesce(new.email, ''),
    case when new.raw_user_meta_data ->> 'signup_as' = 'brand' then 'brand' else 'influencer' end
  );
  return new;
end;
$$;

create or replace function public.is_brand() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'brand')
$$;

-- Brand accounts ---------------------------------------------------------------

-- A brand user's sign-up details and review status. Approval links it to a
-- brand record (an existing one, or a new one made from these details).
create table if not exists public.brand_accounts (
  user_id uuid primary key references public.profiles on delete cascade,
  business_name text not null,
  contact_name text not null,
  email text not null,
  phone text not null default '',
  instagram text not null default '',
  website text not null default '',
  area text not null default '',
  category text not null default 'Other'
    check (category in ('Food & Drink', 'Beauty', 'Wellness', 'Fashion', 'Hotels', 'Other')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  brand_id uuid references public.brands on delete set null,
  review_note text not null default '', -- admin only; never shown to the brand
  last_shortlist_email_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists brand_accounts_brand_id_idx on public.brand_accounts (brand_id);

-- The brand record the signed-in user may act for, once approved.
create or replace function public.my_brand_id() returns uuid
language sql stable security definer set search_path = public as $$
  select brand_id from brand_accounts where user_id = auth.uid() and status = 'approved' limit 1
$$;

-- Packages and payments ----------------------------------------------------------

create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  creators integer not null check (creators > 0),
  price numeric(10, 2) not null check (price >= 0),
  billing text not null check (billing in ('one_off', 'monthly')),
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.packages (name, description, creators, price, billing, sort)
select 'Starter', '10 vetted creators for one campaign, with a live brand report.', 10, 350, 'one_off', 1
where not exists (select 1 from public.packages where name = 'Starter');

insert into public.packages (name, description, creators, price, billing, sort)
select 'Monthly', '4 creators every month, with a fresh brief each month.', 4, 350, 'monthly', 2
where not exists (select 1 from public.packages where name = 'Monthly');

-- One row per charge: a one-off purchase, or each month of a subscription.
-- Written by the Stripe webhook (or by an admin); brands can only read theirs.
create table if not exists public.brand_payments (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands on delete cascade,
  package_id uuid references public.packages on delete set null,
  user_id uuid references public.profiles on delete set null,
  kind text not null check (kind in ('one_off', 'monthly')),
  amount numeric(10, 2) not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled')),
  period_start date, -- the month a subscription charge covers
  stripe_session_id text unique,
  stripe_subscription_id text,
  stripe_invoice_id text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists brand_payments_brand_id_idx on public.brand_payments (brand_id);

alter table public.collabs add column if not exists package_id uuid references public.packages on delete set null;

-- Briefs -------------------------------------------------------------------------

-- What a brand wants from a campaign. Each paid payment funds one brief.
create table if not exists public.briefs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands on delete cascade,
  payment_id uuid unique references public.brand_payments on delete set null,
  package_id uuid references public.packages on delete set null,
  title text not null,
  offer text not null default '',
  deliverables text not null default '',
  location text not null default '',
  city text not null default 'Manchester',
  preferred_dates text not null default '',
  type text not null default 'Booking' check (type in ('Booking', 'Event', 'Walk-in')),
  min_followers integer not null default 0 check (min_followers >= 0),
  creator_type text not null default '',
  image_url text not null default '',
  status text not null default 'submitted' check (status in ('submitted', 'changes_requested', 'approved')),
  admin_note text not null default '', -- why it was sent back; shown to the brand
  collab_id uuid references public.collabs on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Brands can edit a brief only while it's sent back, and editing resubmits it.
create or replace function public.protect_brief_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if auth.uid() is not null and not is_admin() then
    if old.status <> 'changes_requested' then
      raise exception 'This brief is with The Social Atelier and can''t be changed right now.';
    end if;
    new.brand_id := old.brand_id;
    new.payment_id := old.payment_id;
    new.package_id := old.package_id;
    new.collab_id := old.collab_id;
    new.admin_note := old.admin_note;
    new.status := 'submitted';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_brief_fields on public.briefs;
create trigger protect_brief_fields before update on public.briefs
  for each row execute function public.protect_brief_fields();

-- Shortlist ----------------------------------------------------------------------

-- Applicants an admin has sent to the brand, and the brand's decision.
create table if not exists public.shortlist (
  application_id uuid primary key references public.applications on delete cascade,
  collab_id uuid not null references public.collabs on delete cascade,
  brand_id uuid not null references public.brands on delete cascade,
  sent_at timestamptz not null default now(),
  decision text check (decision in ('approved', 'declined')),
  note text not null default '',
  decided_at timestamptz,
  handled boolean not null default false -- the admin has acted on the decision
);

create index if not exists shortlist_brand_id_idx on public.shortlist (brand_id);

-- collab_id and brand_id always come from the application's collab.
create or replace function public.shortlist_fill() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select c.id, c.brand_id into new.collab_id, new.brand_id
  from applications a join collabs c on c.id = a.collab_id
  where a.id = new.application_id;
  if new.brand_id is null then
    raise exception 'This collab isn''t linked to a brand.';
  end if;
  return new;
end;
$$;

drop trigger if exists shortlist_fill on public.shortlist;
create trigger shortlist_fill before insert on public.shortlist
  for each row execute function public.shortlist_fill();

-- Changes to existing rules --------------------------------------------------------

-- Only approved creators apply (not brands).
drop policy if exists "Approved influencers apply to open collabs" on public.applications;
create policy "Approved influencers apply to open collabs" on public.applications
  for insert to authenticated with check (
    user_id = auth.uid()
    and status = 'pending'
    and exists (select 1 from profiles where id = auth.uid() and role = 'influencer' and status = 'approved')
    and exists (
      select 1 from collabs c
      where c.id = collab_id and c.status = 'open' and (c.apply_by is null or c.apply_by >= current_date)
    )
  );

-- Creators and admins see every collab; brands only their own.
drop policy if exists "Signed-in users read collabs" on public.collabs;
drop policy if exists "Read collabs" on public.collabs;
create policy "Read collabs" on public.collabs
  for select to authenticated using (is_admin() or not is_brand() or brand_id = my_brand_id());

-- Same rules as before, plus one trusted path: brand_decide() accepts or
-- declines an application on the brand's behalf.
create or replace function public.protect_application_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_admin() and coalesce(current_setting('app.brand_decision', true), '') <> 'on' then
    if new.collab_id <> old.collab_id or new.user_id <> old.user_id then
      raise exception 'Not allowed';
    end if;
    -- Re-applying after withdrawing resets to pending; otherwise only withdraw is allowed.
    if new.status <> old.status
      and not (new.status = 'withdrawn' or (old.status = 'withdrawn' and new.status = 'pending')) then
      raise exception 'Not allowed';
    end if;
    -- Booking times, deadlines and attendance come from admins; calendar event ids from the server.
    new.scheduled_start := old.scheduled_start;
    new.scheduled_end := old.scheduled_end;
    new.google_event_id := old.google_event_id;
    new.content_due := old.content_due;
    new.attendance := old.attendance;
    -- Creators add post links only once accepted, and not after a no-show.
    if new.post_links is distinct from old.post_links
      and (old.status <> 'accepted' or old.attendance is not distinct from 'no_show') then
      raise exception 'Not allowed';
    end if;
  end if;
  if exists (select 1 from unnest(new.post_links) link where link !~ '^https?://[^[:space:]]+$') then
    raise exception 'Post links must be web addresses starting with https://';
  end if;
  if cardinality(new.post_links) = 0 then
    new.posted_at := null;
  elsif cardinality(old.post_links) = 0 then
    new.posted_at := now();
  end if;
  if new.status = 'accepted' and old.status <> 'accepted' then
    new.seen := false;
  end if;
  return new;
end;
$$;

-- Brand actions ----------------------------------------------------------------------

-- Saves a new brand user's sign-up details for review.
drop function if exists public.register_brand(text, text, text, text, text, text, text);
create function public.register_brand(
  in_business_name text, in_contact_name text, in_phone text, in_instagram text, in_website text, in_area text, in_category text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_brand() then
    raise exception 'Only brand accounts can do this.';
  end if;
  if exists (select 1 from brand_accounts where user_id = auth.uid()) then
    raise exception 'Your business details have already been sent.';
  end if;
  insert into brand_accounts (user_id, business_name, contact_name, email, phone, instagram, website, area, category)
  select auth.uid(), trim(in_business_name), trim(in_contact_name), p.email, trim(in_phone),
    trim(both '@' from trim(in_instagram)), trim(in_website), trim(in_area), in_category
  from profiles p where p.id = auth.uid();
  update profiles set full_name = trim(in_contact_name) where id = auth.uid();
end;
$$;

-- Admin: approve a brand account, linking it to an existing brand record or
-- creating one from the sign-up details.
create or replace function public.approve_brand_account(account_user_id uuid, link_brand_id uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  acc brand_accounts;
  bid uuid := link_brand_id;
begin
  if not is_admin() then
    raise exception 'Admins only.';
  end if;
  select * into acc from brand_accounts where user_id = account_user_id;
  if acc is null then
    raise exception 'Brand account not found.';
  end if;
  if bid is null then
    select id into bid from brands where lower(name) = lower(acc.business_name);
  end if;
  if bid is null then
    insert into brands (name, instagram, contact_name, email, phone, area, deal_type)
    values (acc.business_name, acc.instagram, acc.contact_name, acc.email, acc.phone, acc.area, 'paid')
    returning id into bid;
  end if;
  update brand_accounts set status = 'approved', brand_id = bid where user_id = account_user_id;
  update profiles set status = 'approved' where id = account_user_id;
  return bid;
end;
$$;

create or replace function public.decline_brand_account(account_user_id uuid, note text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Admins only.';
  end if;
  update brand_accounts set status = 'declined', review_note = coalesce(note, '') where user_id = account_user_id;
  update profiles set status = 'rejected' where id = account_user_id;
end;
$$;

-- Reliability as a plain label for brands; the numbers stay with admins.
create or replace function public.reliability_label(creator uuid) returns text
language sql stable security definer set search_path = public as $$
  with s as (
    select
      count(*) filter (where attendance is distinct from 'no_show' and cardinality(post_links) > 0
        and (content_due is null or (posted_at at time zone 'Europe/London')::date <= content_due)) as on_time,
      count(*) filter (where attendance is distinct from 'no_show' and cardinality(post_links) > 0
        and (posted_at at time zone 'Europe/London')::date > content_due) as late,
      count(*) filter (where attendance is distinct from 'no_show' and cardinality(post_links) = 0
        and content_due < (now() at time zone 'Europe/London')::date) as overdue,
      count(*) filter (where attendance = 'no_show') as no_shows
    from applications where user_id = creator and status = 'accepted'
  )
  select case
    when on_time + late + overdue + no_shows = 0 then 'New to The Social Atelier'
    when no_shows = 0 and (on_time + 0.75 * late) / (on_time + late + overdue + no_shows) >= 0.9 then 'Excellent track record'
    when no_shows = 0 and (on_time + 0.75 * late) / (on_time + late + overdue + no_shows) >= 0.6 then 'Reliable'
    else 'Building their record'
  end
  from s;
$$;

revoke execute on function public.reliability_label(uuid) from public, anon, authenticated;

-- The signed-in brand's shortlist: only creators an admin sent them, with
-- public profile details and up to 3 past Social Atelier posts. Never emails,
-- phone numbers, applications messages or admin notes.
create or replace function public.brand_shortlist() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
      'application_id', s.application_id,
      'collab_id', s.collab_id,
      'collab_title', c.title,
      'sent_at', s.sent_at,
      'decision', s.decision,
      'note', s.note,
      'decided_at', s.decided_at,
      'name', p.full_name,
      'instagram', p.instagram,
      'tiktok', p.tiktok,
      'followers', p.followers,
      'city', p.city,
      'bio', p.bio,
      'reliability', reliability_label(p.id),
      'past_posts', coalesce((
        select json_agg(x.link) from (
          select unnest(a2.post_links) as link, a2.posted_at
          from applications a2
          where a2.user_id = p.id and a2.id <> a.id and a2.status = 'accepted' and cardinality(a2.post_links) > 0
          order by a2.posted_at desc
          limit 3
        ) x
      ), '[]'::json)
    ) order by s.decision nulls first, s.sent_at desc), '[]'::json)
  from shortlist s
  join applications a on a.id = s.application_id
  join profiles p on p.id = a.user_id
  join collabs c on c.id = s.collab_id
  where my_brand_id() is not null and s.brand_id = my_brand_id();
$$;

-- The brand approves or declines a shortlisted creator. Approving accepts the
-- application (so the creator is notified and the booking flow starts);
-- declining declines it and flags it for an admin to send a replacement.
create or replace function public.brand_decide(application uuid, decision text, note text default '') returns void
language plpgsql security definer set search_path = public as $$
declare
  due_days int;
begin
  if decision not in ('approved', 'declined') then
    raise exception 'Choose approve or decline.';
  end if;
  update shortlist s set decision = brand_decide.decision, note = coalesce(brand_decide.note, ''), decided_at = now(), handled = false
  where s.application_id = application and s.brand_id = my_brand_id() and s.decision is null;
  if not found then
    raise exception 'This creator isn''t waiting for your decision.';
  end if;
  perform set_config('app.brand_decision', 'on', true);
  if decision = 'approved' then
    select c.content_due_days into due_days from applications a join collabs c on c.id = a.collab_id where a.id = application;
    update applications set status = 'accepted',
      content_due = coalesce(content_due, greatest(coalesce(preferred_date, current_date), current_date) + due_days)
    where id = application and status = 'pending';
  else
    update applications set status = 'declined' where id = application and status = 'pending';
  end if;
  perform set_config('app.brand_decision', 'off', true);
end;
$$;

-- The signed-in brand's campaigns, with bookings, delivery counts and the
-- brand report for each.
create or replace function public.brand_campaigns() returns json
language plpgsql security definer set search_path = public as $$
declare
  bid uuid := my_brand_id();
begin
  if bid is null then
    return '[]'::json;
  end if;
  insert into report_links (collab_id)
  select id from collabs where brand_id = bid
  on conflict (collab_id) do nothing;
  return coalesce((
    select json_agg(json_build_object(
        'id', c.id, 'title', c.title, 'status', c.status, 'type', c.type, 'event_date', c.event_date,
        'location', c.location, 'city', c.city, 'spots', c.spots, 'created_at', c.created_at,
        'booked', (select count(*) from applications a where a.collab_id = c.id and a.status = 'accepted'),
        'posted', (select count(*) from applications a where a.collab_id = c.id and a.status = 'accepted'
          and a.attendance is distinct from 'no_show' and cardinality(a.post_links) > 0),
        'due', (select count(*) from applications a where a.collab_id = c.id and a.status = 'accepted'
          and a.attendance is distinct from 'no_show' and cardinality(a.post_links) = 0
          and (a.content_due is null or a.content_due >= (now() at time zone 'Europe/London')::date)),
        'overdue', (select count(*) from applications a where a.collab_id = c.id and a.status = 'accepted'
          and a.attendance is distinct from 'no_show' and cardinality(a.post_links) = 0
          and a.content_due < (now() at time zone 'Europe/London')::date),
        'report', collab_report(r.token)
      ) order by c.created_at desc)
    from collabs c join report_links r on r.collab_id = c.id
    where c.brand_id = bid
  ), '[]'::json);
end;
$$;

revoke execute on function public.register_brand(text, text, text, text, text, text, text) from public, anon;
revoke execute on function public.approve_brand_account(uuid, uuid) from public, anon;
revoke execute on function public.decline_brand_account(uuid, text) from public, anon;
revoke execute on function public.brand_shortlist() from public, anon;
revoke execute on function public.brand_decide(uuid, text, text) from public, anon;
revoke execute on function public.brand_campaigns() from public, anon;
grant execute on function public.register_brand(text, text, text, text, text, text, text) to authenticated;
grant execute on function public.approve_brand_account(uuid, uuid) to authenticated;
grant execute on function public.decline_brand_account(uuid, text) to authenticated;
grant execute on function public.brand_shortlist() to authenticated;
grant execute on function public.brand_decide(uuid, text, text) to authenticated;
grant execute on function public.brand_campaigns() to authenticated;

-- Row level security ----------------------------------------------------------------

alter table public.brand_accounts enable row level security;
alter table public.packages enable row level security;
alter table public.brand_payments enable row level security;
alter table public.briefs enable row level security;
alter table public.shortlist enable row level security;

drop policy if exists "Own account or admin" on public.brand_accounts;
create policy "Own account or admin" on public.brand_accounts
  for select to authenticated using (user_id = auth.uid() or is_admin());
drop policy if exists "Admins update accounts" on public.brand_accounts;
create policy "Admins update accounts" on public.brand_accounts
  for update to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "Approved brands and admins read packages" on public.packages;
create policy "Approved brands and admins read packages" on public.packages
  for select to authenticated using (is_admin() or (active and my_brand_id() is not null));
drop policy if exists "Admins manage packages" on public.packages;
create policy "Admins manage packages" on public.packages
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "Own payments or admin" on public.brand_payments;
create policy "Own payments or admin" on public.brand_payments
  for select to authenticated using (is_admin() or brand_id = my_brand_id());
drop policy if exists "Admins manage payments" on public.brand_payments;
create policy "Admins manage payments" on public.brand_payments
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "Own briefs or admin" on public.briefs;
create policy "Own briefs or admin" on public.briefs
  for select to authenticated using (is_admin() or brand_id = my_brand_id());
drop policy if exists "Brands submit briefs from a paid package" on public.briefs;
create policy "Brands submit briefs from a paid package" on public.briefs
  for insert to authenticated with check (
    is_admin() or (
      brand_id = my_brand_id()
      and status = 'submitted'
      and collab_id is null
      and admin_note = ''
      and exists (
        select 1 from brand_payments p
        where p.id = payment_id and p.brand_id = my_brand_id() and p.status = 'paid'
      )
    )
  );
drop policy if exists "Brands resubmit their own briefs" on public.briefs;
create policy "Brands resubmit their own briefs" on public.briefs
  for update to authenticated using (is_admin() or brand_id = my_brand_id());
drop policy if exists "Admins delete briefs" on public.briefs;
create policy "Admins delete briefs" on public.briefs
  for delete to authenticated using (is_admin());

drop policy if exists "Admins manage the shortlist" on public.shortlist;
create policy "Admins manage the shortlist" on public.shortlist
  for all to authenticated using (is_admin()) with check (is_admin());

-- Brief images ------------------------------------------------------------------------

-- Public to read (they become the collab's image); brands upload into their own folder.
insert into storage.buckets (id, name, public)
values ('brief-images', 'brief-images', true)
on conflict (id) do nothing;

drop policy if exists "Brands upload brief images" on storage.objects;
create policy "Brands upload brief images" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'brief-images'
    and (is_admin() or (storage.foldername(name))[1] = my_brand_id()::text)
  );
