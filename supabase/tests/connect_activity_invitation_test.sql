begin;

create extension if not exists pgtap with schema extensions;
select plan(16);

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

select extensions.is(
  (
    select status::text from public.activity_invitations
    where activity_id = (select value from connect_invite_state where key = 'activity')
      and invitee_id = '72222222-2222-4222-8222-222222222222'
  ),
  'cancelled',
  'creating a block cancels an already pending invitation'
);

select extensions.throws_ok(
  $$select public.create_activity_with_invitation(
    '72222222-2222-4222-8222-222222222222', 'library', 'Blocked invite', null, null, null, 4, 'free'
  )$$,
  '42501',
  'INVITEE_NOT_ELIGIBLE',
  'a block in either direction invalidates a stale recommendation card'
);

select extensions.throws_ok(
  $$select public.create_activity_invitation(
    (select value from connect_invite_state where key = 'activity'),
    '72222222-2222-4222-8222-222222222222'
  )$$,
  '42501',
  'INVITEE_NOT_ELIGIBLE',
  'the older direct invitation RPC enforces the same block boundary'
);

delete from public.blocks
where blocker_id = '71111111-1111-4111-8111-111111111111'
  and blocked_id = '72222222-2222-4222-8222-222222222222';

select extensions.throws_ok(
  $$select public.create_activity_invitation(
    (select value from connect_invite_state where key = 'activity'),
    '73333333-3333-4333-8333-333333333333'
  )$$,
  '42501',
  'INVITEE_NOT_ELIGIBLE',
  'the older direct invitation RPC enforces matching consent'
);

select extensions.is(
  (select count(*)::integer from public.activities where creator_id = '71111111-1111-4111-8111-111111111111'),
  1,
  'failed invitation attempts roll back without orphan Activities'
);

select extensions.ok(
  (select bool_and(public.consume_connect_rate_limit()) from generate_series(1, 8)),
  'the shared database limiter atomically accepts the configured minute allowance'
);

select extensions.ok(
  not public.consume_connect_rate_limit(),
  'the shared database limiter rejects the ninth request in the same window'
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
  has_function_privilege(
    'authenticated',
    'public.create_activity_invitation(uuid,uuid)',
    'EXECUTE'
  ) and not has_function_privilege(
    'anon',
    'public.create_activity_invitation(uuid,uuid)',
    'EXECUTE'
  ),
  'the legacy invitation entry point is also restricted to authenticated users'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.consume_connect_rate_limit()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.consume_connect_rate_limit()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'app_private.lock_block_contact_boundary()', 'EXECUTE'),
  'the API limiter is authenticated and the block trigger helper is not client-callable'
);

select extensions.ok(
  (
    select bool_and(prosecdef and 'search_path=""' = any (coalesce(proconfig, array[]::text[])))
    from pg_proc
    where oid = any (array[
      'public.create_activity_invitation(uuid,uuid)'::regprocedure::oid,
      'public.create_activity_with_invitation(uuid,text,text,text,timestamptz,timestamptz,integer,public.activity_join_mode)'::regprocedure::oid,
      'public.consume_connect_rate_limit()'::regprocedure::oid,
      'app_private.lock_block_contact_boundary()'::regprocedure::oid
    ])
  ),
  'all invitation, limiter, and block-boundary functions use fixed definer search paths'
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
