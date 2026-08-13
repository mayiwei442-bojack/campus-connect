begin;

create extension if not exists pgtap with schema extensions;
select plan(29);

select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'public.friendships'::regclass),
  'friendships has RLS enabled'
);

select extensions.ok(
  has_table_privilege('authenticated', 'public.friendships', 'SELECT')
  and not has_table_privilege('authenticated', 'public.friendships', 'INSERT')
  and not has_table_privilege('authenticated', 'public.friendships', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.friendships', 'DELETE'),
  'authenticated clients can read involved friendships but cannot write the table directly'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.search_people(text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.send_friend_request(uuid,text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.respond_friend_request(uuid,boolean)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.search_people(text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.send_friend_request(uuid,text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.respond_friend_request(uuid,boolean)', 'EXECUTE'),
  'friend RPCs are exposed only to authenticated users'
);

select extensions.ok(
  (
    select bool_and(prosecdef and 'search_path=""' = any (coalesce(proconfig, array[]::text[])))
    from pg_proc
    where oid = any (array[
      'public.search_people(text)'::regprocedure,
      'public.send_friend_request(uuid,text)'::regprocedure,
      'public.respond_friend_request(uuid,boolean)'::regprocedure,
      'app_private.lock_block_contact_boundary()'::regprocedure
    ])
  ),
  'friend and contact-boundary functions use a fixed definer search path'
);

select extensions.ok(
  exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'friendships'
  ),
  'friendship changes are published to Realtime'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a1111111-1111-4111-8111-111111111111', 'requester@example.test', '{"nickname":"林小雨"}'::jsonb),
  ('a2222222-2222-4222-8222-222222222222', 'friend@example.test', '{"nickname":"陈知行"}'::jsonb),
  ('a3333333-3333-4333-8333-333333333333', 'another@example.test', '{"nickname":"周同学"}'::jsonb),
  ('a4444444-4444-4444-8444-444444444444', 'outsider@example.test', '{"nickname":"局外人"}'::jsonb);

create temporary table friendship_test_state (
  key text primary key,
  value uuid not null
);

grant select, insert, update, delete on table friendship_test_state to authenticated;

set local role authenticated;
set local request.jwt.claim.sub = 'a1111111-1111-4111-8111-111111111111';

select extensions.results_eq(
  $$select nickname from public.search_people('知行')$$,
  $$values ('陈知行'::text)$$,
  'nickname search is case-insensitive and supports partial matches'
);

select extensions.results_eq(
  $$select nickname, email_hint from public.search_people('friend@example.test')$$,
  $$values ('陈知行'::text, 'f***@example.test'::text)$$,
  'email search requires an exact address and only returns a masked hint'
);

select extensions.is_empty(
  $$select profile_id from public.search_people('friend@example')$$,
  'partial email addresses cannot enumerate accounts'
);

insert into friendship_test_state (key, value)
values (
  'primary_friendship',
  public.send_friend_request(
    'a2222222-2222-4222-8222-222222222222',
    '你好，我也喜欢校园摄影，想认识一下。'
  )
);

select extensions.ok(
  (select value from friendship_test_state where key = 'primary_friendship') is not null,
  'an eligible user can send a friend request'
);

select extensions.ok(
  exists (
    select 1
    from public.friendships
    where id = (select value from friendship_test_state where key = 'primary_friendship')
      and requester_id = 'a1111111-1111-4111-8111-111111111111'
      and addressee_id = 'a2222222-2222-4222-8222-222222222222'
      and status = 'pending'
      and introduction = '你好，我也喜欢校园摄影，想认识一下。'
  ),
  'the request stores its direction, pending state, and introduction'
);

select extensions.is(
  (
    select count(*)::integer
    from public.friendships
    where id = (select value from friendship_test_state where key = 'primary_friendship')
  ),
  1,
  'the requester can read their own outgoing request'
);

set local request.jwt.claim.sub = 'a4444444-4444-4444-8444-444444444444';

select extensions.is_empty(
  $$select id from public.friendships$$,
  'an unrelated user cannot inspect friend requests'
);

select extensions.throws_ok(
  $$select public.respond_friend_request(
    (select value from friendship_test_state where key = 'primary_friendship'),
    true
  )$$,
  '42501',
  'PENDING_FRIEND_REQUEST_NOT_FOUND',
  'an unrelated user cannot accept another user request'
);

set local request.jwt.claim.sub = 'a2222222-2222-4222-8222-222222222222';

select extensions.results_eq(
  $$select introduction from public.friendships where status = 'pending'$$,
  $$values ('你好，我也喜欢校园摄影，想认识一下。'::text)$$,
  'the addressee can read the incoming introduction'
);

insert into friendship_test_state (key, value)
values (
  'direct_conversation',
  public.respond_friend_request(
    (select value from friendship_test_state where key = 'primary_friendship'),
    true
  )
);

select extensions.ok(
  (select value from friendship_test_state where key = 'direct_conversation') is not null,
  'accepting a friend request returns a direct conversation'
);

select extensions.ok(
  exists (
    select 1
    from public.friendships
    where id = (select value from friendship_test_state where key = 'primary_friendship')
      and status = 'accepted'
      and conversation_id = (select value from friendship_test_state where key = 'direct_conversation')
      and responded_at is not null
  ),
  'acceptance links the friendship to its conversation'
);

select extensions.ok(
  exists (
    select 1
    from public.conversations
    where id = (select value from friendship_test_state where key = 'direct_conversation')
      and kind = 'direct'
      and activity_id is null
      and is_archived = false
  ),
  'accepted friends receive an active direct conversation'
);

select extensions.is(
  (
    select count(*)::integer
    from public.conversation_members
    where conversation_id = (select value from friendship_test_state where key = 'direct_conversation')
      and left_at is null
  ),
  2,
  'both friends become active direct conversation members'
);

set local request.jwt.claim.sub = 'a1111111-1111-4111-8111-111111111111';

select extensions.ok(
  public.send_message(
    (select value from friendship_test_state where key = 'direct_conversation'),
    'text',
    '很高兴认识你！',
    null,
    null,
    'a5555555-5555-4555-8555-555555555555'
  ) is not null,
  'accepted friends can send messages in the direct conversation'
);

set local request.jwt.claim.sub = 'a4444444-4444-4444-8444-444444444444';

select extensions.throws_ok(
  $$select public.send_message(
    (select value from friendship_test_state where key = 'direct_conversation'),
    'text', 'unauthorized', null, null, 'a6666666-6666-4666-8666-666666666666'
  )$$,
  '42501',
  'ACTIVE_CONVERSATION_MEMBERSHIP_REQUIRED',
  'an outsider cannot send to a direct conversation'
);

set local request.jwt.claim.sub = 'a1111111-1111-4111-8111-111111111111';

select extensions.is(
  public.send_friend_request(
    'a2222222-2222-4222-8222-222222222222',
    '重复申请不会创建第二条关系。'
  ),
  (select value from friendship_test_state where key = 'primary_friendship'),
  'sending to an accepted friend is idempotent'
);

insert into friendship_test_state (key, value)
values (
  'declined_friendship',
  public.send_friend_request(
    'a3333333-3333-4333-8333-333333333333',
    '你好，想一起参加校园活动。'
  )
);

select extensions.ok(
  (select value from friendship_test_state where key = 'declined_friendship') is not null,
  'a separate friend request can be created'
);

set local request.jwt.claim.sub = 'a3333333-3333-4333-8333-333333333333';

select extensions.is(
  public.respond_friend_request(
    (select value from friendship_test_state where key = 'declined_friendship'),
    false
  ),
  null::uuid,
  'declining a friend request does not create a conversation'
);

select extensions.ok(
  exists (
    select 1
    from public.friendships
    where id = (select value from friendship_test_state where key = 'declined_friendship')
      and status = 'declined'
      and conversation_id is null
  ),
  'declined requests retain history without a conversation'
);

set local request.jwt.claim.sub = 'a1111111-1111-4111-8111-111111111111';

select extensions.lives_ok(
  $$insert into public.blocks (blocker_id, blocked_id)
    values (
      'a1111111-1111-4111-8111-111111111111',
      'a2222222-2222-4222-8222-222222222222'
    )$$,
  'a user can block an accepted friend'
);

select extensions.ok(
  exists (
    select 1
    from public.friendships
    where id = (select value from friendship_test_state where key = 'primary_friendship')
      and status = 'cancelled'
  )
  and exists (
    select 1
    from public.conversations
    where id = (select value from friendship_test_state where key = 'direct_conversation')
      and is_archived = true
  ),
  'blocking cancels the friendship and archives direct contact'
);

select extensions.throws_ok(
  $$select public.send_message(
    (select value from friendship_test_state where key = 'direct_conversation'),
    'text', 'blocked contact', null, null, 'a7777777-7777-4777-8777-777777777777'
  )$$,
  '42501',
  'ACTIVE_CONVERSATION_MEMBERSHIP_REQUIRED',
  'an archived blocked conversation rejects new messages'
);

select extensions.is_empty(
  $$select profile_id from public.search_people('friend@example.test')$$,
  'blocked users are excluded from email and nickname search'
);

select extensions.throws_ok(
  $$select public.send_friend_request(
    'a2222222-2222-4222-8222-222222222222',
    'blocked request'
  )$$,
  '42501',
  'ADDRESSEE_NOT_AVAILABLE',
  'a block in either direction prevents new friend requests'
);

select * from extensions.finish();
rollback;
