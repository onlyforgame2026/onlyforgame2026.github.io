-- ServerBloom ranking scheduler. Run the whole file in Supabase SQL Editor.
-- Never put a service_role key in the website.
create extension if not exists pgcrypto;

create table if not exists public.server_cards (
  id uuid primary key default gen_random_uuid(),
  server_id text not null unique check (server_id ~ '^[a-zA-Z0-9_-]{1,80}$'),
  name text not null check (char_length(name) between 1 and 80 and name !~* '<[[:space:]]*script'),
  category text not null default '其他' check (char_length(category) <= 30),
  invite_url text not null check (invite_url ~* '^https://(www\.)?(discord\.gg/[A-Za-z0-9-]+|discord\.com/invite/[A-Za-z0-9-]+)/?$'),
  tags jsonb not null default '[]'::jsonb check (jsonb_typeof(tags) = 'array' and jsonb_array_length(tags) <= 8),
  description text not null default '' check (char_length(description) <= 1000 and description !~* '<[[:space:]]*script'),
  color text not null default '#755cff' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon text not null default '' check (char_length(icon) <= 500 and icon !~* '^(javascript|data):'),
  banner text not null default '' check (char_length(banner) <= 500 and banner !~* '^(javascript|data):'),
  custom_banner text not null default '' check (char_length(custom_banner) <= 500 and custom_banner !~* '^(javascript|data):'),
  banner_preset text not null default '' check (char_length(banner_preset) <= 100),
  original_rank integer not null check (original_rank between 1 and 10000),
  target_rank integer not null check (target_rank between 1 and 10000),
  starts_at timestamptz,
  ends_at timestamptz,
  expiry_action text not null default 'restore' check (expiry_action in ('restore','keep','unpublish')),
  published boolean not null default true,
  lock_top_three boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint valid_schedule_window check (starts_at is null or ends_at is null or ends_at > starts_at)
);

-- Idempotent migration from the previous ServerBloom schema.
alter table public.server_cards add column if not exists original_rank integer;
alter table public.server_cards add column if not exists target_rank integer;
alter table public.server_cards add column if not exists published boolean;
alter table public.server_cards add column if not exists lock_top_three boolean;
do $$
begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='server_cards' and column_name='position') then
    execute 'update public.server_cards set original_rank=coalesce(original_rank,original_position,position), target_rank=coalesce(target_rank,position,original_position)';
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='server_cards' and column_name='status') then
    execute 'update public.server_cards set published=coalesce(published,status=''published'')';
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='server_cards' and column_name='locked') then
    execute 'update public.server_cards set lock_top_three=coalesce(lock_top_three,locked,false)';
  end if;
end $$;
update public.server_cards set
  original_rank=coalesce(original_rank,target_rank),
  target_rank=coalesce(target_rank,original_rank),
  published=coalesce(published,true),
  lock_top_three=coalesce(lock_top_three,false),
  expiry_action=case expiry_action when 'normal' then 'restore' else expiry_action end;
alter table public.server_cards alter column original_rank set not null;
alter table public.server_cards alter column target_rank set not null;
alter table public.server_cards alter column published set default true;
alter table public.server_cards alter column published set not null;
alter table public.server_cards alter column lock_top_three set default false;
alter table public.server_cards alter column lock_top_three set not null;
alter table public.server_cards drop constraint if exists server_cards_expiry_action_check;
alter table public.server_cards add constraint server_cards_expiry_action_check
  check (expiry_action in ('restore','keep','unpublish'));
alter table public.server_cards drop constraint if exists valid_schedule_window;
alter table public.server_cards add constraint valid_schedule_window
  check (starts_at is null or ends_at is null or ends_at > starts_at);

create table if not exists public.server_card_history (
  id bigint generated always as identity primary key,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid not null
);

