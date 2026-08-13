begin;

create extension if not exists pgtap with schema extensions;
select plan(5);

select extensions.ok(
  to_regclass('public.persona_avatar_models') is null,
  'the public release has no persona avatar model table'
);

select extensions.ok(
  to_regprocedure('public.register_persona_avatar_model(uuid,text,text,bigint)') is null,
  'the public release has no avatar model registration RPC'
);

select extensions.ok(
  to_regprocedure('public.prepare_persona_avatar_model_deletion(uuid,uuid)') is null,
  'the public release has no avatar model deletion RPC'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_policies
    where schemaname = 'storage'
      and (
        coalesce(qual, '') ilike '%persona-models%'
        or coalesce(with_check, '') ilike '%persona-models%'
      )
  ),
  0::bigint,
  'the public release has no persona model storage policies'
);

select extensions.is(
  (select count(*)::bigint from storage.buckets where id = 'persona-models'),
  0::bigint,
  'the public release has no persona model storage bucket'
);

select * from extensions.finish();
rollback;
