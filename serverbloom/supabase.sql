-- Run once in Supabase SQL Editor. Never place a service_role key in this project.
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
  position integer not null check (position between 1 and 10000),
  original_position integer not null check (original_position between 1 and 10000),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  expires_at timestamptz,
  locked boolean not null default false,
  expiry_action text not null default 'normal' check (expiry_action in ('unpublish','normal')),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.server_cards add column if not exists original_position integer;
update public.server_cards set original_position = position where original_position is null;
alter table public.server_cards alter column original_position set not null;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'server_cards_original_position_check'
      and conrelid = 'public.server_cards'::regclass
  ) then
    alter table public.server_cards add constraint server_cards_original_position_check
      check (original_position between 1 and 10000);
  end if;
end $$;

create table if not exists public.server_card_history (
  id bigint generated always as identity primary key,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid not null
);

-- End-time scheduling and unpublishing have been retired. Expiry always returns
-- a card to its original position.
update public.server_cards set ends_at = null where ends_at is not null;
update public.server_cards set expiry_action = 'normal' where expiry_action <> 'normal';
alter table public.server_cards alter column expiry_action set default 'normal';

alter table public.server_cards enable row level security;
alter table public.server_card_history enable row level security;

drop policy if exists "public reads active published cards" on public.server_cards;
create policy "public reads active published cards" on public.server_cards for select
using (
  status = 'published'
  and (starts_at is null or starts_at <= now())
);

drop policy if exists "admin manages cards" on public.server_cards;
create policy "admin manages cards" on public.server_cards for all to authenticated
using ((auth.jwt() ->> 'email') = 'alyonayona0801@gmail.com')
with check ((auth.jwt() ->> 'email') = 'alyonayona0801@gmail.com');

drop policy if exists "admin reads history" on public.server_card_history;
create policy "admin reads history" on public.server_card_history for select to authenticated
using ((auth.jwt() ->> 'email') = 'alyonayona0801@gmail.com');

grant select on public.server_cards to anon, authenticated;
grant insert, update, delete on public.server_cards to authenticated;
grant select on public.server_card_history to authenticated;

-- Public visitors use this deliberately limited read path. Draft cards and
-- cards whose start time has not arrived can never be returned.
create or replace function public.public_serverbloom_cards()
returns setof public.server_cards
language sql stable security definer set search_path = public
as $$
  select *
  from public.server_cards
  where status = 'published'
    and (starts_at is null or starts_at <= now())
  order by locked desc, position asc;
$$;
revoke all on function public.public_serverbloom_cards() from public, anon, authenticated;
grant execute on function public.public_serverbloom_cards() to anon, authenticated;

create or replace function public.is_serverbloom_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(auth.jwt() ->> 'email','') = 'alyonayona0801@gmail.com' $$;

create or replace function public.bootstrap_server_cards(initial_cards jsonb) returns void
language plpgsql security definer set search_path = public
as $$
declare card jsonb; n integer := 0; safe_server_id text;
begin
  if not public.is_serverbloom_admin() then raise exception 'not authorized'; end if;
  if exists(select 1 from server_cards) then return; end if;
  if jsonb_typeof(initial_cards) <> 'array' or jsonb_array_length(initial_cards) > 200 then raise exception 'invalid payload'; end if;
  for card in select * from jsonb_array_elements(initial_cards) loop
    n := n + 1;
    safe_server_id := left(nullif(trim(both '-' from regexp_replace(lower(coalesce(nullif(card->>'id',''),'server-'||n)), '[^a-z0-9_-]+', '-', 'g')), ''), 80);
    if safe_server_id is null then safe_server_id := 'server-'||n; end if;
    if exists(select 1 from server_cards where server_id = safe_server_id) then
      safe_server_id := left(safe_server_id,70) || '-' || n;
    end if;
    insert into server_cards(server_id,name,category,invite_url,tags,description,color,icon,banner,custom_banner,banner_preset,position,original_position,status,updated_by)
    values (
      safe_server_id,
      left(card->>'name',80), left(coalesce(card->>'category','其他'),30), card->>'inviteUrl',
      coalesce(card->'tags','[]'::jsonb), left(coalesce(card->>'description',''),1000),
      case when coalesce(card->>'color',card->>'primaryColor','#755cff') ~ '^#[0-9A-Fa-f]{6}$' then coalesce(card->>'color',card->>'primaryColor','#755cff') else '#755cff' end,
      left(coalesce(card->>'icon',''),500), left(coalesce(card->>'banner',''),500),
      left(coalesce(card->>'customBanner',''),500), left(coalesce(card->>'bannerPreset',''),100),
      n, n, 'published', auth.uid()
    );
  end loop;
end $$;

create or replace function public.publish_server_cards(card_changes jsonb) returns void
language plpgsql security definer set search_path = public
as $$
declare change jsonb;
begin
  if not public.is_serverbloom_admin() then raise exception 'not authorized'; end if;
  if jsonb_typeof(card_changes) <> 'array' or jsonb_array_length(card_changes) > 200 then raise exception 'invalid payload'; end if;
  if exists(select 1 from server_card_history where created_by=auth.uid() and created_at > now()-interval '3 seconds')
    then raise exception 'rate limit'; end if;
  insert into server_card_history(snapshot,created_by)
  select coalesce(jsonb_agg(to_jsonb(c) order by position),'[]'::jsonb), auth.uid() from server_cards c;
  for change in select * from jsonb_array_elements(card_changes) loop
    update server_cards set
      position=greatest(1,least(10000,(change->>'position')::integer)),
      original_position=coalesce(original_position, greatest(1,least(10000,coalesce((change->>'original_position')::integer,(change->>'position')::integer)))),
      status=case when change->>'status' in ('draft','published','archived') then change->>'status' else status end,
      starts_at=(change->>'starts_at')::timestamptz, ends_at=null,
      expires_at=(change->>'expires_at')::timestamptz,
      locked=coalesce((change->>'locked')::boolean,false) and (change->>'position')::integer <= 3,
      expiry_action='normal',
      updated_at=now(),updated_by=auth.uid()
    where id=(change->>'id')::uuid;
  end loop;
end $$;

create or replace function public.restore_previous_server_cards() returns void
language plpgsql security definer set search_path = public
as $$
declare previous jsonb;
begin
  if not public.is_serverbloom_admin() then raise exception 'not authorized'; end if;
  select snapshot into previous from server_card_history where created_by=auth.uid() order by id desc limit 1;
  if previous is null then raise exception 'no previous version'; end if;
  delete from server_cards;
  insert into server_cards(
    id,server_id,name,category,invite_url,tags,description,color,icon,banner,custom_banner,banner_preset,
    position,original_position,status,starts_at,ends_at,expires_at,locked,expiry_action,updated_at,updated_by
  )
  select
    id,server_id,name,category,invite_url,tags,description,color,icon,banner,custom_banner,banner_preset,
    position,coalesce(original_position,position),status,starts_at,null,expires_at,locked,'normal',updated_at,updated_by
  from jsonb_populate_recordset(null::server_cards,previous);
  delete from server_card_history where id=(select id from server_card_history where created_by=auth.uid() order by id desc limit 1);
end $$;

revoke all on function public.bootstrap_server_cards(jsonb) from public, anon;
revoke all on function public.publish_server_cards(jsonb) from public, anon;
revoke all on function public.restore_previous_server_cards() from public, anon;
grant execute on function public.bootstrap_server_cards(jsonb) to authenticated;
grant execute on function public.publish_server_cards(jsonb) to authenticated;
grant execute on function public.restore_previous_server_cards() to authenticated;
