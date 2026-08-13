update storage.buckets
set file_size_limit = 52428800
where id = 'persona-assets';

alter table public.persona_assets
drop constraint persona_assets_byte_size_check,
add constraint persona_assets_byte_size_check check (byte_size between 1 and 52428800);

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
  stored_mime_type text;
  stored_byte_size bigint;
begin
  if viewer_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.personas
    where id = p_persona_id and owner_id = viewer_id
  ) then
    raise exception 'PERSONA_NOT_FOUND' using errcode = '42501';
  end if;

  if p_storage_path not like viewer_id::text || '/' || p_persona_id::text || '/%'
    or p_mime_type not in ('image/jpeg', 'image/png', 'image/webp')
    or p_byte_size not between 1 and 52428800
    or char_length(coalesce(p_user_description, '')) > 500 then
    raise exception 'INVALID_PERSONA_ASSET' using errcode = '22023';
  end if;

  select
    metadata ->> 'mimetype',
    coalesce(
      nullif(metadata ->> 'size', '')::bigint,
      nullif(metadata ->> 'contentLength', '')::bigint
    )
  into stored_mime_type, stored_byte_size
  from storage.objects
  where bucket_id = 'persona-assets'
    and name = p_storage_path
    and owner_id = viewer_id::text
  for update;

  if stored_mime_type is null
    or stored_byte_size is null
    or stored_mime_type <> p_mime_type
    or stored_byte_size <> p_byte_size then
    raise exception 'PERSONA_STORAGE_OBJECT_MISMATCH' using errcode = '22023';
  end if;

  insert into public.persona_assets (
    persona_id, owner_id, storage_path, mime_type, byte_size, user_description
  ) values (
    p_persona_id,
    viewer_id,
    p_storage_path,
    stored_mime_type,
    stored_byte_size::integer,
    nullif(btrim(p_user_description), '')
  )
  returning id into created_id;

  return created_id;
end;
$$;
