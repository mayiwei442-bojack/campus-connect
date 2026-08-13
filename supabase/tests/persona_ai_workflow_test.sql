begin;

create extension if not exists pgtap with schema extensions;
select plan(31);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('81111111-1111-4111-8111-111111111111', 'persona-ai-owner@example.test', '{"nickname":"Persona AI Owner"}'::jsonb),
  ('82222222-2222-4222-8222-222222222222', 'persona-ai-outsider@example.test', '{"nickname":"Persona AI Outsider"}'::jsonb);

create temporary table persona_ai_state (key text primary key, value uuid not null);
grant select, insert, update, delete on table persona_ai_state to authenticated;
create temporary table persona_ai_context (key text primary key, value jsonb not null);
grant select, insert, update, delete on table persona_ai_context to authenticated;

select extensions.is(
  (select file_size_limit from storage.buckets where id = 'persona-assets'),
  52428800::bigint,
  'the Persona bucket accepts images through 50 MiB'
);

set local role authenticated;
set local request.jwt.claim.sub = '81111111-1111-4111-8111-111111111111';

insert into persona_ai_state (key, value)
values (
  'persona',
  public.create_persona('摄影现场', '校园摄影与构图', '只采纳主人确认过的条目', 'private')
);

insert into storage.objects (id, bucket_id, name, owner, owner_id, metadata)
values (
  '86666666-6666-4666-8666-666666666660',
  'persona-assets',
  '81111111-1111-4111-8111-111111111111/' || (select value::text from persona_ai_state where key = 'persona') || '/large.webp',
  '81111111-1111-4111-8111-111111111111'::uuid,
  '81111111-1111-4111-8111-111111111111',
  '{"mimetype":"image/webp","size":52428800}'::jsonb
);

select extensions.lives_ok(
  format(
    'select public.register_persona_asset(%L::uuid, %L, %L, %s, null)',
    (select value from persona_ai_state where key = 'persona'),
    '81111111-1111-4111-8111-111111111111/' || (select value::text from persona_ai_state where key = 'persona') || '/large.webp',
    'image/webp',
    52428800
  ),
  'asset metadata can be registered at the 50 MiB boundary'
);

select extensions.throws_ok(
  format(
    'select public.register_persona_asset(%L::uuid, %L, %L, %s, null)',
    (select value from persona_ai_state where key = 'persona'),
    '81111111-1111-4111-8111-111111111111/' || (select value::text from persona_ai_state where key = 'persona') || '/missing.webp',
    'image/webp',
    2048
  ),
  '22023',
  'PERSONA_STORAGE_OBJECT_MISMATCH',
  'asset metadata cannot be registered for a missing Storage object'
);

insert into storage.objects (id, bucket_id, name, owner, owner_id, metadata)
values (
  '86666666-6666-4666-8666-666666666661',
  'persona-assets',
  '81111111-1111-4111-8111-111111111111/' || (select value::text from persona_ai_state where key = 'persona') || '/scene.webp',
  '81111111-1111-4111-8111-111111111111'::uuid,
  '81111111-1111-4111-8111-111111111111',
  '{"mimetype":"image/webp","size":2048}'::jsonb
);

select extensions.throws_ok(
  format(
    'select public.register_persona_asset(%L::uuid, %L, %L, %s, null)',
    (select value from persona_ai_state where key = 'persona'),
    '81111111-1111-4111-8111-111111111111/' || (select value::text from persona_ai_state where key = 'persona') || '/scene.webp',
    'image/png',
    1024
  ),
  '22023',
  'PERSONA_STORAGE_OBJECT_MISMATCH',
  'asset registration rejects forged MIME type and byte size'
);

insert into persona_ai_state (key, value)
values (
  'asset',
  public.register_persona_asset(
    (select value from persona_ai_state where key = 'persona'),
    '81111111-1111-4111-8111-111111111111/' ||
      (select value::text from persona_ai_state where key = 'persona') || '/scene.webp',
    'image/webp',
    2048,
    '校园夜景练习'
  )
);

