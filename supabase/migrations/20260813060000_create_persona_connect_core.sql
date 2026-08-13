do $$
begin
  create type public.persona_visibility as enum ('private', 'public');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.persona_asset_status as enum ('uploaded', 'analyzing', 'ready', 'failed');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.persona_entry_kind as enum ('fact', 'preference', 'opinion', 'experience', 'boundary');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.persona_entry_status as enum ('draft', 'confirmed', 'rejected', 'replaced');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.persona_question_topic_kind as enum (
    'background',
    'experience',
    'preference',
    'availability',
    'learning',
    'collaboration',
    'boundary',
    'other'
  );
exception
  when duplicate_object then null;
end
$$;

create table public.personas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  slot smallint not null check (slot between 1 and 3),
  name text not null check (char_length(btrim(name)) between 2 and 40),
  topic text not null check (char_length(btrim(topic)) between 2 and 80),
  summary text check (summary is null or char_length(summary) <= 500),
  visibility public.persona_visibility not null default 'private',
  is_enabled boolean not null default false,
  allow_matching boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (owner_id, slot)
);

create table public.persona_assets (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.personas (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) between 10 and 500),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size integer not null check (byte_size between 1 and 10485760),
  user_description text check (user_description is null or char_length(user_description) <= 500),
  is_visible boolean not null default false,
  analysis_status public.persona_asset_status not null default 'uploaded',
  analysis_error text check (analysis_error is null or char_length(analysis_error) <= 500),
  model_name text check (model_name is null or char_length(model_name) <= 100),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index persona_assets_persona_id_idx on public.persona_assets (persona_id);
create index persona_assets_owner_id_idx on public.persona_assets (owner_id);

