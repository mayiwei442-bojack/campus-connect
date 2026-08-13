begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('71111111-1111-4111-8111-111111111111', 'connect-owner@example.test', '{"nickname":"Connect Owner"}'::jsonb),
  ('72222222-2222-4222-8222-222222222222', 'connect-invitee@example.test', '{"nickname":"Connect Invitee"}'::jsonb),
  ('73333333-3333-4333-8333-333333333333', 'connect-optout@example.test', '{"nickname":"Connect Optout"}'::jsonb);

update public.profiles set allow_matching = false where id = '73333333-3333-4333-8333-333333333333';

create temporary table connect_invite_state (key text primary key, value uuid not null);
grant select, insert, update, delete on table connect_invite_state to authenticated;

set local role authenticated;
set local request.jwt.claim.sub = '71111111-1111-4111-8111-111111111111';

insert into connect_invite_state (key, value)
values (
  'activity',
  public.create_activity_with_invitation(
    '72222222-2222-4222-8222-222222222222',
    'library',
    'Connect Collaboration',
    'Created from a recommendation card',
    null,
    null,
    4,
    'free'
  )
);

select extensions.ok(
  exists (
    select 1 from public.activities
    where id = (select value from connect_invite_state where key = 'activity')
      and creator_id = '71111111-1111-4111-8111-111111111111'
  ),
  'an eligible recommendation can create an Activity transactionally'
);

select extensions.ok(
  exists (
    select 1 from public.activity_invitations
    where activity_id = (select value from connect_invite_state where key = 'activity')
      and inviter_id = '71111111-1111-4111-8111-111111111111'
      and invitee_id = '72222222-2222-4222-8222-222222222222'
      and status = 'pending'
  ),
  'the same transaction creates a pending invitation for the candidate'
);

select extensions.throws_ok(
  $$select public.create_activity_with_invitation(
    '73333333-3333-4333-8333-333333333333', 'library', 'Opted out invite', null, null, null, 4, 'free'
  )$$,
  '42501',
  'INVITEE_NOT_ELIGIBLE',
  'a profile that disabled matching cannot be invited from Connect'
);

insert into public.blocks (blocker_id, blocked_id)
values ('71111111-1111-4111-8111-111111111111', '72222222-2222-4222-8222-222222222222');

select extensions.throws_ok(
  $$select public.create_activity_with_invitation(
    '72222222-2222-4222-8222-222222222222', 'library', 'Blocked invite', null, null, null, 4, 'free'
  )$$,
  '42501',
  'INVITEE_NOT_ELIGIBLE',
  'a block in either direction invalidates a stale recommendation card'
);

select extensions.is(
  (select count(*)::integer from public.activities where creator_id = '71111111-1111-4111-8111-111111111111'),
  1,
  'failed invitation attempts roll back without orphan Activities'
);

reset role;

select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.create_activity_with_invitation(uuid,text,text,text,timestamptz,timestamptz,integer,public.activity_join_mode)',
    'EXECUTE'
  ) and not has_function_privilege(
    'anon',
    'public.create_activity_with_invitation(uuid,text,text,text,timestamptz,timestamptz,integer,public.activity_join_mode)',
    'EXECUTE'
  ),
  'only authenticated users can call the bounded Connect invitation RPC'
);

select extensions.ok(
  (
    select prosecdef and 'search_path=""' = any (coalesce(proconfig, array[]::text[]))
    from pg_proc
    where oid = 'public.create_activity_with_invitation(uuid,text,text,text,timestamptz,timestamptz,integer,public.activity_join_mode)'::regprocedure
  ),
  'the Connect invitation RPC uses a fixed definer search path'
);

select extensions.ok(
  not has_table_privilege('authenticated', 'public.activities', 'INSERT')
  and not has_table_privilege('authenticated', 'public.activity_invitations', 'INSERT'),
  'the transaction does not loosen direct business-table writes'
);

select * from extensions.finish();
rollback;