insert into persona_ai_context (key, value)
values (
  'analysis',
  public.begin_persona_asset_analysis(
    (select value from persona_ai_state where key = 'persona'),
    (select value from persona_ai_state where key = 'asset')
  )
);

select extensions.ok(
  ((select value from persona_ai_context where key = 'analysis') ->> 'storagePath') like '81111111-1111-4111-8111-111111111111/%',
  'the owner can begin analysis and receives only their own bounded asset metadata'
);

select extensions.is(
  (select analysis_status::text from public.persona_assets where id = (select value from persona_ai_state where key = 'asset')),
  'analyzing',
  'begin transitions the asset into analyzing state'
);

select public.complete_persona_asset_analysis(
  (select value from persona_ai_state where key = 'persona'),
  (select value from persona_ai_state where key = 'asset'),
  ((select value from persona_ai_context where key = 'analysis') ->> 'analysisNonce')::uuid,
  'qwen3.6-flash',
  '[{"kind":"experience","knowledgeKey":"夜景经验","content":"拍摄过校园夜景并关注高光控制"},{"kind":"preference","knowledgeKey":"构图偏好","content":"偏好保留建筑与人物之间的环境关系"}]'::jsonb
);

select extensions.is(
  (select analysis_status::text || ':' || model_name from public.persona_assets where id = (select value from persona_ai_state where key = 'asset')),
  'ready:qwen3.6-flash',
  'completion records a ready state and the bounded model identifier'
);

select extensions.is(
  (select count(*)::integer from public.persona_entries where source_asset_id = (select value from persona_ai_state where key = 'asset') and status = 'draft'),
  2,
  'model proposals are stored only as drafts'
);

select public.confirm_persona_entry((
  select id from public.persona_entries
  where source_asset_id = (select value from persona_ai_state where key = 'asset')
    and knowledge_key = '夜景经验'
));
select public.reject_persona_entry((
  select id from public.persona_entries
  where source_asset_id = (select value from persona_ai_state where key = 'asset')
    and knowledge_key = '构图偏好'
));

select extensions.is(
  (select count(*)::integer from public.persona_entries where persona_id = (select value from persona_ai_state where key = 'persona') and status = 'confirmed'),
  1,
  'only an explicitly confirmed proposal becomes Persona knowledge'
);

select extensions.is(
  (select count(*)::integer from public.persona_entries where persona_id = (select value from persona_ai_state where key = 'persona') and status = 'rejected'),
  1,
  'a rejected proposal remains excluded from confirmed knowledge'
);

select extensions.throws_ok(
  format(
    'delete from storage.objects where bucket_id = %L and name = %L',
    'persona-assets',
    '81111111-1111-4111-8111-111111111111/' ||
      (select value::text from persona_ai_state where key = 'persona') || '/scene.webp'
  ),
  '42501',
  'Direct deletion from storage tables is not allowed. Use the Storage API instead.',
  'registered Storage objects reject direct table deletion at the Storage boundary'
);

select extensions.is(
  (
    select count(*)::integer from storage.objects
    where bucket_id = 'persona-assets'
      and name = '81111111-1111-4111-8111-111111111111/' || (select value::text from persona_ai_state where key = 'persona') || '/scene.webp'
  ),
  1,
  'registered Storage objects cannot be deleted directly around the metadata boundary'
);

insert into persona_ai_context (key, value)
values (
  'previous_analysis',
  (select value from persona_ai_context where key = 'analysis')
), (
  'next_analysis',
  public.begin_persona_asset_analysis(
    (select value from persona_ai_state where key = 'persona'),
    (select value from persona_ai_state where key = 'asset')
  )
);

select extensions.throws_ok(
  format(
    'select public.prepare_persona_asset_deletion(%L::uuid, %L::uuid)',
    (select value from persona_ai_state where key = 'persona'),
    (select value from persona_ai_state where key = 'asset')
  ),
  '55000',
  'ANALYSIS_IN_PROGRESS',
  'deletion cannot race an active image analysis'
);