alter table public.server_cards enable row level security;
alter table public.server_card_history enable row level security;
drop policy if exists "public reads active published cards" on public.server_cards;
drop policy if exists "admin manages cards" on public.server_cards;
create policy "admin manages cards" on public.server_cards for all to authenticated
using (lower(auth.jwt() ->> 'email') = 'alyonayona0801@gmail.com')
with check (lower(auth.jwt() ->> 'email') = 'alyonayona0801@gmail.com');
drop policy if exists "admin reads history" on public.server_card_history;
create policy "admin reads history" on public.server_card_history for select to authenticated
using (lower(auth.jwt() ->> 'email') = 'alyonayona0801@gmail.com');
revoke all on public.server_cards from anon;
grant select, insert, update, delete on public.server_cards to authenticated;
grant select on public.server_card_history to authenticated;

create or replace function public.is_serverbloom_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select lower(coalesce(auth.jwt() ->> 'email','')) = 'alyonayona0801@gmail.com' $$;

-- Returns only public cards. It computes active/expired state at query time,
-- resolves rank collisions by stable insertion, then emits ranks 1..N.
create or replace function public.public_serverbloom_cards()
returns table (
  id uuid, server_id text, name text, category text, invite_url text, tags jsonb,
  description text, color text, icon text, banner text, custom_banner text,
  banner_preset text, original_rank integer, target_rank integer, starts_at timestamptz,
  ends_at timestamptz, expiry_action text, published boolean, lock_top_three boolean,
  effective_rank bigint
)
language sql stable security definer set search_path = public
as $$
  with state as (
    select c.*,
      (c.starts_at is null or c.starts_at <= now()) as has_started,
      (c.ends_at is not null and c.ends_at <= now()) as has_ended,
      case
        when c.ends_at is not null and c.ends_at <= now() and c.expiry_action = 'unpublish' then false
        else c.published
      end as is_visible,
      case
        when c.starts_at is not null and c.starts_at > now() then c.original_rank
        when c.ends_at is not null and c.ends_at <= now() and c.expiry_action = 'restore' then c.original_rank
        else c.target_rank
      end as desired_rank,
      case
        when c.starts_at is not null and c.starts_at > now() then false
        when c.ends_at is not null and c.ends_at <= now() then false
        else c.lock_top_three
      end as active_lock
    from public.server_cards c
  ), ordered as (
    select s.*, row_number() over (
      order by
        case when active_lock then least(desired_rank,3) else desired_rank end,
        active_lock desc, updated_at desc, original_rank, server_id
    ) as effective_rank
    from state s where is_visible
  )
  select id,server_id,name,category,invite_url,tags,description,color,icon,banner,
    custom_banner,banner_preset,original_rank,target_rank,starts_at,ends_at,
    expiry_action,published,active_lock,effective_rank
  from ordered order by effective_rank;
$$;
revoke all on function public.public_serverbloom_cards() from public;
grant execute on function public.public_serverbloom_cards() to anon, authenticated;

create or replace function public.bootstrap_server_cards(initial_cards jsonb) returns void
language plpgsql security definer set search_path = public
as $$
declare card jsonb; n integer := 0; safe_id text;
begin
  if not public.is_serverbloom_admin() then raise exception '未授權'; end if;
  if exists(select 1 from server_cards) then return; end if;
  if jsonb_typeof(initial_cards) <> 'array' or jsonb_array_length(initial_cards) > 200 then raise exception '資料格式無效'; end if;
  for card in select * from jsonb_array_elements(initial_cards) loop
    n := n + 1;
    safe_id := left(nullif(trim(both '-' from regexp_replace(lower(coalesce(nullif(card->>'id',''),'server-'||n)), '[^a-z0-9_-]+', '-', 'g')), ''),80);
    if safe_id is null then safe_id := 'server-'||n; end if;
    if exists(select 1 from server_cards where server_id=safe_id) then safe_id := left(safe_id,70)||'-'||n; end if;
    insert into server_cards(server_id,name,category,invite_url,tags,description,color,icon,banner,custom_banner,banner_preset,original_rank,target_rank,published,updated_by)
    values (safe_id,left(card->>'name',80),left(coalesce(card->>'category','其他'),30),card->>'inviteUrl',
      coalesce(card->'tags','[]'::jsonb),left(coalesce(card->>'description',''),1000),
      case when coalesce(card->>'color',card->>'primaryColor','#755cff') ~ '^#[0-9A-Fa-f]{6}$' then coalesce(card->>'color',card->>'primaryColor','#755cff') else '#755cff' end,
      left(coalesce(card->>'icon',''),500),left(coalesce(card->>'banner',''),500),
      left(coalesce(card->>'customBanner',''),500),left(coalesce(card->>'bannerPreset',''),100),
      n,n,true,auth.uid());
  end loop;
