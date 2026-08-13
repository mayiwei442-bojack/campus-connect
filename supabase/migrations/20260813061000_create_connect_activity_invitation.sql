create or replace function public.create_activity_with_invitation(
  p_invitee_id uuid,
  p_place_id text,
  p_title text,
  p_description text default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_capacity integer default null,
  p_join_mode public.activity_join_mode default 'free'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  activity_id uuid;
begin
  if viewer_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if p_invitee_id = viewer_id or not exists (
    select 1
    from public.profiles
    where id = p_invitee_id
      and is_public = true
      and allow_matching = true
  ) or exists (
    select 1
    from public.blocks
    where (blocker_id = viewer_id and blocked_id = p_invitee_id)
       or (blocker_id = p_invitee_id and blocked_id = viewer_id)
  ) then
    raise exception 'INVITEE_NOT_ELIGIBLE' using errcode = '42501';
  end if;

  activity_id := public.create_activity(
    p_place_id,
    p_title,
    p_description,
    p_starts_at,
    p_ends_at,
    p_capacity,
    p_join_mode
  );

  perform public.create_activity_invitation(activity_id, p_invitee_id);
  return activity_id;
end;
$$;

revoke all on function public.create_activity_with_invitation(
  uuid, text, text, text, timestamptz, timestamptz, integer, public.activity_join_mode
) from public, anon, authenticated;

grant execute on function public.create_activity_with_invitation(
  uuid, text, text, text, timestamptz, timestamptz, integer, public.activity_join_mode
) to authenticated;
