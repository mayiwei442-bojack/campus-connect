do $$
begin
  create type public.skill_kind as enum ('ability', 'interest');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 40),
  normalized_name text generated always as (lower(btrim(name))) stored,
  kind public.skill_kind not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists skills_kind_normalized_name_key
on public.skills (kind, normalized_name);

create table if not exists public.profile_skills (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete restrict,
  self_rating smallint check (self_rating is null or self_rating between 1 and 5),
  note text check (note is null or char_length(note) <= 160),
  is_public boolean not null default true,
  allow_contact boolean not null default true,
  allow_matching boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (profile_id, skill_id)
);

create index if not exists profile_skills_skill_id_idx
on public.profile_skills (skill_id);

comment on table public.skills is 'Shared normalized catalog for both abilities and interests.';
comment on table public.profile_skills is 'Owner-controlled profile relationship to a Skill, including contact and matching consent.';

alter table public.skills enable row level security;
alter table public.profile_skills enable row level security;

revoke all on table public.skills from anon, authenticated;
revoke all on table public.profile_skills from anon, authenticated;

grant select on table public.skills to authenticated;
grant insert (name, kind, created_by) on table public.skills to authenticated;

grant select on table public.profile_skills to authenticated;
grant insert (
  profile_id,
  skill_id,
  self_rating,
  note,
  is_public,
  allow_contact,
  allow_matching
) on table public.profile_skills to authenticated;
grant update (
  self_rating,
  note,
  is_public,
  allow_contact,
  allow_matching,
  updated_at
) on table public.profile_skills to authenticated;
grant delete on table public.profile_skills to authenticated;

drop policy if exists "Authenticated users can read skills" on public.skills;

create policy "Authenticated users can read skills"
on public.skills
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can create skills" on public.skills;

create policy "Authenticated users can create skills"
on public.skills
for insert
to authenticated
with check ((select auth.uid()) = created_by);

drop policy if exists "Users can read eligible profile skills" on public.profile_skills;

create policy "Users can read eligible profile skills"
on public.profile_skills
for select
to authenticated
using (
  (select auth.uid()) = profile_id
  or (
    is_public = true
    and exists (
      select 1
      from public.profiles
      where profiles.id = profile_skills.profile_id
        and profiles.is_public = true
    )
  )
);

drop policy if exists "Users can add their own profile skills" on public.profile_skills;

create policy "Users can add their own profile skills"
on public.profile_skills
for insert
to authenticated
with check ((select auth.uid()) = profile_id);

drop policy if exists "Users can update their own profile skills" on public.profile_skills;

create policy "Users can update their own profile skills"
on public.profile_skills
for update
to authenticated
using ((select auth.uid()) = profile_id)
with check ((select auth.uid()) = profile_id);

drop policy if exists "Users can delete their own profile skills" on public.profile_skills;

create policy "Users can delete their own profile skills"
on public.profile_skills
for delete
to authenticated
using ((select auth.uid()) = profile_id);

drop trigger if exists set_profile_skills_updated_at on public.profile_skills;

create trigger set_profile_skills_updated_at
before update on public.profile_skills
for each row execute procedure public.set_profile_updated_at();