select extensions.throws_ok(
  format(
    'select public.complete_persona_asset_analysis(%L::uuid, %L::uuid, %L::uuid, %L, %L::jsonb)',
    (select value from persona_ai_state where key = 'persona'),
    (select value from persona_ai_state where key = 'asset'),
    ((select value from persona_ai_context where key = 'previous_analysis') ->> 'analysisNonce')::uuid,
    'qwen3.6-flash',
    '[{"kind":"fact","knowledgeKey":"过期结果","content":"不得落库"}]'
  ),
  '55000',
  'ANALYSIS_NOT_ACTIVE',
  'a late result from a previous analysis attempt cannot overwrite the current attempt'
);

select public.complete_persona_asset_analysis(
  (select value from persona_ai_state where key = 'persona'),
  (select value from persona_ai_state where key = 'asset'),
  ((select value from persona_ai_context where key = 'next_analysis') ->> 'analysisNonce')::uuid,
  'qwen3.6-flash',
  '[{"kind":"experience","knowledgeKey":"夜景经验","content":"已更新：能在校园夜景中控制高光并保留环境层次"}]'::jsonb
);
select public.confirm_persona_entry((
  select id from public.persona_entries
  where source_asset_id = (select value from persona_ai_state where key = 'asset')
    and knowledge_key = '夜景经验'
    and status = 'draft'
));

select extensions.throws_ok(
  format(
    'select public.prepare_persona_asset_deletion(%L::uuid, %L::uuid)',
    (select value from persona_ai_state where key = 'persona'),
    (select value from persona_ai_state where key = 'asset')
  ),
  '55000',
  'CONFIRMED_SOURCE_CANNOT_BE_DELETED',
  'an image that remains confirmed knowledge provenance cannot be deleted'
);

select extensions.is(
  (select count(*)::integer from public.persona_entries where persona_id = (select value from persona_ai_state where key = 'persona') and status = 'confirmed'),
  1,
  'confirming a newer same-key draft atomically replaces the previous knowledge'
);

select extensions.is(
  (select count(*)::integer from public.persona_entries where persona_id = (select value from persona_ai_state where key = 'persona') and status = 'replaced'),
  1,
  'the replaced entry remains historical and cannot participate in answers'
);

set local request.jwt.claim.sub = '82222222-2222-4222-8222-222222222222';

select extensions.throws_ok(
  format(
    'select public.begin_persona_asset_analysis(%L::uuid, %L::uuid)',
    (select value from persona_ai_state where key = 'persona'),
    (select value from persona_ai_state where key = 'asset')
  ),
  '42501',
  'PERSONA_ASSET_NOT_FOUND',
  'another user cannot begin analysis for an owner asset'
);

set local request.jwt.claim.sub = '81111111-1111-4111-8111-111111111111';

select extensions.ok(
  (select bool_and(public.consume_persona_ai_rate_limit('analyze')) from generate_series(1, 4)),
  'the shared limiter accepts the configured Persona analysis allowance'
);

select extensions.ok(
  not public.consume_persona_ai_rate_limit('analyze'),
  'the shared limiter rejects analysis requests above the minute allowance'
);

select extensions.throws_ok(
  $$select public.consume_persona_ai_rate_limit('arbitrary')$$,
  '22023',
  'INVALID_RATE_LIMIT_SCOPE',
  'callers cannot create arbitrary limiter scopes'
);

insert into storage.objects (id, bucket_id, name, owner, owner_id, metadata)
values (
  '86666666-6666-4666-8666-666666666662',
  'persona-assets',
  '81111111-1111-4111-8111-111111111111/' || (select value::text from persona_ai_state where key = 'persona') || '/disposable.webp',
  '81111111-1111-4111-8111-111111111111'::uuid,
  '81111111-1111-4111-8111-111111111111',
  '{"mimetype":"image/webp","size":1024}'::jsonb
);

insert into persona_ai_state (key, value)
values (
  'disposable_asset',
  public.register_persona_asset(
    (select value from persona_ai_state where key = 'persona'),
    '81111111-1111-4111-8111-111111111111/' || (select value::text from persona_ai_state where key = 'persona') || '/disposable.webp',
    'image/webp',
    1024,
    null
  )
);

