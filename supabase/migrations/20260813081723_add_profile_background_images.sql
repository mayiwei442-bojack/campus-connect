alter table public.profiles
add column if not exists background_path text check (
  background_path is null or char_length(background_path) between 10 and 500
);

comment on column public.profiles.background_path is
  'Private Storage path for the owner-selected profile card background image.';

revoke update (background_path) on table public.profiles from authenticated;

create or replace function public.set_profile_background(p_storage_path text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  previous_path text;
  stored_mime_type text;
  stored_byte_size bigint;
begin
  if viewer_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if p_storage_path not like viewer_id::text || '/%'
    or char_length(p_storage_path) not between 10 and 500
    or lower(regexp_replace(p_storage_path, '^.*\.', '')) not in ('jpg', 'jpeg', 'png', 'webp') then
    raise exception 'INVALID_PROFILE_BACKGROUND_PATH' using errcode = '22023';
  end if;

  select
    metadata ->> 'mimetype',
    coalesce(
      nullif(metadata ->> 'size', '')::bigint,
      nullif(metadata ->> 'contentLength', '')::bigint
    )
  into stored_mime_type, stored_byte_size
  from storage.objects
  where bucket_id = 'profile-backgrounds'
    and name = p_storage_path
    and owner_id = viewer_id::text
  for update;

  if stored_mime_type is null
    or stored_byte_size is null
    or stored_mime_type not in ('image/jpeg', 'image/png', 'image/webp')
    or stored_byte_size not between 1 and 6291456 then
    raise exception 'PROFILE_BACKGROUND_STORAGE_OBJECT_MISMATCH' using errcode = '22023';
  end if;

  select background_path into previous_path
  from public.profiles
  where id = viewer_id
  for update;

  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = '42501';
  end if;

  update public.profiles
  set background_path = p_storage_path
  where id = viewer_id;

  return previous_path;
end;
$$;

revoke all on function public.set_profile_background(text) from public, anon, authenticated;
grant execute on function public.set_profile_background(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-backgrounds',
  'profile-backgrounds',
  false,
  6291456,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Profile owners can upload background images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-backgrounds'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and storage.extension(name) in ('jpg', 'jpeg', 'png', 'webp')
);

create policy "Owners and eligible viewers can read profile backgrounds"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'profile-backgrounds'
  and storage.allow_any_operation(array['object.get_authenticated_info', 'object.get_authenticated'])
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (
      select 1
      from public.profiles
      where profiles.id::text = (storage.foldername(name))[1]
        and profiles.is_public = true
        and not app_private.is_blocked_with_viewer(profiles.id)
    )
  )
);

create policy "Profile owners can delete background images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-backgrounds'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
