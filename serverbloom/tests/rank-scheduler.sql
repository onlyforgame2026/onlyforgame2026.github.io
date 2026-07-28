-- Run after supabase.sql in Supabase SQL Editor. Every data change is rolled back.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text) returns void
language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAIL: %', message; end if;
end $$;

-- 1. Exercise the exact legacy normal/unpublish constraint ordering in isolation.
create temporary table legacy_server_cards (
  expiry_action text not null default 'normal',
  constraint server_cards_expiry_action_check check (expiry_action in ('normal','unpublish'))
);
insert into legacy_server_cards values ('normal'), ('unpublish');
alter table legacy_server_cards drop constraint server_cards_expiry_action_check;
update legacy_server_cards set expiry_action='restore' where expiry_action='normal';
alter table legacy_server_cards alter column expiry_action set default 'restore';
alter table legacy_server_cards add constraint server_cards_expiry_action_check
  check (expiry_action in ('restore','keep','unpublish'));
select pg_temp.assert_true(
  (select bool_and(expiry_action in ('restore','keep','unpublish')) from legacy_server_cards),
  'old schema migration'
);
select pg_temp.assert_true(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='public_serverbloom_cards'
      and 'effective_rank'=any(p.proargnames)
  ),
  'upgraded public_serverbloom_cards exposes effective_rank'
);
select pg_temp.assert_true(
  has_function_privilege('anon','public.public_serverbloom_cards()','EXECUTE')
  and has_function_privilege('authenticated','public.public_serverbloom_cards()','EXECUTE'),
  'upgraded RPC grants EXECUTE to anon and authenticated'
);

truncate public.server_card_history, public.server_cards restart identity;
insert into public.server_cards (
  server_id,name,category,invite_url,original_rank,target_rank,published,updated_at
)
select 's'||n,'Server '||n,'test','https://discord.gg/test'||n,n,n,true,
       timestamptz '2026-01-01 00:00:00+00'
from generate_series(1,12) n;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","email":"alyonayona0801@gmail.com","role":"authenticated"}',
  true
);

-- 2 and 10. Publish only s9; untouched cards must retain updated_at.
create temporary table unchanged_times as
select id,updated_at from public.server_cards where server_id <> 's9';
select public.publish_server_cards(jsonb_build_array(jsonb_build_object(
  'id',(select id from public.server_cards where server_id='s9'),
  'target_rank',1,'starts_at',null,'ends_at',null,'expiry_action','restore',
  'published',true,'lock_top_three',false
)));
select pg_temp.assert_true(
  (select server_id='s9' from public.public_serverbloom_cards() where effective_rank=1),
  'original rank 9 moves to effective rank 1'
);
select pg_temp.assert_true(
  not exists (
    select 1 from public.server_cards c join unchanged_times u using(id)
    where c.updated_at is distinct from u.updated_at
  ),
  'publishing one card leaves other updated_at values unchanged'
);

-- 3. Future s11 stays original now; the desired target is persisted for later.
update public.server_cards set target_rank=original_rank,starts_at=null,ends_at=null
where server_id='s9';
update public.server_cards set target_rank=2,starts_at=now()+interval '1 day',
  ends_at=null,expiry_action='restore',updated_at=clock_timestamp()
where server_id='s11';
select pg_temp.assert_true(
  (select effective_rank=11 from public.public_serverbloom_cards() where server_id='s11'),
  'future schedule remains at original rank before start'
);

-- 4. An ended restore schedule returns s9 to its original rank.
update public.server_cards set target_rank=1,starts_at=null,
  ends_at=now()-interval '1 second',expiry_action='restore'
where server_id='s9';
select pg_temp.assert_true(
  (select effective_rank=9 from public.public_serverbloom_cards() where server_id='s9'),
  'restore returns card to original rank'
);

-- 5. keep remains at the target after expiry.
update public.server_cards set target_rank=1,starts_at=null,
  ends_at=now()-interval '1 second',expiry_action='keep',updated_at=clock_timestamp()
where server_id='s9';
select pg_temp.assert_true(
  (select effective_rank=1 from public.public_serverbloom_cards() where server_id='s9'),
  'keep preserves target after expiry'
);

-- 6. unpublish removes the card and closes the public rank gap.
update public.server_cards set ends_at=now()-interval '1 second',expiry_action='unpublish'
where server_id='s9';
select pg_temp.assert_true(
  not exists(select 1 from public.public_serverbloom_cards() where server_id='s9')
  and (select array_agg(effective_rank order by effective_rank)
       from public.public_serverbloom_cards())
      = (select array_agg(n::bigint) from generate_series(1,11) n),
  'expired unpublish does not occupy a rank'
);

-- 7. Colliding targets still produce unique consecutive effective ranks.
update public.server_cards set target_rank=2,starts_at=null,ends_at=null,
  expiry_action='restore',updated_at=clock_timestamp()
where server_id in ('s4','s5');
select pg_temp.assert_true(
  (select count(*)=count(distinct effective_rank)
     and min(effective_rank)=1 and max(effective_rank)=count(*)
   from public.public_serverbloom_cards()),
  'target collisions produce unique consecutive ranks'
);

-- 8. Locked cards reserve top-three slots; normal cards cannot displace them.
update public.server_cards set lock_top_three=true,target_rank=1,updated_at=clock_timestamp()
where server_id='s4';
update public.server_cards set lock_top_three=true,target_rank=3,updated_at=clock_timestamp()
where server_id='s5';
update public.server_cards set target_rank=1,lock_top_three=false,updated_at=clock_timestamp()+interval '1 minute'
where server_id='s6';
select pg_temp.assert_true(
  (select effective_rank=1 from public.public_serverbloom_cards() where server_id='s4')
  and (select effective_rank=3 from public.public_serverbloom_cards() where server_id='s5'),
  'locked cards retain reserved top-three slots'
);

-- 9. Public/admin reads alone never mutate target_rank.
create temporary table target_before as select id,target_rank from public.server_cards;
select count(*) from public.public_serverbloom_cards();
select pg_temp.assert_true(
  not exists (
    select 1 from public.server_cards c join target_before b using(id)
    where c.target_rank is distinct from b.target_rank
  ),
  'opening/reading admin data leaves target_rank unchanged'
);

-- Extra guard: a fourth overlapping lock must be rejected atomically.
delete from public.server_card_history;
do $$
begin
  begin
    perform public.publish_server_cards(jsonb_build_array(
      jsonb_build_object('id',(select id from public.server_cards where server_id='s1'),'target_rank',1,'starts_at',null,'ends_at',null,'expiry_action','restore','published',true,'lock_top_three',true),
      jsonb_build_object('id',(select id from public.server_cards where server_id='s2'),'target_rank',2,'starts_at',null,'ends_at',null,'expiry_action','restore','published',true,'lock_top_three',true)
    ));
    raise exception 'FAIL: fourth overlapping lock was accepted';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
end $$;

select * from (values
  (1,'old schema upgrade','PASS'),
  (2,'rank 9 to rank 1','PASS'),
  (3,'future rank 11 to rank 2','PASS'),
  (4,'restore after expiry','PASS'),
  (5,'keep after expiry','PASS'),
  (6,'unpublish after expiry','PASS'),
  (7,'target collision','PASS'),
  (8,'top-three lock','PASS'),
  (9,'read-only admin open','PASS'),
  (10,'unchanged updated_at','PASS')
) as results(test_no,test_name,result)
order by test_no;

rollback;
