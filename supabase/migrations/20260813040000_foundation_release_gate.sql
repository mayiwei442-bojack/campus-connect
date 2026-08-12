do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;

create index if not exists skills_created_by_idx
on public.skills (created_by)
where created_by is not null;

-- Supabase no longer auto-exposes new public tables. Keep the current tables
-- explicit and make future migrations opt in to Data API privileges.
revoke all on table public.profiles from anon;
revoke all on table public.skills from anon;
revoke all on table public.profile_skills from anon;

grant select on table public.profiles to authenticated;
grant select on table public.skills to authenticated;
grant select on table public.profile_skills to authenticated;

alter default privileges in schema public
revoke all on tables from anon, authenticated;

alter default privileges in schema public
revoke execute on functions from public;