end $$;

create or replace function public.publish_server_cards(card_changes jsonb) returns void
language plpgsql security definer set search_path = public
as $$
declare change jsonb; start_time timestamptz; end_time timestamptz;
begin
  if not public.is_serverbloom_admin() then raise exception '未授權'; end if;
  if jsonb_typeof(card_changes) <> 'array' or jsonb_array_length(card_changes) > 200 then raise exception '資料格式無效'; end if;
  if exists(select 1 from server_card_history where created_by=auth.uid() and created_at>now()-interval '3 seconds') then raise exception '操作太頻繁'; end if;
  insert into server_card_history(snapshot,created_by)
    select coalesce(jsonb_agg(to_jsonb(c) order by original_rank),'[]'::jsonb),auth.uid() from server_cards c;
  for change in select * from jsonb_array_elements(card_changes) loop
    start_time := nullif(change->>'starts_at','')::timestamptz;
    end_time := nullif(change->>'ends_at','')::timestamptz;
    if start_time is not null and end_time is not null and end_time <= start_time then
      raise exception '結束時間必須晚於開始時間';
    end if;
    update server_cards set
      target_rank=greatest(1,least(10000,(change->>'target_rank')::integer)),
      starts_at=start_time, ends_at=end_time,
      expiry_action=case when change->>'expiry_action' in ('restore','keep','unpublish') then change->>'expiry_action' else 'restore' end,
      published=coalesce((change->>'published')::boolean,false),
      lock_top_three=coalesce((change->>'lock_top_three')::boolean,false) and (change->>'target_rank')::integer <= 3,
      updated_at=now(),updated_by=auth.uid()
    where id=(change->>'id')::uuid;
  end loop;
end $$;

create or replace function public.reset_server_card_schedules() returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_serverbloom_admin() then raise exception '未授權'; end if;
  insert into server_card_history(snapshot,created_by)
    select coalesce(jsonb_agg(to_jsonb(c) order by original_rank),'[]'::jsonb),auth.uid() from server_cards c;
  update server_cards set target_rank=original_rank,starts_at=null,ends_at=null,
    expiry_action='restore',lock_top_three=false,updated_at=now(),updated_by=auth.uid();
end $$;

create or replace function public.restore_previous_server_cards() returns void
language plpgsql security definer set search_path = public
as $$
declare previous jsonb; history_id bigint;
begin
  if not public.is_serverbloom_admin() then raise exception '未授權'; end if;
  select id,snapshot into history_id,previous from server_card_history where created_by=auth.uid() order by id desc limit 1;
  if previous is null then raise exception '沒有可復原的版本'; end if;
  delete from server_cards;
  insert into server_cards select * from jsonb_populate_recordset(null::server_cards,previous);
  delete from server_card_history where id=history_id;
end $$;

revoke all on function public.bootstrap_server_cards(jsonb) from public, anon;
revoke all on function public.publish_server_cards(jsonb) from public, anon;
revoke all on function public.reset_server_card_schedules() from public, anon;
revoke all on function public.restore_previous_server_cards() from public, anon;
grant execute on function public.bootstrap_server_cards(jsonb) to authenticated;
grant execute on function public.publish_server_cards(jsonb) to authenticated;
grant execute on function public.reset_server_card_schedules() to authenticated;
grant execute on function public.restore_previous_server_cards() to authenticated;
