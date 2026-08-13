create table public.persona_avatar_models (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null unique references public.personas (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) between 10 and 500),
  original_filename text not null check (
    char_length(btrim(original_filename)) between 5 and 255
    and lower(right(btrim(original_filename), 4)) = '.glb'
  ),
  mime_type text not null default 'model/gltf-binary' check (mime_type = 'model/gltf-binary'),
  byte_size bigint not null check (byte_size between 12 and 52428800),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.persona_avatar_models is
  'One owner-uploaded GLB visualization per Persona; model data stays in a private Storage bucket.';

create index persona_avatar_models_owner_id_idx
on public.persona_avatar_models (owner_id);

alter table public.persona_avatar_models enable row level security;

revoke all on table public.persona_avatar_models from anon, authenticated;
grant select on table public.persona_avatar_models to authenticated;

create policy "Owners and eligible viewers can read persona avatar models"
on public.persona_avatar_models
for select
to authenticated
using (
  (select auth.uid()) = owner_id
  or (
    exists (
      select 1
      from public.personas
      join public.profiles on profiles.id = personas.owner_id
      where personas.id = persona_avatar_models.persona_id
        and personas.owner_id = persona_avatar_models.owner_id
        and personas.visibility = 'public'
        and personas.is_enabled = true
        and profiles.is_public = true
    )
    and not app_private.is_blocked_with_viewer(owner_id)
  )
);

create or replace function public.can_read_persona_avatar_model(p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.persona_avatar_models avatar_model
    join public.personas persona on persona.id = avatar_model.persona_id
    join public.profiles profile on profile.id = persona.owner_id
    where avatar_model.storage_path = p_storage_path
      and (
        avatar_model.owner_id = auth.uid()
        or (
          persona.visibility = 'public'
          and persona.is_enabled = true
          and profile.is_public = true
          and not app_private.is_blocked_with_viewer(avatar_model.owner_id)
        )
      )
  );
$$;

create or replace function public.register_persona_avatar_model(
  p_persona_id uuid,
  p_storage_path text,
  p_original_filename text,
  p_byte_size bigint
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  created_id uuid;
  previous_path text;
  stored_mime_type text;
  stored_byte_size bigint;
begin
  if viewer_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  perform 1
  from public.personas
  where id = p_persona_id and owner_id = viewer_id
  for update;

  if not found then
    raise exception 'PERSONA_NOT_FOUND' using errcode = '42501';
  end if;

  if p_storage_path not like viewer_id::text || '/' || p_persona_id::text || '/%'
    or lower(right(p_storage_path, 4)) <> '.glb'
    or char_length(p_storage_path) not between 10 and 500
    or char_length(btrim(coalesce(p_original_filename, ''))) not between 5 and 255
    or lower(right(btrim(p_original_filename), 4)) <> '.glb'
    or p_byte_size not between 12 and 52428800 then
    raise exception 'INVALID_PERSONA_AVATAR_MODEL' using errcode = '22023';
  end if;

  select
    metadata ->> 'mimetype',
    coalesce(
      nullif(metadata ->> 'size', '')::bigint,
      nullif(metadata ->> 'contentLength', '')::bigint
    )
  into stored_mime_type, stored_byte_size
  from storage.objects
  where bucket_id = 'persona-models'
    and name = p_storage_path
    and owner_id = viewer_id::text
  for update;

  if stored_mime_type is null
    or stored_byte_size is null
    or stored_mime_type <> 'model/gltf-binary'
    or stored_byte_size <> p_byte_size then
    raise exception 'PERSONA_AVATAR_STORAGE_OBJECT_MISMATCH' using errcode = '22023';
  end if;

  select storage_path into previous_path
  from public.persona_avatar_models
  where persona_id = p_persona_id
  for update;

  insert into public.persona_avatar_models (
    persona_id,
    owner_id,
    storage_path,
    original_filename,
    mime_type,
    byte_size
  ) values (
    p_persona_id,
    viewer_id,
    p_storage_path,
    btrim(p_original_filename),
    'model/gltf-binary',
    stored_byte_size
  )
  on conflict (persona_id) do update
  set storage_path = excluded.storage_path,
      original_filename = excluded.original_filename,
      mime_type = excluded.mime_type,
      byte_size = excluded.byte_size,
      updated_at = timezone('utc', now())
  where persona_avatar_models.owner_id = viewer_id
  returning id into created_id;

  if created_id is null then
    raise exception 'PERSONA_AVATAR_MODEL_OWNER_MISMATCH' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'id', created_id,
    'previousStoragePath', previous_path
  );
end;
$$;

create or replace function public.prepare_persona_avatar_model_deletion(
  p_persona_id uuid,
  p_model_id uuid
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  target public.persona_avatar_models%rowtype;
begin
  if viewer_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into target
  from public.persona_avatar_models
  where id = p_model_id
    and persona_id = p_persona_id
    and owner_id = viewer_id
  for update;

  if target.id is null then
    raise exception 'PERSONA_AVATAR_MODEL_NOT_FOUND' using errcode = '42501';
  end if;

  delete from public.persona_avatar_models
  where id = target.id;

  return target.storage_path;
end;
$$;

create or replace function public.delete_persona(p_persona_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
begin
  if viewer_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  perform 1 from public.profiles where id = viewer_id for update;
  perform 1 from public.personas
  where id = p_persona_id and owner_id = viewer_id
  for update;

  if not found then
    raise exception 'PERSONA_NOT_FOUND' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.persona_assets
    where persona_id = p_persona_id
  ) then
    raise exception 'PERSONA_HAS_ASSETS' using errcode = '55000';
  end if;
  if exists (
    select 1 from public.persona_avatar_models
    where persona_id = p_persona_id
  ) then
    raise exception 'PERSONA_HAS_AVATAR_MODEL' using errcode = '55000';
  end if;

  delete from public.personas
  where id = p_persona_id and owner_id = viewer_id;
end;
$$;

revoke all on function public.can_read_persona_avatar_model(text) from public, anon, authenticated;
revoke all on function public.register_persona_avatar_model(uuid, text, text, bigint) from public, anon, authenticated;
revoke all on function public.prepare_persona_avatar_model_deletion(uuid, uuid) from public, anon, authenticated;

grant execute on function public.can_read_persona_avatar_model(text) to authenticated;
grant execute on function public.register_persona_avatar_model(uuid, text, text, bigint) to authenticated;
grant execute on function public.prepare_persona_avatar_model_deletion(uuid, uuid) to authenticated;

drop trigger if exists set_persona_avatar_models_updated_at on public.persona_avatar_models;
create trigger set_persona_avatar_models_updated_at
before update on public.persona_avatar_models
for each row execute procedure public.set_profile_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('persona-models', 'persona-models', false, 52428800, array['model/gltf-binary'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Persona owners can upload avatar models"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'persona-models'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2] in (
    select id::text from public.personas where owner_id = (select auth.uid())
  )
  and lower(right(name, 4)) = '.glb'
);

create policy "Eligible users can read persona avatar models"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'persona-models'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.can_read_persona_avatar_model(name)
  )
);

create policy "Persona owners can delete orphan avatar models"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'persona-models'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (
    select 1 from public.persona_avatar_models
    where persona_avatar_models.storage_path = name
  )
);
