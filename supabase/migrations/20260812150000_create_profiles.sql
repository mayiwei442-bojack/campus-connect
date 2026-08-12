create type public.app_role as enum ('user', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 24),
  avatar_path text,
  campus text,
  bio text check (bio is null or char_length(bio) <= 280),
  role public.app_role not null default 'user',
  is_public boolean not null default true,
  allow_stranger_messages boolean not null default true,
  allow_matching boolean not null default true,
  is_seed_user boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.profiles is 'Public-facing profile data for a Supabase Auth user.';
comment on column public.profiles.role is 'Server-authoritative application role; clients cannot update this column.';

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (
  nickname,
  avatar_path,
  campus,
  bio,
  is_public,
  allow_stranger_messages,
  allow_matching,
  updated_at
) on table public.profiles to authenticated;

create policy "Authenticated users can read visible profiles"
on public.profiles
for select
to authenticated
using (
  (select auth.uid()) = id
  or is_public = true
);

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create function public.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

revoke all on function public.set_profile_updated_at() from public, anon, authenticated;

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_profile_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  nickname_value text;
begin
  nickname_value := btrim(coalesce(new.raw_user_meta_data ->> 'nickname', ''));

  if char_length(nickname_value) < 2 or char_length(nickname_value) > 24 then
    nickname_value := '新同学-' || left(new.id::text, 6);
  end if;

  insert into public.profiles (id, nickname)
  values (new.id, nickname_value)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
