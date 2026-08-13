begin;

create extension if not exists pgtap with schema extensions;

select plan(44);

select extensions.ok((select relrowsecurity from pg_class where oid = 'public.personas'::regclass), 'personas has RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid = 'public.persona_assets'::regclass), 'persona assets has RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid = 'public.persona_entries'::regclass), 'persona entries has RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid = 'public.persona_question_topics'::regclass), 'persona question topics has RLS enabled');
select extensions.ok((select relrowsecurity from pg_class where oid = 'public.blocks'::regclass), 'blocks has RLS enabled');

select extensions.ok(
  exists (select 1 from storage.buckets where id = 'persona-assets' and public = false),
  'persona asset bucket is private'
);

select extensions.ok(
  not has_table_privilege('authenticated', 'public.personas', 'INSERT')
  and not has_table_privilege('authenticated', 'public.persona_assets', 'INSERT')
  and not has_table_privilege('authenticated', 'public.persona_question_topics', 'INSERT'),
  'persona shells, assets, and anonymous aggregates cannot be inserted directly'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.create_persona(text,text,text,public.persona_visibility)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.register_persona_asset(uuid,text,text,integer,text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.confirm_persona_entry(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.reject_persona_entry(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.record_persona_question_topic(uuid,public.persona_question_topic_kind)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.get_connect_candidates(text[],timestamptz,timestamptz,integer)', 'EXECUTE'),
  'authenticated users can call bounded Persona and Connect RPCs'
);

select extensions.ok(
  not has_function_privilege('anon', 'public.create_persona(text,text,text,public.persona_visibility)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.confirm_persona_entry(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.get_connect_candidates(text[],timestamptz,timestamptz,integer)', 'EXECUTE'),
  'anonymous users cannot call Persona or Connect RPCs'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('61111111-1111-4111-8111-111111111111', 'persona-owner@example.test', '{"nickname":"Persona Owner"}'::jsonb),
  ('62222222-2222-4222-8222-222222222222', 'persona-viewer@example.test', '{"nickname":"Persona Viewer"}'::jsonb),
  ('63333333-3333-4333-8333-333333333333', 'persona-third@example.test', '{"nickname":"Persona Third"}'::jsonb);

create temporary table persona_test_state (
  key text primary key,
  value uuid not null
);

grant select, insert, update, delete on table persona_test_state to authenticated;

set local role authenticated;
set local request.jwt.claim.sub = '61111111-1111-4111-8111-111111111111';

insert into persona_test_state (key, value)
values
  ('public_persona', public.create_persona('Football Me', 'football', 'Casual campus football', 'public')),
  ('private_persona', public.create_persona('Movie Me', 'movies', null, 'private')),
  ('third_persona', public.create_persona('Design Me', 'design', null, 'private'));

update public.personas
set is_enabled = true, allow_matching = true
where id = (select value from persona_test_state where key = 'public_persona');

select extensions.is(
  (select count(*)::integer from public.personas where owner_id = '61111111-1111-4111-8111-111111111111'),
  3,
  'an owner can create exactly three Persona slots'
);

select extensions.throws_ok(
  $$select public.create_persona('Fourth Me', 'music', null, 'private')$$,
  'P0001',
  'persona_limit_reached',
  'a fourth Persona is rejected transactionally'
);

with created as (
  insert into public.persona_entries (persona_id, owner_id, kind, knowledge_key, content)
  values (
    (select value from persona_test_state where key = 'public_persona'),
    '61111111-1111-4111-8111-111111111111',
    'preference',
    'football style',
    'I prefer casual five-a-side football in the evening.'
  )
  returning id
)
insert into persona_test_state (key, value)
select 'first_entry', id from created;

select extensions.ok(
  exists (select 1 from public.persona_entries where id = (select value from persona_test_state where key = 'first_entry') and status = 'draft'),
  'the owner can read a newly created draft'
);

set local request.jwt.claim.sub = '62222222-2222-4222-8222-222222222222';

select extensions.ok(
  exists (select 1 from public.personas where id = (select value from persona_test_state where key = 'public_persona')),
  'an authenticated viewer can read an enabled public Persona'
);

select extensions.is_empty(
  $$select id from public.personas where id = (select value from persona_test_state where key = 'private_persona')$$,
  'a viewer cannot read a private Persona'
);

select extensions.is_empty(
  $$select id from public.persona_entries where id = (select value from persona_test_state where key = 'first_entry')$$,
  'an unconfirmed model or manual draft is never visible to a viewer'
);

set local request.jwt.claim.sub = '61111111-1111-4111-8111-111111111111';
select public.confirm_persona_entry((select value from persona_test_state where key = 'first_entry'));

set local request.jwt.claim.sub = '62222222-2222-4222-8222-222222222222';
select extensions.ok(
  exists (select 1 from public.persona_entries where id = (select value from persona_test_state where key = 'first_entry') and status = 'confirmed'),
  'only an explicitly confirmed entry becomes visible'
);

set local request.jwt.claim.sub = '61111111-1111-4111-8111-111111111111';
with created as (
  insert into public.persona_entries (persona_id, owner_id, kind, knowledge_key, content)
  values (
    (select value from persona_test_state where key = 'public_persona'),
    '61111111-1111-4111-8111-111111111111',
    'preference',
    'Football Style',
    'I now prefer structured seven-a-side football.'
  )
  returning id
)
insert into persona_test_state (key, value)
select 'replacement_entry', id from created;

select public.confirm_persona_entry((select value from persona_test_state where key = 'replacement_entry'));

select extensions.is(
  (select status::text from public.persona_entries where id = (select value from persona_test_state where key = 'first_entry')),
  'replaced',
  'confirming newer knowledge replaces the previous current entry'
);

select extensions.results_eq(
  $$select content from public.persona_entries where persona_id = (select value from persona_test_state where key = 'public_persona') and status = 'confirmed'$$,
  $$values ('I now prefer structured seven-a-side football.'::text)$$,
  'only the latest confirmed value remains current'
);

with created as (
  insert into public.persona_entries (persona_id, owner_id, kind, knowledge_key, content)
  values (
    (select value from persona_test_state where key = 'public_persona'),
    '61111111-1111-4111-8111-111111111111',
    'opinion',
    'training opinion',
    'An unconfirmed opinion.'
  )
  returning id
)
insert into persona_test_state (key, value)
select 'rejected_entry', id from created;

select public.reject_persona_entry((select value from persona_test_state where key = 'rejected_entry'));

set local request.jwt.claim.sub = '62222222-2222-4222-8222-222222222222';
select extensions.is_empty(
  $$select id from public.persona_entries where id = (select value from persona_test_state where key = 'rejected_entry')$$,
  'rejected knowledge never becomes visible'
);

select extensions.lives_ok(
  $$select public.record_persona_question_topic((select value from persona_test_state where key = 'public_persona'), 'availability')$$,
  'a viewer can add only an anonymous topic aggregate'
);

set local request.jwt.claim.sub = '61111111-1111-4111-8111-111111111111';
select extensions.is_empty(
  $$select id from public.persona_question_topics where persona_id = (select value from persona_test_state where key = 'public_persona')$$,
  'a low-volume topic remains hidden to reduce re-identification risk'
);

set local request.jwt.claim.sub = '62222222-2222-4222-8222-222222222222';
select public.record_persona_question_topic((select value from persona_test_state where key = 'public_persona'), 'availability');
select public.record_persona_question_topic((select value from persona_test_state where key = 'public_persona'), 'availability');

set local request.jwt.claim.sub = '61111111-1111-4111-8111-111111111111';
select extensions.results_eq(
  $$select topic_label, question_count from public.persona_question_topics where persona_id = (select value from persona_test_state where key = 'public_persona')$$,
  $$values ('时间安排'::text, 3::integer)$$,
  'the owner sees only a thresholded fixed category and count, never a stranger transcript'
);

set local request.jwt.claim.sub = '62222222-2222-4222-8222-222222222222';
select extensions.is_empty(
  $$select id from public.persona_question_topics$$,
  'a stranger cannot inspect Persona topic aggregates'
);

select extensions.ok(
  to_regclass('public.persona_questions') is null,
  'no raw Persona question or conversation table exists'
);

set local request.jwt.claim.sub = '61111111-1111-4111-8111-111111111111';
insert into storage.objects (id, bucket_id, name, owner, owner_id, metadata)
values (
  '66666666-6666-4666-8666-666666666661',
  'persona-assets',
  '61111111-1111-4111-8111-111111111111/' || (select value from persona_test_state where key = 'public_persona')::text || '/football.webp',
  '61111111-1111-4111-8111-111111111111'::uuid,
  '61111111-1111-4111-8111-111111111111',
  '{"mimetype":"image/webp","size":2048}'::jsonb
);
insert into persona_test_state (key, value)
values (
  'asset',
  public.register_persona_asset(
    (select value from persona_test_state where key = 'public_persona'),
    '61111111-1111-4111-8111-111111111111/' || (select value from persona_test_state where key = 'public_persona')::text || '/football.webp',
    'image/webp',
    2048,
    'Playing football on campus'
  )
);

select extensions.ok(
  exists (
    select 1 from public.persona_assets
    where id = (select value from persona_test_state where key = 'asset')
      and is_visible = false
  ),
  'new source images are private by default and visible only to the owner'
);

update public.persona_assets set is_visible = true where id = (select value from persona_test_state where key = 'asset');

set local request.jwt.claim.sub = '62222222-2222-4222-8222-222222222222';
select extensions.is_empty(
  $$select id from public.persona_assets$$,
  'a viewer cannot read private source metadata or analysis errors'
);

select extensions.ok(
  public.can_read_persona_asset(
    '61111111-1111-4111-8111-111111111111/' || (select value from persona_test_state where key = 'public_persona')::text || '/football.webp'
  ),
  'a viewer can read a deliberately visible image for a public Persona'
);

set local request.jwt.claim.sub = '61111111-1111-4111-8111-111111111111';
update public.persona_assets set is_visible = false where id = (select value from persona_test_state where key = 'asset');
set local request.jwt.claim.sub = '62222222-2222-4222-8222-222222222222';
select extensions.ok(
  not public.can_read_persona_asset(
    '61111111-1111-4111-8111-111111111111/' || (select value from persona_test_state where key = 'public_persona')::text || '/football.webp'
  ),
  'a hidden image cannot be read by a viewer'
);

set local request.jwt.claim.sub = '61111111-1111-4111-8111-111111111111';
with created_skill as (
  insert into public.skills (name, kind, created_by)
  values ('Campus Football', 'interest', '61111111-1111-4111-8111-111111111111')
  returning id
)
insert into public.profile_skills (profile_id, skill_id, self_rating, note)
select '61111111-1111-4111-8111-111111111111', id, 4, 'Available for evening matches'
from created_skill;

set local request.jwt.claim.sub = '62222222-2222-4222-8222-222222222222';
insert into public.blocks (blocker_id, blocked_id)
values ('62222222-2222-4222-8222-222222222222', '61111111-1111-4111-8111-111111111111');

select extensions.results_eq(
  $$select blocked_id from public.blocks$$,
  $$values ('61111111-1111-4111-8111-111111111111'::uuid)$$,
  'a user can inspect their own block list'
);

set local request.jwt.claim.sub = '61111111-1111-4111-8111-111111111111';
select extensions.is_empty(
  $$select id from public.blocks$$,
  'the blocked profile cannot inspect who blocked them'
);

set local request.jwt.claim.sub = '62222222-2222-4222-8222-222222222222';
select extensions.is_empty(
  $$select id from public.personas where id = (select value from persona_test_state where key = 'public_persona')$$,
  'a block in either direction hides public Persona data'
);

select extensions.is_empty(
  $$select id from public.profiles where id = '61111111-1111-4111-8111-111111111111'$$,
  'a block in either direction hides the public Profile direct-query path'
);

select extensions.is_empty(
  $$select id from public.profile_skills where profile_id = '61111111-1111-4111-8111-111111111111'$$,
  'a block in either direction hides the public Skill direct-query path'
);

select extensions.throws_ok(
  $$select public.record_persona_question_topic((select value from persona_test_state where key = 'public_persona'), 'other')$$,
  'P0001',
  'persona_not_found',
  'a blocked viewer cannot add anonymous Persona topics'
);

delete from public.blocks
where blocker_id = '62222222-2222-4222-8222-222222222222'
  and blocked_id = '61111111-1111-4111-8111-111111111111';

set local request.jwt.claim.sub = '62222222-2222-4222-8222-222222222222';
select extensions.ok(
  exists (select 1 from public.get_connect_candidates(array['campus football'], null, null, 10) where profile_id = '61111111-1111-4111-8111-111111111111'),
  'deterministic candidate retrieval includes an eligible matching profile'
);

select extensions.ok(
  (select jsonb_array_length(matched_skills) > 0 from public.get_connect_candidates(array['campus football'], null, null, 10) where profile_id = '61111111-1111-4111-8111-111111111111'),
  'candidate evidence contains only matching contactable Skill data'
);

set local request.jwt.claim.sub = '61111111-1111-4111-8111-111111111111';
update public.profile_skills set allow_matching = false where profile_id = '61111111-1111-4111-8111-111111111111';
set local request.jwt.claim.sub = '62222222-2222-4222-8222-222222222222';
select extensions.is_empty(
  $$select profile_id from public.get_connect_candidates(array['campus football'], null, null, 10) where profile_id = '61111111-1111-4111-8111-111111111111'$$,
  'a Skill that disables matching cannot produce a candidate'
);

set local request.jwt.claim.sub = '61111111-1111-4111-8111-111111111111';
update public.profile_skills set allow_matching = true where profile_id = '61111111-1111-4111-8111-111111111111';
update public.profiles set allow_matching = false where id = '61111111-1111-4111-8111-111111111111';
set local request.jwt.claim.sub = '62222222-2222-4222-8222-222222222222';
select extensions.is_empty(
  $$select profile_id from public.get_connect_candidates(array['campus football'], null, null, 10) where profile_id = '61111111-1111-4111-8111-111111111111'$$,
  'a profile-level matching opt-out excludes every Skill and Persona'
);

set local request.jwt.claim.sub = '61111111-1111-4111-8111-111111111111';
update public.profiles set allow_matching = true where id = '61111111-1111-4111-8111-111111111111';
insert into persona_test_state (key, value)
select 'conflict_activity', public.create_activity(
  'library',
  'Evening Football',
  null,
  timezone('utc', now()) + interval '1 hour',
  timezone('utc', now()) + interval '2 hours',
  4,
  'free'
);

set local request.jwt.claim.sub = '62222222-2222-4222-8222-222222222222';
select extensions.ok(
  (select has_time_conflict from public.get_connect_candidates(
    array['campus football'],
    timezone('utc', now()) + interval '90 minutes',
    timezone('utc', now()) + interval '150 minutes',
    10
  ) where profile_id = '61111111-1111-4111-8111-111111111111'),
  'an overlapping Activity labels a candidate with a time conflict instead of excluding them'
);

select extensions.ok(
  (select jsonb_array_length(persona_evidence) > 0 from public.get_connect_candidates(array['seven-a-side'], null, null, 10) where profile_id = '61111111-1111-4111-8111-111111111111'),
  'matching can use only enabled public confirmed Persona evidence'
);

set local request.jwt.claim.sub = '61111111-1111-4111-8111-111111111111';
insert into public.blocks (blocker_id, blocked_id)
values ('61111111-1111-4111-8111-111111111111', '62222222-2222-4222-8222-222222222222');
set local request.jwt.claim.sub = '62222222-2222-4222-8222-222222222222';
select extensions.is_empty(
  $$select profile_id from public.get_connect_candidates(array['campus football'], null, null, 10) where profile_id = '61111111-1111-4111-8111-111111111111'$$,
  'a hidden incoming block also excludes a recommendation candidate'
);

reset role;

select extensions.ok(
  to_regprocedure('public.is_blocked_with_viewer(uuid)') is null,
  'the incoming-block helper is not exposed as a public RPC'
);

select extensions.ok(
  (
    select bool_and(prosecdef and 'search_path=""' = any (coalesce(proconfig, array[]::text[])))
    from pg_proc
    where oid = any (array[
      'app_private.is_blocked_with_viewer(uuid)'::regprocedure,
      'public.create_persona(text,text,text,public.persona_visibility)'::regprocedure,
      'public.register_persona_asset(uuid,text,text,integer,text)'::regprocedure,
      'public.confirm_persona_entry(uuid)'::regprocedure,
      'public.reject_persona_entry(uuid)'::regprocedure,
      'public.record_persona_question_topic(uuid,public.persona_question_topic_kind)'::regprocedure,
      'public.can_read_persona_asset(text)'::regprocedure,
      'public.get_connect_candidates(text[],timestamptz,timestamptz,integer)'::regprocedure
    ])
  ),
  'all Persona and Connect security definer functions use a fixed empty search path'
);

select extensions.is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'Persona owners can upload their assets',
        'Eligible users can read persona assets',
        'Persona owners can delete orphan assets'
      )
  ),
  3,
  'the private Persona bucket has scoped owner and viewer policies'
);

select * from extensions.finish();
rollback;
