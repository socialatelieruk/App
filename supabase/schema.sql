-- The Social Atelier collabs: run this once in Supabase → SQL Editor → New query.

-- Profiles: one per signed-up user. New influencers start as 'pending'
-- until The Social Atelier approves them.
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null default '',
  full_name text not null default '',
  instagram text not null default '',
  tiktok text not null default '',
  followers integer not null default 0 check (followers >= 0),
  city text not null default '',
  bio text not null default '',
  role text not null default 'influencer' check (role in ('influencer', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table public.collabs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  brand text not null,
  description text not null default '',
  category text not null,
  type text not null check (type in ('Booking', 'Event', 'Walk-in')),
  city text not null,
  location text not null default '',
  image_url text not null default '',
  offer text not null default '',
  deliverables text not null default '',
  min_followers integer not null default 0,
  spots integer not null default 1,
  event_date date,
  apply_by date,
  content_due_days integer not null default 7 check (content_due_days >= 0), -- days after the visit to post by
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  collab_id uuid not null references public.collabs on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  message text not null default '',
  preferred_date date,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'withdrawn')),
  seen boolean not null default true, -- false until the influencer has seen their acceptance
  scheduled_start timestamptz, -- confirmed booking time, set by an admin when accepting
  scheduled_end timestamptz,
  google_event_id text, -- the influencer's Google Calendar event for this booking
  content_due date, -- posting deadline, set by an admin when accepting
  post_links text[] not null default '{}' check (cardinality(post_links) <= 10), -- the creator's live posts
  posted_at timestamptz, -- when the first post link was added
  attendance text check (attendance in ('attended', 'no_show')), -- set by an admin
  created_at timestamptz not null default now(),
  unique (collab_id, user_id),
  check (scheduled_end is null or scheduled_end > scheduled_start)
);

create index on public.applications (user_id);

-- Phones to send push notifications to, one row per app install.
create table public.device_tokens (
  token text primary key,
  user_id uuid not null references public.profiles on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);

create index on public.device_tokens (user_id);

-- Private link for each collab's brand report. Admins only; brands open the
-- report through collab_report() with the token.
create table public.report_links (
  collab_id uuid primary key references public.collabs on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- Influencers' Google Calendar connections. Only the server reads this.
create table public.google_calendar_links (
  user_id uuid primary key references public.profiles on delete cascade,
  email text not null default '',
  refresh_token text not null,
  connected_at timestamptz not null default now()
);

-- Helpers ------------------------------------------------------------------

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
$$;

create function public.is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and status = 'approved')
$$;

-- Create a profile automatically when someone signs up.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email) values (new.id, coalesce(new.email, ''));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Influencers can edit their own profile but not their role or approval status.
-- (auth.uid() is null in the SQL editor, so the project owner can still change anything.)
create function public.protect_profile_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_admin() then
    new.role := old.role;
    new.status := old.status;
    new.email := old.email;
  end if;
  return new;
end;
$$;

create trigger protect_profile_fields before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- Influencers can only withdraw their own applications (or mark them seen);
-- admins set the outcome. A new acceptance starts unseen.
create function public.protect_application_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_admin() then
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

create trigger protect_application_fields before update on public.applications
  for each row execute function public.protect_application_fields();

-- Lets a user delete their own account from inside the app (required by Apple).
create function public.delete_my_account() returns void
language sql security definer set search_path = public as $$
  delete from auth.users where id = auth.uid();
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Saves this phone's push token for the signed-in user. A token moves to
-- whoever signed in on that phone most recently.
create function public.register_device(device_token text, device_platform text) returns void
language sql security definer set search_path = public as $$
  insert into device_tokens (token, user_id, platform) values (device_token, auth.uid(), device_platform)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
$$;

create function public.unregister_device(device_token text) returns void
language sql security definer set search_path = public as $$
  delete from device_tokens where token = device_token and user_id = auth.uid();
$$;

