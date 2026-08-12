do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_campus_length'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_campus_length
      check (campus is null or char_length(campus) <= 80);
  end if;
end
$$;