select extensions.is(
  public.prepare_persona_asset_deletion(
    (select value from persona_ai_state where key = 'persona'),
    (select value from persona_ai_state where key = 'disposable_asset')
  ),
  '81111111-1111-4111-8111-111111111111/' || (select value::text from persona_ai_state where key = 'persona') || '/disposable.webp',
  'the deletion transaction locks and removes unconfirmed asset metadata before returning its trusted path'
);

select extensions.is_empty(
  $$select id from public.persona_assets where id = (select value from persona_ai_state where key = 'disposable_asset')$$,
  'prepared deletion leaves no dangling public asset metadata'
);

select extensions.is(
  (select count(*)::integer from storage.objects where id = '86666666-6666-4666-8666-666666666662'::uuid),
  1,
  'the prepared orphan remains visible only to its owner for deletion through the Storage API'
);

set local request.jwt.claim.sub = '82222222-2222-4222-8222-222222222222';

select extensions.is_empty(
  $$select id from storage.objects where id = '86666666-6666-4666-8666-666666666662'::uuid$$,
  'another authenticated user cannot discover an owner orphan'
);

set local request.jwt.claim.sub = '81111111-1111-4111-8111-111111111111';

select extensions.throws_ok(
  format(
    'select public.delete_persona(%L::uuid)',
    (select value from persona_ai_state where key = 'persona')
  ),
  '55000',
  'PERSONA_HAS_ASSETS',
  'a Persona cannot be deleted while private Storage provenance still exists'
);

reset role;

select extensions.ok(
  has_function_privilege('authenticated', 'public.begin_persona_asset_analysis(uuid,uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.complete_persona_asset_analysis(uuid,uuid,uuid,text,jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.prepare_persona_asset_deletion(uuid,uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.delete_persona(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.begin_persona_asset_analysis(uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.complete_persona_asset_analysis(uuid,uuid,uuid,text,jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.prepare_persona_asset_deletion(uuid,uuid)', 'EXECUTE'),
  'only authenticated users can call the owner-bound analysis transitions'
);

select extensions.ok(
  not has_table_privilege('authenticated', 'app_private.ai_rate_limit_windows', 'SELECT')
  and not has_table_privilege('authenticated', 'app_private.ai_rate_limit_windows', 'INSERT')
  and not has_table_privilege('authenticated', 'app_private.ai_rate_limit_windows', 'UPDATE'),
  'clients have no direct access to shared AI limiter state'
);

select extensions.ok(
  (
    select bool_and(prosecdef and 'search_path=""' = any (coalesce(proconfig, array[]::text[])))
    from pg_proc
    where oid = any (array[
      'public.consume_persona_ai_rate_limit(text)'::regprocedure::oid,
      'public.register_persona_asset(uuid,text,text,integer,text)'::regprocedure::oid,
      'public.prepare_persona_asset_deletion(uuid,uuid)'::regprocedure::oid,
      'public.delete_persona(uuid)'::regprocedure::oid,
      'public.begin_persona_asset_analysis(uuid,uuid)'::regprocedure::oid,
      'public.complete_persona_asset_analysis(uuid,uuid,uuid,text,jsonb)'::regprocedure::oid,
      'public.fail_persona_asset_analysis(uuid,uuid,uuid,text)'::regprocedure::oid
    ])
  ),
  'all Persona AI transitions are fixed-search-path security definers'
);

select extensions.ok(
  not has_function_privilege('anon', 'public.consume_persona_ai_rate_limit(text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.consume_persona_ai_rate_limit(text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.fail_persona_asset_analysis(uuid,uuid,uuid,text)', 'EXECUTE'),
  'Persona AI rate and failure transitions expose only the intended authenticated boundary'
);

select extensions.ok(
  not has_table_privilege('authenticated', 'public.persona_assets', 'DELETE')
  and not has_table_privilege('authenticated', 'public.personas', 'DELETE'),
  'clients cannot bypass locked Persona deletion transactions with direct table deletes'
);

select * from extensions.finish();
rollback;