-- Delivery record per influencer, for their reliability score (admins only).
create function public.reliability_stats()
returns table (user_id uuid, on_time int, late int, overdue int, no_shows int, upcoming int)
language sql stable security definer set search_path = public as $$
  select a.user_id,
    count(*) filter (where a.attendance is distinct from 'no_show' and cardinality(a.post_links) > 0
      and (a.content_due is null or (a.posted_at at time zone 'Europe/London')::date <= a.content_due))::int,
    count(*) filter (where a.attendance is distinct from 'no_show' and cardinality(a.post_links) > 0
      and (a.posted_at at time zone 'Europe/London')::date > a.content_due)::int,
    count(*) filter (where a.attendance is distinct from 'no_show' and cardinality(a.post_links) = 0
      and a.content_due < (now() at time zone 'Europe/London')::date)::int,
    count(*) filter (where a.attendance = 'no_show')::int,
    count(*) filter (where a.attendance is distinct from 'no_show' and cardinality(a.post_links) = 0
      and (a.content_due is null or a.content_due >= (now() at time zone 'Europe/London')::date))::int
  from applications a
  where a.status = 'accepted' and is_admin()
  group by a.user_id;
$$;

revoke execute on function public.reliability_stats() from public, anon;
grant execute on function public.reliability_stats() to authenticated;

-- The brand report behind a collab's private link. Anyone with the link can
-- read it, so it leaves out emails, no-shows and anything internal.
create function public.collab_report(report_token uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'collab', json_build_object(
      'title', c.title, 'brand', c.brand, 'type', c.type, 'category', c.category, 'city', c.city,
      'location', c.location, 'image_url', c.image_url, 'event_date', c.event_date, 'deliverables', c.deliverables),
    'creators', coalesce((
      select json_agg(json_build_object(
          'name', p.full_name, 'instagram', p.instagram, 'tiktok', p.tiktok, 'followers', p.followers, 'city', p.city,
          'visited', a.scheduled_start, 'content_due', a.content_due, 'post_links', a.post_links, 'posted_at', a.posted_at)
        order by a.posted_at nulls last, p.full_name)
      from applications a join profiles p on p.id = a.user_id
      where a.collab_id = c.id and a.status = 'accepted' and a.attendance is distinct from 'no_show'
    ), '[]'::json),
    'generated_at', now())
  from report_links r join collabs c on c.id = r.collab_id
  where r.token = report_token;
$$;

grant execute on function public.collab_report(uuid) to anon, authenticated;

-- Which Google account the signed-in influencer has connected, if any.
create function public.my_calendar_link() returns table (email text)
language sql stable security definer set search_path = public as $$
  select email from google_calendar_links where user_id = auth.uid();
$$;

revoke execute on function public.my_calendar_link() from public, anon;
grant execute on function public.my_calendar_link() to authenticated;

revoke execute on function public.register_device(text, text) from public, anon;
revoke execute on function public.unregister_device(text) from public, anon;
grant execute on function public.register_device(text, text) to authenticated;
grant execute on function public.unregister_device(text) to authenticated;

-- Row level security -------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.collabs enable row level security;
alter table public.applications enable row level security;
alter table public.device_tokens enable row level security; -- no policies: only the functions above and the server touch it
alter table public.google_calendar_links enable row level security; -- no policies: server only
alter table public.report_links enable row level security;

create policy "Read own profile or admin reads all" on public.profiles
  for select to authenticated using (id = auth.uid() or is_admin());
create policy "Update own profile or admin updates any" on public.profiles
  for update to authenticated using (id = auth.uid() or is_admin());

create policy "Signed-in users read collabs" on public.collabs
  for select to authenticated using (true);
create policy "Admins create collabs" on public.collabs
  for insert to authenticated with check (is_admin());
create policy "Admins update collabs" on public.collabs
  for update to authenticated using (is_admin());
create policy "Admins delete collabs" on public.collabs
  for delete to authenticated using (is_admin());

create policy "Admins manage report links" on public.report_links
  for all to authenticated using (is_admin()) with check (is_admin());

create policy "Read own applications or admin reads all" on public.applications
  for select to authenticated using (user_id = auth.uid() or is_admin());
create policy "Approved influencers apply to open collabs" on public.applications
  for insert to authenticated with check (
    user_id = auth.uid()
    and status = 'pending'
    and is_approved()
    and exists (
      select 1 from collabs c
      where c.id = collab_id and c.status = 'open' and (c.apply_by is null or c.apply_by >= current_date)
    )
  );
create policy "Update own application or admin updates any" on public.applications
  for update to authenticated using (user_id = auth.uid() or is_admin());