create table public.persona_entries (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.personas (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  source_asset_id uuid references public.persona_assets (id) on delete set null,
  kind public.persona_entry_kind not null,
  knowledge_key text not null check (char_length(btrim(knowledge_key)) between 2 and 80),
  content text not null check (char_length(btrim(content)) between 1 and 1000),
  status public.persona_entry_status not null default 'draft',
  confirmed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index persona_entries_persona_status_idx on public.persona_entries (persona_id, status);
create index persona_entries_owner_id_idx on public.persona_entries (owner_id);
create index persona_entries_source_asset_id_idx on public.persona_entries (source_asset_id);
create unique index persona_entries_current_knowledge_key_key
on public.persona_entries (persona_id, lower(btrim(knowledge_key)))
where status = 'confirmed';

create table public.persona_question_topics (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.personas (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  topic_key text not null check (char_length(btrim(topic_key)) between 2 and 80),
  topic_label text not null check (char_length(btrim(topic_label)) between 2 and 80),
  question_count integer not null default 1 check (question_count > 0),
  created_at timestamptz not null default timezone('utc', now()),
  unique (persona_id, topic_key)
);

create index persona_question_topics_owner_id_idx on public.persona_question_topics (owner_id);

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  check (blocker_id <> blocked_id),
  unique (blocker_id, blocked_id)
);

create index blocks_blocked_id_idx on public.blocks (blocked_id);

comment on table public.personas is 'Owner-authored interest or capability facets; at most three slots per profile.';
comment on table public.persona_assets is 'Private image sources and analysis state. Model output is never authoritative here.';
comment on table public.persona_entries is 'Persona knowledge drafts and explicitly confirmed current entries.';
comment on table public.persona_question_topics is 'Anonymous aggregate topics only; raw stranger questions and conversations are not stored.';
comment on table public.blocks is 'Private directional blocks used by deterministic recommendation and contact filters.';

alter table public.personas enable row level security;
alter table public.persona_assets enable row level security;
alter table public.persona_entries enable row level security;
alter table public.persona_question_topics enable row level security;
alter table public.blocks enable row level security;

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to authenticated;

create or replace function app_private.is_blocked_with_viewer(p_other_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is null or exists (
    select 1
    from public.blocks
    where (blocker_id = auth.uid() and blocked_id = p_other_profile_id)
       or (blocker_id = p_other_profile_id and blocked_id = auth.uid())
  );
$$;

revoke all on function app_private.is_blocked_with_viewer(uuid) from public, anon, authenticated;
grant execute on function app_private.is_blocked_with_viewer(uuid) to authenticated;

revoke all on table public.personas from anon, authenticated;
revoke all on table public.persona_assets from anon, authenticated;
revoke all on table public.persona_entries from anon, authenticated;
revoke all on table public.persona_question_topics from anon, authenticated;
revoke all on table public.blocks from anon, authenticated;

grant select on table public.personas to authenticated;
grant update (name, topic, summary, visibility, is_enabled, allow_matching, updated_at) on table public.personas to authenticated;
grant delete on table public.personas to authenticated;

grant select on table public.persona_assets to authenticated;
grant update (user_description, is_visible, updated_at) on table public.persona_assets to authenticated;
grant delete on table public.persona_assets to authenticated;

grant select on table public.persona_entries to authenticated;
grant insert (persona_id, owner_id, source_asset_id, kind, knowledge_key, content) on table public.persona_entries to authenticated;
grant delete on table public.persona_entries to authenticated;

grant select on table public.persona_question_topics to authenticated;

grant select, insert, delete on table public.blocks to authenticated;

create policy "Owners and eligible viewers can read personas"
on public.personas
for select
to authenticated
using (
  (select auth.uid()) = owner_id
  or (
    visibility = 'public'
    and is_enabled = true
    and not app_private.is_blocked_with_viewer(owner_id)
    and exists (
      select 1
      from public.profiles
      where profiles.id = personas.owner_id
        and profiles.is_public = true
    )
  )
);

create policy "Owners can update personas"
on public.personas
for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Owners can delete personas"
on public.personas
for delete
to authenticated
using ((select auth.uid()) = owner_id);

create policy "Owners can read persona asset metadata"
on public.persona_assets
for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "Owners can update persona asset metadata"
on public.persona_assets
for update
to authenticated
using ((select auth.uid()) = owner_id)
with check (
  (select auth.uid()) = owner_id
  and exists (
    select 1 from public.personas
    where personas.id = persona_assets.persona_id
      and personas.owner_id = (select auth.uid())
  )
);

create policy "Owners can delete persona assets"
on public.persona_assets
for delete
to authenticated
using ((select auth.uid()) = owner_id);

create policy "Owners and eligible viewers can read persona entries"
on public.persona_entries
for select
to authenticated
using (
  (select auth.uid()) = owner_id
  or (
    status = 'confirmed'
    and not app_private.is_blocked_with_viewer(owner_id)
    and exists (
      select 1
      from public.personas
      join public.profiles on profiles.id = personas.owner_id
      where personas.id = persona_entries.persona_id
        and personas.visibility = 'public'
        and personas.is_enabled = true
        and profiles.is_public = true
    )
  )
);

create policy "Owners can create persona entry drafts"
on public.persona_entries
for insert
to authenticated
with check (
  (select auth.uid()) = owner_id
  and status = 'draft'
  and confirmed_at is null
  and exists (
    select 1 from public.personas
    where personas.id = persona_entries.persona_id
      and personas.owner_id = (select auth.uid())
  )
  and (
    source_asset_id is null
    or exists (
      select 1 from public.persona_assets
      where persona_assets.id = persona_entries.source_asset_id
        and persona_assets.persona_id = persona_entries.persona_id
        and persona_assets.owner_id = (select auth.uid())
    )
  )
);

create policy "Owners can delete persona entries"
on public.persona_entries
for delete
to authenticated
using ((select auth.uid()) = owner_id);

create policy "Owners can read anonymous persona topic aggregates"
on public.persona_question_topics
for select
to authenticated
using (
  (select auth.uid()) = owner_id
  and question_count >= 3
);

create policy "Users can read their own blocks"
on public.blocks
for select
to authenticated
using ((select auth.uid()) = blocker_id);

create policy "Users can create their own blocks"
on public.blocks
for insert
to authenticated
with check ((select auth.uid()) = blocker_id);

create policy "Users can delete their own blocks"
on public.blocks
for delete
to authenticated
using ((select auth.uid()) = blocker_id);

drop policy if exists "Authenticated users can read visible profiles" on public.profiles;

create policy "Authenticated users can read visible profiles"
on public.profiles
for select
to authenticated
using (
  (select auth.uid()) = id
  or (
    is_public = true
    and not app_private.is_blocked_with_viewer(id)
  )
);

drop policy if exists "Users can read eligible profile skills" on public.profile_skills;

create policy "Users can read eligible profile skills"
on public.profile_skills
for select
to authenticated
using (
  (select auth.uid()) = profile_id
  or (
    is_public = true
    and not app_private.is_blocked_with_viewer(profile_id)
    and exists (
      select 1
      from public.profiles
      where profiles.id = profile_skills.profile_id
        and profiles.is_public = true
    )
  )
);

create or replace function public.create_persona(
  p_name text,
  p_topic text,
  p_summary text default null,
  p_visibility public.persona_visibility default 'private'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  next_slot smallint;
  created_id uuid;
begin
  if viewer_id is null then
    raise exception 'authentication_required';
  end if;

  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 40
    or char_length(btrim(coalesce(p_topic, ''))) not between 2 and 80
    or char_length(coalesce(p_summary, '')) > 500 then
    raise exception 'invalid_persona';
  end if;

  perform 1 from public.profiles where id = viewer_id for update;

  select candidate
  into next_slot
  from generate_series(1, 3) as candidate
  where not exists (
    select 1 from public.personas
    where owner_id = viewer_id and slot = candidate
  )
  order by candidate
  limit 1;

  if next_slot is null then
    raise exception 'persona_limit_reached';
  end if;

  insert into public.personas (owner_id, slot, name, topic, summary, visibility)
  values (viewer_id, next_slot, btrim(p_name), btrim(p_topic), nullif(btrim(p_summary), ''), p_visibility)
  returning id into created_id;

  return created_id;
end;
$$;

create or replace function public.register_persona_asset(
  p_persona_id uuid,
  p_storage_path text,
  p_mime_type text,
  p_byte_size integer,
  p_user_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  created_id uuid;
begin
  if viewer_id is null then
    raise exception 'authentication_required';
  end if;

  if not exists (
    select 1 from public.personas
    where id = p_persona_id and owner_id = viewer_id
  ) then
    raise exception 'persona_not_found';
  end if;

  if p_storage_path not like viewer_id::text || '/' || p_persona_id::text || '/%'
    or p_mime_type not in ('image/jpeg', 'image/png', 'image/webp')
    or p_byte_size not between 1 and 10485760
    or char_length(coalesce(p_user_description, '')) > 500 then
    raise exception 'invalid_persona_asset';
  end if;

  insert into public.persona_assets (
    persona_id, owner_id, storage_path, mime_type, byte_size, user_description
  ) values (
    p_persona_id,
    viewer_id,
    p_storage_path,
    p_mime_type,
    p_byte_size,
    nullif(btrim(p_user_description), '')
  )
  returning id into created_id;

  return created_id;
end;
$$;

create or replace function public.confirm_persona_entry(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  target public.persona_entries%rowtype;
begin
  if viewer_id is null then
    raise exception 'authentication_required';
  end if;

  select * into target
  from public.persona_entries
  where id = p_entry_id and owner_id = viewer_id
  for update;

  if target.id is null or target.status <> 'draft' then
    raise exception 'persona_entry_not_confirmable';
  end if;

  perform 1 from public.personas where id = target.persona_id for update;

  update public.persona_entries
  set status = 'replaced', updated_at = timezone('utc', now())
  where persona_id = target.persona_id
    and lower(btrim(knowledge_key)) = lower(btrim(target.knowledge_key))
    and status = 'confirmed';

  update public.persona_entries
  set status = 'confirmed', confirmed_at = timezone('utc', now()), updated_at = timezone('utc', now())
  where id = target.id;
end;
$$;

create or replace function public.reject_persona_entry(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
begin
  if viewer_id is null then
    raise exception 'authentication_required';
  end if;

  update public.persona_entries
  set status = 'rejected', updated_at = timezone('utc', now())
  where id = p_entry_id
    and owner_id = viewer_id
    and status = 'draft';

  if not found then
    raise exception 'persona_entry_not_rejectable';
  end if;
end;
$$;

create or replace function public.record_persona_question_topic(
  p_persona_id uuid,
  p_topic public.persona_question_topic_kind
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  persona_owner uuid;
  normalized_topic text := p_topic::text;
  safe_label text;
begin
  if viewer_id is null then
    raise exception 'authentication_required';
  end if;

  safe_label := case p_topic
    when 'background' then '背景经历'
    when 'experience' then '相关经验'
    when 'preference' then '偏好与风格'
    when 'availability' then '时间安排'
    when 'learning' then '学习方向'
    when 'collaboration' then '合作方式'
    when 'boundary' then '边界与禁区'
    else '其他主题'
  end;

  select personas.owner_id into persona_owner
  from public.personas
  join public.profiles on profiles.id = personas.owner_id
  where personas.id = p_persona_id
    and personas.visibility = 'public'
    and personas.is_enabled = true
    and profiles.is_public = true;

  if persona_owner is null or persona_owner = viewer_id or exists (
    select 1 from public.blocks
    where (blocker_id = viewer_id and blocked_id = persona_owner)
       or (blocker_id = persona_owner and blocked_id = viewer_id)
  ) then
    raise exception 'persona_not_found';
  end if;

  insert into public.persona_question_topics (
    persona_id, owner_id, topic_key, topic_label
  ) values (
    p_persona_id, persona_owner, normalized_topic, safe_label
  )
  on conflict (persona_id, topic_key) do update
  set question_count = persona_question_topics.question_count + 1,
      topic_label = excluded.topic_label;
end;
$$;

create or replace function public.can_read_persona_asset(p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.persona_assets
    join public.personas on personas.id = persona_assets.persona_id
    join public.profiles on profiles.id = personas.owner_id
    where persona_assets.storage_path = p_storage_path
      and (
        persona_assets.owner_id = auth.uid()
        or (
          persona_assets.is_visible = true
          and personas.visibility = 'public'
          and personas.is_enabled = true
          and profiles.is_public = true
          and not exists (
            select 1 from public.blocks
            where (blocker_id = auth.uid() and blocked_id = personas.owner_id)
               or (blocker_id = personas.owner_id and blocked_id = auth.uid())
          )
        )
      )
  );
$$;

create or replace function public.get_connect_candidates(
  p_terms text[] default array[]::text[],
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_limit integer default 24
)
returns table (
  profile_id uuid,
  nickname text,
  bio text,
  matched_skills jsonb,
  persona_evidence jsonb,
  has_time_conflict boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  terms text[];
begin
  if viewer_id is null then
    raise exception 'authentication_required';
  end if;

  if p_starts_at is not null and p_ends_at is not null and p_ends_at <= p_starts_at then
    raise exception 'invalid_time_window';
  end if;

  select coalesce(array_agg(term), array[]::text[])
  into terms
  from (
    select distinct lower(btrim(value)) as term
    from unnest(coalesce(p_terms, array[]::text[])) as value
    where char_length(btrim(value)) between 2 and 80
    limit 12
  ) normalized_terms;

  return query
  select
    candidate.id,
    candidate.nickname,
    candidate.bio,
    skill_matches.items,
    persona_matches.items,
    case
      when p_starts_at is null or p_ends_at is null then false
      else exists (
        select 1
        from public.activity_participations participation
        join public.activities activity on activity.id = participation.activity_id
        where participation.profile_id = candidate.id
          and participation.status = 'joined'
          and activity.status in ('scheduled', 'active')
          and activity.starts_at is not null
          and activity.starts_at < p_ends_at
          and coalesce(activity.ends_at, activity.starts_at + interval '2 hours') > p_starts_at
      )
    end as has_time_conflict
  from public.profiles candidate
  cross join lateral (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'name', skills.name,
          'kind', skills.kind,
          'rating', profile_skills.self_rating,
          'note', profile_skills.note
        ) order by profile_skills.self_rating desc nulls last, skills.name
      ),
      '[]'::jsonb
    ) as items
    from public.profile_skills
    join public.skills on skills.id = profile_skills.skill_id
    where profile_skills.profile_id = candidate.id
      and profile_skills.is_public = true
      and profile_skills.allow_contact = true
      and profile_skills.allow_matching = true
      and (
        cardinality(terms) = 0
        or exists (
          select 1 from unnest(terms) as term
          where skills.normalized_name like '%' || term || '%'
             or term like '%' || skills.normalized_name || '%'
             or lower(coalesce(profile_skills.note, '')) like '%' || term || '%'
        )
      )
  ) skill_matches
  cross join lateral (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'personaId', personas.id,
          'personaName', personas.name,
          'kind', persona_entries.kind,
          'key', persona_entries.knowledge_key,
          'content', persona_entries.content
        ) order by persona_entries.confirmed_at desc
      ),
      '[]'::jsonb
    ) as items
    from public.personas
    join public.persona_entries on persona_entries.persona_id = personas.id
    where personas.owner_id = candidate.id
      and personas.visibility = 'public'
      and personas.is_enabled = true
      and personas.allow_matching = true
      and persona_entries.status = 'confirmed'
      and (
        cardinality(terms) = 0
        or exists (
          select 1 from unnest(terms) as term
          where lower(persona_entries.knowledge_key) like '%' || term || '%'
             or lower(persona_entries.content) like '%' || term || '%'
             or lower(personas.topic) like '%' || term || '%'
        )
      )
  ) persona_matches
  where candidate.id <> viewer_id
    and candidate.is_public = true
    and candidate.allow_matching = true
    and not exists (
      select 1 from public.blocks
      where (blocker_id = viewer_id and blocked_id = candidate.id)
         or (blocker_id = candidate.id and blocked_id = viewer_id)
    )
    and (
      cardinality(terms) = 0
      or jsonb_array_length(skill_matches.items) > 0
      or jsonb_array_length(persona_matches.items) > 0
      or exists (
        select 1 from unnest(terms) as term
        where lower(coalesce(candidate.bio, '')) like '%' || term || '%'
      )
    )
  order by 6, candidate.updated_at desc, candidate.id
  limit least(greatest(coalesce(p_limit, 24), 1), 50);
end;
$$;

revoke all on function public.create_persona(text, text, text, public.persona_visibility) from public, anon, authenticated;
revoke all on function public.register_persona_asset(uuid, text, text, integer, text) from public, anon, authenticated;
revoke all on function public.confirm_persona_entry(uuid) from public, anon, authenticated;
revoke all on function public.reject_persona_entry(uuid) from public, anon, authenticated;
revoke all on function public.record_persona_question_topic(uuid, public.persona_question_topic_kind) from public, anon, authenticated;
revoke all on function public.can_read_persona_asset(text) from public, anon, authenticated;
revoke all on function public.get_connect_candidates(text[], timestamptz, timestamptz, integer) from public, anon, authenticated;

grant execute on function public.create_persona(text, text, text, public.persona_visibility) to authenticated;
grant execute on function public.register_persona_asset(uuid, text, text, integer, text) to authenticated;
grant execute on function public.confirm_persona_entry(uuid) to authenticated;
grant execute on function public.reject_persona_entry(uuid) to authenticated;
grant execute on function public.record_persona_question_topic(uuid, public.persona_question_topic_kind) to authenticated;
grant execute on function public.can_read_persona_asset(text) to authenticated;
grant execute on function public.get_connect_candidates(text[], timestamptz, timestamptz, integer) to authenticated;

drop trigger if exists set_personas_updated_at on public.personas;
create trigger set_personas_updated_at
before update on public.personas
for each row execute procedure public.set_profile_updated_at();

drop trigger if exists set_persona_assets_updated_at on public.persona_assets;
create trigger set_persona_assets_updated_at
before update on public.persona_assets
for each row execute procedure public.set_profile_updated_at();

drop trigger if exists set_persona_entries_updated_at on public.persona_entries;
create trigger set_persona_entries_updated_at
before update on public.persona_entries
for each row execute procedure public.set_profile_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'persona-assets',
  'persona-assets',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Persona owners can upload their assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'persona-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2] in (
    select id::text from public.personas where owner_id = (select auth.uid())
  )
);

create policy "Eligible users can read persona assets"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'persona-assets'
  and public.can_read_persona_asset(name)
);

create policy "Persona owners can delete unreferenced assets"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'persona-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (
    select 1 from public.persona_entries
    join public.persona_assets on persona_assets.id = persona_entries.source_asset_id
    where persona_assets.storage_path = name
      and persona_entries.status = 'confirmed'
  )
);
