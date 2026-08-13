drop policy if exists "Eligible users can read persona avatar models" on storage.objects;

create policy "Eligible users can read persona avatar models"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'persona-models'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (
      select 1
      from public.persona_avatar_models
      where persona_avatar_models.storage_path = name
    )
  )
);

revoke all on function public.can_read_persona_avatar_model(text) from public, anon, authenticated;
drop function public.can_read_persona_avatar_model(text);
