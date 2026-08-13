begin;

create extension if not exists pgtap with schema extensions;
select plan(6);

select extensions.ok(
  to_regclass('public.persona_avatar_models') is not null,
  'the restored persona avatar model table exists'
);

select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'public.persona_avatar_models'::regclass),
  'the persona avatar model table keeps row level security enabled'
);

select extensions.ok(
  to_regprocedure('public.register_persona_avatar_model(uuid,text,text,bigint)') is not null,
  'the avatar model registration RPC exists'
);

select extensions.ok(
  to_regprocedure('public.prepare_persona_avatar_model_deletion(uuid,uuid)') is not null,
  'the avatar model deletion RPC exists'
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
  3::bigint,
  'upload, read, and delete storage policies protect persona models'
);

select extensions.ok(
  exists (
    select 1 from storage.buckets
    where id = 'persona-models' and public = false
  ),
  'the persona model storage bucket stays private'
);

select * from extensions.finish();
rollback;
