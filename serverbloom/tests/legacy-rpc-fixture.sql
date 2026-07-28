-- Destructive fixture for an empty disposable Supabase/PostgreSQL test database.
-- Run this file first, then run ../supabase.sql twice, then rank-scheduler.sql.
create extension if not exists pgcrypto;

create table public.server_cards (
  id uuid primary key default gen_random_uuid(),
  server_id text not null unique,
  name text not null,
  category text not null default 'other',
  invite_url text not null,
  tags jsonb not null default '[]',
  description text not null default '',
  color text not null default '#755cff',
  icon text not null default '',
  banner text not null default '',
  custom_banner text not null default '',
  banner_preset text not null default '',
  position integer not null,
  original_position integer not null,
  status text not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  expires_at timestamptz,
  locked boolean not null default false,
  expiry_action text not null default 'normal',
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint server_cards_expiry_action_check
    check (expiry_action in ('normal','unpublish'))
);

insert into public.server_cards (
  server_id,name,invite_url,position,original_position,status,expiry_action
) values (
  'legacy','Legacy','https://discord.gg/legacy',1,1,'published','normal'
);

-- This is the exact legacy return signature that CREATE OR REPLACE cannot alter.
create function public.public_serverbloom_cards()
returns setof public.server_cards
language sql stable
as $$
  select * from public.server_cards order by position
$$;
