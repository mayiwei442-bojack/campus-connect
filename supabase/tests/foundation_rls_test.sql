begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles has RLS enabled'
);

select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'public.skills'::regclass),
  'skills has RLS enabled'
);

select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'public.profile_skills'::regclass),
  'profile_skills has RLS enabled'
);

select extensions.ok(
  to_regclass('public.skills_created_by_idx') is not null,
  'skills.created_by has a covering index'
);

select extensions.ok(
  not has_table_privilege('anon', 'public.profiles', 'SELECT'),
  'anonymous users cannot read profiles'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('11111111-1111-4111-8111-111111111111', 'one@example.test', '{"nickname":"User One"}'::jsonb),
  ('22222222-2222-4222-8222-222222222222', 'two@example.test', '{"nickname":"User Two"}'::jsonb);

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

select extensions.results_eq(
  $$update public.profiles set nickname = 'Updated One' where id = '11111111-1111-4111-8111-111111111111' returning nickname$$,
  $$values ('Updated One'::text)$$,
  'a user can update their own profile'
);

select extensions.is_empty(
  $$update public.profiles set nickname = 'Compromised' where id = '22222222-2222-4222-8222-222222222222' returning nickname$$,
  'a user cannot update another profile'
);

select extensions.ok(
  exists (
    select 1
    from pg_default_acl defaults
    where defaults.defaclrole = 'postgres'::regrole
      and defaults.defaclnamespace = 'public'::regnamespace
      and defaults.defaclobjtype = 'f'
  )
  and not exists (
    select 1
    from pg_default_acl defaults
    cross join lateral aclexplode(defaults.defaclacl) privileges
    where defaults.defaclrole = 'postgres'::regrole
      and defaults.defaclnamespace = 'public'::regnamespace
      and defaults.defaclobjtype = 'f'
      and privileges.privilege_type = 'EXECUTE'
      and privileges.grantee in (
        0,
        'anon'::regrole,
        'authenticated'::regrole
      )
  ),
  'functions created by the migration role are private by default'
);

select * from extensions.finish();
rollback;
