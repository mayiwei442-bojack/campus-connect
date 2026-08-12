begin;

create extension if not exists pgtap with schema extensions;

select plan(42);

select extensions.ok((select relrowsecurity from pg_class where oid = 'public.places'::regclass), 'places has RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid = 'public.activities'::regclass), 'activities has RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid = 'public.activity_participations'::regclass), 'activity participations has RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid = 'public.activity_invitations'::regclass), 'activity invitations has RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid = 'public.conversations'::regclass), 'conversations has RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid = 'public.conversation_members'::regclass), 'conversation members has RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid = 'public.messages'::regclass), 'messages has RLS enabled');

select extensions.is((select count(*)::integer from public.places), 73, 'all 73 GLB place and anchor pairs are registered');

select extensions.ok(
  exists (select 1 from storage.buckets where id = 'chat-images' and public = false),
  'chat image bucket is private'
);

select extensions.ok(
  not has_table_privilege('authenticated', 'public.activities', 'INSERT')
  and not has_table_privilege('authenticated', 'public.activity_participations', 'INSERT')
  and not has_table_privilege('authenticated', 'public.messages', 'INSERT'),
  'business tables cannot be written directly by authenticated clients'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.create_activity(text,text,text,timestamptz,timestamptz,integer,public.activity_join_mode)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.join_activity(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.respond_activity_join_request(uuid,uuid,boolean)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.leave_activity(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.remove_activity_member(uuid,uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.end_activity(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.create_activity_invitation(uuid,uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.respond_activity_invitation(uuid,boolean)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.send_message(uuid,public.message_kind,text,text,text,uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.promote_activity_waitlist(uuid)', 'EXECUTE'),
  'only bounded public activity and message RPCs are callable'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('11111111-1111-4111-8111-111111111111', 'owner@example.test', '{"nickname":"Activity Owner"}'::jsonb),
  ('22222222-2222-4222-8222-222222222222', 'member@example.test', '{"nickname":"Member Two"}'::jsonb),
  ('33333333-3333-4333-8333-333333333333', 'waiter-one@example.test', '{"nickname":"Waiter Three"}'::jsonb),
  ('44444444-4444-4444-8444-444444444444', 'waiter-two@example.test', '{"nickname":"Waiter Four"}'::jsonb),
  ('55555555-5555-4555-8555-555555555555', 'outsider@example.test', '{"nickname":"Outsider Five"}'::jsonb);

create temporary table test_state (
  key text primary key,
  value uuid not null
);

grant select, insert, update, delete on table test_state to authenticated;

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

insert into test_state (key, value)
select 'free_activity', public.create_activity('library', 'Library Sprint', null, null, null, 2, 'free');

insert into test_state (key, value)
select 'free_conversation', id
from public.conversations
where activity_id = (select value from test_state where key = 'free_activity');

select extensions.ok(
  exists (
    select 1
    from public.activities
    where id = (select value from test_state where key = 'free_activity')
      and creator_id = '11111111-1111-4111-8111-111111111111'
      and place_id = 'library'
  ),
  'authenticated user can create an activity through the transaction RPC'
);

select extensions.is(
  (
    select count(*)::integer
    from public.activity_participations
    where activity_id = (select value from test_state where key = 'free_activity')
      and status = 'joined'
  ),
  1,
  'activity capacity includes the creator'
);

select extensions.ok(
  exists (
    select 1
    from public.conversation_members
    where conversation_id = (select value from test_state where key = 'free_conversation')
      and profile_id = '11111111-1111-4111-8111-111111111111'
      and left_at is null
  ),
  'activity creator is an active conversation member'
);

set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

select extensions.is(
  public.join_activity((select value from test_state where key = 'free_activity')),
  'joined'::public.activity_participation_status,
  'free activity joins immediately while a slot exists'
);

set local request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';

select extensions.is(
  public.join_activity((select value from test_state where key = 'free_activity')),
  'waitlisted'::public.activity_participation_status,
  'free activity waitlists when capacity is full'
);

set local request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';

select extensions.is(
  public.join_activity((select value from test_state where key = 'free_activity')),
  'waitlisted'::public.activity_participation_status,
  'later free joiner is also waitlisted'
);

select extensions.ok(
  (
    select queue_position
    from public.activity_participations
    where activity_id = (select value from test_state where key = 'free_activity')
      and profile_id = '33333333-3333-4333-8333-333333333333'
  ) < (
    select queue_position
    from public.activity_participations
    where activity_id = (select value from test_state where key = 'free_activity')
      and profile_id = '44444444-4444-4444-8444-444444444444'
  ),
  'waitlist order is deterministic FIFO'
);

set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

select extensions.is(
  public.leave_activity((select value from test_state where key = 'free_activity')),
  '33333333-3333-4333-8333-333333333333'::uuid,
  'leaving a joined activity promotes the first waiter'
);

select extensions.ok(
  exists (
    select 1
    from public.activity_participations
    where activity_id = (select value from test_state where key = 'free_activity')
      and profile_id = '22222222-2222-4222-8222-222222222222'
      and status = 'left'
      and left_at is not null
  ),
  'leaving preserves participation history'
);

select extensions.ok(
  exists (
    select 1
    from public.activity_participations
    where activity_id = (select value from test_state where key = 'free_activity')
      and profile_id = '33333333-3333-4333-8333-333333333333'
      and status = 'joined'
      and queue_position is null
  ),
  'promoted waiter becomes a joined participant'
);

select extensions.ok(
  exists (
    select 1
    from public.activity_participations
    where activity_id = (select value from test_state where key = 'free_activity')
      and profile_id = '44444444-4444-4444-8444-444444444444'
      and status = 'waitlisted'
  ),
  'later waiter remains waitlisted after one slot opens'
);

set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

select extensions.throws_ok(
  $$select public.leave_activity((select value from test_state where key = 'free_activity'))$$,
  '22023',
  'CREATOR_MUST_END_ACTIVITY',
  'creator cannot leave without ending the activity'
);

insert into test_state (key, value)
select 'approval_activity', public.create_activity('gym', 'Approval Practice', null, null, null, 2, 'approval');

insert into test_state (key, value)
select 'approval_conversation', id
from public.conversations
where activity_id = (select value from test_state where key = 'approval_activity');

select extensions.ok(
  exists (
    select 1
    from public.activities
    where id = (select value from test_state where key = 'approval_activity')
      and join_mode = 'approval'
  ),
  'approval-mode activity is created with its selected policy'
);

set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

select extensions.is(
  public.join_activity((select value from test_state where key = 'approval_activity')),
  'pending'::public.activity_participation_status,
  'approval-mode join starts pending'
);

set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

select extensions.is(
  public.respond_activity_join_request(
    (select value from test_state where key = 'approval_activity'),
    '22222222-2222-4222-8222-222222222222',
    true
  ),
  'joined'::public.activity_participation_status,
  'creator approval joins a pending user when capacity exists'
);

set local request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';

select extensions.is(
  public.join_activity((select value from test_state where key = 'approval_activity')),
  'pending'::public.activity_participation_status,
  'another approval request remains pending before review'
);

set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

select extensions.is(
  public.respond_activity_join_request(
    (select value from test_state where key = 'approval_activity'),
    '33333333-3333-4333-8333-333333333333',
    false
  ),
  'rejected'::public.activity_participation_status,
  'creator can reject a pending request'
);

insert into test_state (key, value)
select 'invitation', public.create_activity_invitation(
  (select value from test_state where key = 'approval_activity'),
  '44444444-4444-4444-8444-444444444444'
);

select extensions.ok(
  exists (
    select 1
    from public.activity_invitations
    where id = (select value from test_state where key = 'invitation')
      and status = 'pending'
  ),
  'creator can create a pending activity invitation'
);

set local request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';

select extensions.is(
  public.respond_activity_invitation((select value from test_state where key = 'invitation'), true),
  'waitlisted'::public.activity_participation_status,
  'accepted invitation respects capacity and enters the waitlist'
);

set local request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';

insert into test_state (key, value)
select 'message', public.send_message(
  (select value from test_state where key = 'free_conversation'),
  'text',
  'Ready to meet at the library',
  null,
  null,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);

select extensions.ok(
  (select value from test_state where key = 'message') is not null,
  'active activity member can send a text message'
);

select extensions.ok(
  exists (
    select 1
    from public.messages
    where id = (select value from test_state where key = 'message')
      and sender_id = '33333333-3333-4333-8333-333333333333'
      and body = 'Ready to meet at the library'
  ),
  'message sender and body are server-authoritative'
);

set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

select extensions.throws_ok(
  $$select public.send_message(
    (select value from test_state where key = 'free_conversation'),
    'text',
    'I already left',
    null,
    null,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  )$$,
  '42501',
  'ACTIVE_CONVERSATION_MEMBERSHIP_REQUIRED',
  'a member who left cannot send new messages'
);

set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

select extensions.lives_ok(
  $$select public.end_activity((select value from test_state where key = 'free_activity'))$$,
  'creator can end an active activity'
);

select extensions.ok(
  exists (
    select 1
    from public.conversations
    where id = (select value from test_state where key = 'free_conversation')
      and is_archived = true
      and archived_at is not null
  ),
  'ending an activity archives its conversation'
);

set local request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';

select extensions.throws_ok(
  $$select public.send_message(
    (select value from test_state where key = 'free_conversation'),
    'text',
    'Archived room write attempt',
    null,
    null,
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  )$$,
  '42501',
  'ACTIVE_CONVERSATION_MEMBERSHIP_REQUIRED',
  'archived activity conversation is read-only'
);

select extensions.results_eq(
  $$select body from public.messages where id = (select value from test_state where key = 'message')$$,
  $$values ('Ready to meet at the library'::text)$$,
  'archived conversation history remains readable to a member'
);

set local request.jwt.claim.sub = '55555555-5555-4555-8555-555555555555';

select extensions.is_empty(
  $$select id from public.messages where conversation_id = (select value from test_state where key = 'free_conversation')$$,
  'outsider cannot read conversation history'
);

reset role;

select extensions.is(
  (
    select count(*)::integer
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename in ('activities', 'activity_participations', 'messages')
  ),
  3,
  'activity, participation, and message changes are published to Realtime'
);

select extensions.is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'Conversation members can read chat images',
        'Active members can upload chat images',
        'Uploaders can remove unsent chat images'
      )
  ),
  3,
  'private chat image bucket has member-scoped policies'
);

select extensions.ok(
  (
    select bool_and(prosecdef)
    from pg_proc
    where oid = any (array[
      'public.create_activity(text,text,text,timestamptz,timestamptz,integer,public.activity_join_mode)'::regprocedure,
      'public.join_activity(uuid)'::regprocedure,
      'public.respond_activity_join_request(uuid,uuid,boolean)'::regprocedure,
      'public.leave_activity(uuid)'::regprocedure,
      'public.remove_activity_member(uuid,uuid)'::regprocedure,
      'public.end_activity(uuid)'::regprocedure,
      'public.create_activity_invitation(uuid,uuid)'::regprocedure,
      'public.respond_activity_invitation(uuid,boolean)'::regprocedure,
      'public.send_message(uuid,public.message_kind,text,text,text,uuid)'::regprocedure
    ])
  ),
  'all public business RPCs run with a fixed definer boundary'
);

select extensions.ok(
  not has_function_privilege('anon', 'public.create_activity(text,text,text,timestamptz,timestamptz,integer,public.activity_join_mode)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.join_activity(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.send_message(uuid,public.message_kind,text,text,text,uuid)', 'EXECUTE'),
  'anonymous users cannot call activity or message RPCs'
);

select * from extensions.finish();
rollback;
