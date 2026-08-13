-- Remove the unpublished personal avatar-model experiment from shared environments.
-- Model files must be removed through the Storage API before this migration runs.

drop policy if exists "Eligible users can read persona avatar models"
  on storage.objects;

drop policy if exists "Persona owners can delete orphan avatar models"
  on storage.objects;

drop policy if exists "Persona owners can upload avatar models"
  on storage.objects;

drop function if exists public.prepare_persona_avatar_model_deletion(uuid, uuid);
drop function if exists public.register_persona_avatar_model(uuid, text, text, bigint);

drop table if exists public.persona_avatar_models;
