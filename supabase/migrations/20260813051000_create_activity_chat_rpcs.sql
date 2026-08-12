create or replace function public.promote_activity_waitlist(p_activity_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next_profile_id uuid;
  v_conversation_id uuid;
begin
  select profile_id
  into v_next_profile_id
  from public.activity_participations
  where activity_id = p_activity_id
    and status = 'waitlisted'
  order by queue_position, requested_at, id
  limit 1
  for update;

  if v_next_profile_id is null then
    return null;
  end if;

  update public.activity_participations
  set
    status = 'joined',
    queue_position = null,
    responded_at = coalesce(responded_at, timezone('utc', now())),
    joined_at = timezone('utc', now()),
    left_at = null
  where activity_id = p_activity_id
    and profile_id = v_next_profile_id;

  select id
  into v_conversation_id
  from public.conversations
  where activity_id = p_activity_id;

  insert into public.conversation_members (conversation_id, profile_id)
  values (v_conversation_id, v_next_profile_id)
  on conflict (conversation_id, profile_id) do update
  set
    joined_at = timezone('utc', now()),
    left_at = null;

  return v_next_profile_id;
end;
$$;

revoke all on function public.promote_activity_waitlist(uuid) from public, anon, authenticated;

create or replace function public.create_activity(
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
  v_actor_id uuid := (select auth.uid());
  v_activity_id uuid;
  v_conversation_id uuid;
begin
  if v_actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(p_title, ''))) not between 2 and 80 then
    raise exception 'INVALID_TITLE' using errcode = '22023';
  end if;

  if p_description is not null and char_length(btrim(p_description)) > 1000 then
    raise exception 'INVALID_DESCRIPTION' using errcode = '22023';
  end if;

  if p_capacity is not null and p_capacity < 1 then
    raise exception 'INVALID_CAPACITY' using errcode = '22023';
  end if;

  if p_starts_at is not null and p_ends_at is not null and p_ends_at <= p_starts_at then
    raise exception 'INVALID_TIME_RANGE' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.places
    where id = p_place_id
      and is_active = true
  ) then
    raise exception 'PLACE_NOT_FOUND' using errcode = '22023';
  end if;

  insert into public.activities (
    creator_id,
    place_id,
    title,
    description,
    starts_at,
    ends_at,
    capacity,
    join_mode,
    status
  )
  values (
    v_actor_id,
    p_place_id,
    btrim(p_title),
    nullif(btrim(coalesce(p_description, '')), ''),
    p_starts_at,
    p_ends_at,
    p_capacity,
    p_join_mode,
    case
      when p_starts_at is not null and p_starts_at > timezone('utc', now()) then 'scheduled'::public.activity_status
      else 'active'::public.activity_status
    end
  )
  returning id into v_activity_id;

  insert into public.activity_participations (
    activity_id,
    profile_id,
    status,
    responded_at,
    joined_at
  )
  values (
    v_activity_id,
    v_actor_id,
    'joined',
    timezone('utc', now()),
    timezone('utc', now())
  );

  insert into public.conversations (kind, activity_id, title)
  values ('activity', v_activity_id, btrim(p_title))
  returning id into v_conversation_id;

  insert into public.conversation_members (conversation_id, profile_id)
  values (v_conversation_id, v_actor_id);

  return v_activity_id;
end;
$$;

revoke all on function public.create_activity(text, text, text, timestamptz, timestamptz, integer, public.activity_join_mode) from public, anon;
grant execute on function public.create_activity(text, text, text, timestamptz, timestamptz, integer, public.activity_join_mode) to authenticated;

create or replace function public.join_activity(p_activity_id uuid)
returns public.activity_participation_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_activity public.activities%rowtype;
  v_existing_status public.activity_participation_status;
  v_next_status public.activity_participation_status;
  v_joined_count integer;
  v_queue_position bigint;
  v_conversation_id uuid;
begin
  if v_actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select *
  into v_activity
  from public.activities
  where id = p_activity_id
  for update;

  if not found or v_activity.status not in ('scheduled', 'active') then
    raise exception 'ACTIVITY_NOT_AVAILABLE' using errcode = '22023';
  end if;

  select status
  into v_existing_status
  from public.activity_participations
  where activity_id = p_activity_id
    and profile_id = v_actor_id
  for update;

  if found and v_existing_status in ('joined', 'pending', 'waitlisted') then
    return v_existing_status;
  end if;

  if v_activity.join_mode = 'approval' then
    v_next_status := 'pending';
  else
    select count(*)::integer
    into v_joined_count
    from public.activity_participations
    where activity_id = p_activity_id
      and status = 'joined';

    if v_activity.capacity is null or v_joined_count < v_activity.capacity then
      v_next_status := 'joined';
    else
      v_next_status := 'waitlisted';
      v_queue_position := nextval('public.activity_waitlist_queue_seq');
    end if;
  end if;

  insert into public.activity_participations (
    activity_id,
    profile_id,
    status,
    queue_position,
    requested_at,
    responded_at,
    joined_at,
    left_at
  )
  values (
    p_activity_id,
    v_actor_id,
    v_next_status,
    v_queue_position,
    timezone('utc', now()),
    case when v_next_status = 'pending' then null else timezone('utc', now()) end,
    case when v_next_status = 'joined' then timezone('utc', now()) else null end,
    null
  )
  on conflict (activity_id, profile_id) do update
  set
    status = excluded.status,
    queue_position = excluded.queue_position,
    requested_at = excluded.requested_at,
    responded_at = excluded.responded_at,
    joined_at = excluded.joined_at,
    left_at = null;

  if v_next_status = 'joined' then
    select id
    into v_conversation_id
    from public.conversations
    where activity_id = p_activity_id;

    insert into public.conversation_members (conversation_id, profile_id)
    values (v_conversation_id, v_actor_id)
    on conflict (conversation_id, profile_id) do update
    set
      joined_at = timezone('utc', now()),
      left_at = null;
  end if;

  return v_next_status;
end;
$$;

revoke all on function public.join_activity(uuid) from public, anon;
grant execute on function public.join_activity(uuid) to authenticated;

create or replace function public.respond_activity_join_request(
  p_activity_id uuid,
  p_profile_id uuid,
  p_approve boolean
)
returns public.activity_participation_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_activity public.activities%rowtype;
  v_next_status public.activity_participation_status;
  v_joined_count integer;
  v_queue_position bigint;
  v_conversation_id uuid;
begin
  if v_actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select *
  into v_activity
  from public.activities
  where id = p_activity_id
  for update;

  if not found or v_activity.creator_id <> v_actor_id then
    raise exception 'ACTIVITY_OWNER_REQUIRED' using errcode = '42501';
  end if;

  if v_activity.status not in ('scheduled', 'active') then
    raise exception 'ACTIVITY_NOT_AVAILABLE' using errcode = '22023';
  end if;

  perform 1
  from public.activity_participations
  where activity_id = p_activity_id
    and profile_id = p_profile_id
    and status = 'pending'
  for update;

  if not found then
    raise exception 'PENDING_REQUEST_NOT_FOUND' using errcode = '22023';
  end if;

  if not p_approve then
    update public.activity_participations
    set
      status = 'rejected',
      queue_position = null,
      responded_at = timezone('utc', now()),
      joined_at = null,
      left_at = null
    where activity_id = p_activity_id
      and profile_id = p_profile_id;

    return 'rejected'::public.activity_participation_status;
  end if;

  select count(*)::integer
  into v_joined_count
  from public.activity_participations
  where activity_id = p_activity_id
    and status = 'joined';

  if v_activity.capacity is null or v_joined_count < v_activity.capacity then
    v_next_status := 'joined';
  else
    v_next_status := 'waitlisted';
    v_queue_position := nextval('public.activity_waitlist_queue_seq');
  end if;

  update public.activity_participations
  set
    status = v_next_status,
    queue_position = v_queue_position,
    responded_at = timezone('utc', now()),
    joined_at = case when v_next_status = 'joined' then timezone('utc', now()) else null end,
    left_at = null
  where activity_id = p_activity_id
    and profile_id = p_profile_id;

  if v_next_status = 'joined' then
    select id
    into v_conversation_id
    from public.conversations
    where activity_id = p_activity_id;

    insert into public.conversation_members (conversation_id, profile_id)
    values (v_conversation_id, p_profile_id)
    on conflict (conversation_id, profile_id) do update
    set
      joined_at = timezone('utc', now()),
      left_at = null;
  end if;

  return v_next_status;
end;
$$;

revoke all on function public.respond_activity_join_request(uuid, uuid, boolean) from public, anon;
grant execute on function public.respond_activity_join_request(uuid, uuid, boolean) to authenticated;

create or replace function public.leave_activity(p_activity_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_activity public.activities%rowtype;
  v_previous_status public.activity_participation_status;
  v_conversation_id uuid;
  v_promoted_profile_id uuid;
begin
  if v_actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select *
  into v_activity
  from public.activities
  where id = p_activity_id
  for update;

  if not found then
    raise exception 'ACTIVITY_NOT_FOUND' using errcode = '22023';
  end if;

  if v_activity.creator_id = v_actor_id then
    raise exception 'CREATOR_MUST_END_ACTIVITY' using errcode = '22023';
  end if;

  select status
  into v_previous_status
  from public.activity_participations
  where activity_id = p_activity_id
    and profile_id = v_actor_id
    and status in ('pending', 'joined', 'waitlisted')
  for update;

  if not found then
    raise exception 'ACTIVE_PARTICIPATION_NOT_FOUND' using errcode = '22023';
  end if;

  update public.activity_participations
  set
    status = 'left',
    queue_position = null,
    left_at = timezone('utc', now())
  where activity_id = p_activity_id
    and profile_id = v_actor_id;

  select id
  into v_conversation_id
  from public.conversations
  where activity_id = p_activity_id;

  update public.conversation_members
  set left_at = timezone('utc', now())
  where conversation_id = v_conversation_id
    and profile_id = v_actor_id
    and left_at is null;

  if v_previous_status = 'joined' and v_activity.status in ('scheduled', 'active') then
    v_promoted_profile_id := public.promote_activity_waitlist(p_activity_id);
  end if;

  return v_promoted_profile_id;
end;
$$;

revoke all on function public.leave_activity(uuid) from public, anon;
grant execute on function public.leave_activity(uuid) to authenticated;

create or replace function public.remove_activity_member(
  p_activity_id uuid,
  p_profile_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_activity public.activities%rowtype;
  v_previous_status public.activity_participation_status;
  v_conversation_id uuid;
  v_promoted_profile_id uuid;
begin
  if v_actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select *
  into v_activity
  from public.activities
  where id = p_activity_id
  for update;

  if not found or v_activity.creator_id <> v_actor_id then
    raise exception 'ACTIVITY_OWNER_REQUIRED' using errcode = '42501';
  end if;

  if p_profile_id = v_actor_id then
    raise exception 'CREATOR_CANNOT_BE_REMOVED' using errcode = '22023';
  end if;

  select status
  into v_previous_status
  from public.activity_participations
  where activity_id = p_activity_id
    and profile_id = p_profile_id
    and status in ('pending', 'joined', 'waitlisted')
  for update;

  if not found then
    raise exception 'ACTIVE_PARTICIPATION_NOT_FOUND' using errcode = '22023';
  end if;

  update public.activity_participations
  set
    status = 'removed',
    queue_position = null,
    left_at = case when v_previous_status = 'joined' then timezone('utc', now()) else left_at end
  where activity_id = p_activity_id
    and profile_id = p_profile_id;

  select id
  into v_conversation_id
  from public.conversations
  where activity_id = p_activity_id;

  update public.conversation_members
  set left_at = timezone('utc', now())
  where conversation_id = v_conversation_id
    and profile_id = p_profile_id
    and left_at is null;

  if v_previous_status = 'joined' and v_activity.status in ('scheduled', 'active') then
    v_promoted_profile_id := public.promote_activity_waitlist(p_activity_id);
  end if;

  return v_promoted_profile_id;
end;
$$;

revoke all on function public.remove_activity_member(uuid, uuid) from public, anon;
grant execute on function public.remove_activity_member(uuid, uuid) to authenticated;

create or replace function public.end_activity(p_activity_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_activity public.activities%rowtype;
begin
  if v_actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select *
  into v_activity
  from public.activities
  where id = p_activity_id
  for update;

  if not found or v_activity.creator_id <> v_actor_id then
    raise exception 'ACTIVITY_OWNER_REQUIRED' using errcode = '42501';
  end if;

  if v_activity.status = 'ended' then
    return;
  end if;

  if v_activity.status = 'disabled' then
    raise exception 'DISABLED_ACTIVITY_CANNOT_END' using errcode = '22023';
  end if;

  update public.activities
  set
    status = 'ended',
    ended_at = timezone('utc', now())
  where id = p_activity_id;

  update public.conversations
  set
    is_archived = true,
    archived_at = timezone('utc', now())
  where activity_id = p_activity_id;

  update public.activity_invitations
  set
    status = 'cancelled',
    responded_at = timezone('utc', now())
  where activity_id = p_activity_id
    and status = 'pending';
end;
$$;

revoke all on function public.end_activity(uuid) from public, anon;
grant execute on function public.end_activity(uuid) to authenticated;

create or replace function public.create_activity_invitation(
  p_activity_id uuid,
  p_invitee_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_activity public.activities%rowtype;
  v_invitation_id uuid;
begin
  if v_actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select *
  into v_activity
  from public.activities
  where id = p_activity_id
  for update;

  if not found or v_activity.creator_id <> v_actor_id then
    raise exception 'ACTIVITY_OWNER_REQUIRED' using errcode = '42501';
  end if;

  if v_activity.status not in ('scheduled', 'active') then
    raise exception 'ACTIVITY_NOT_AVAILABLE' using errcode = '22023';
  end if;

  if p_invitee_id = v_actor_id or not exists (select 1 from public.profiles where id = p_invitee_id) then
    raise exception 'INVALID_INVITEE' using errcode = '22023';
  end if;

  select id
  into v_invitation_id
  from public.activity_invitations
  where activity_id = p_activity_id
    and invitee_id = p_invitee_id
    and status = 'pending';

  if v_invitation_id is not null then
    return v_invitation_id;
  end if;

  insert into public.activity_invitations (activity_id, inviter_id, invitee_id)
  values (p_activity_id, v_actor_id, p_invitee_id)
  returning id into v_invitation_id;

  return v_invitation_id;
end;
$$;

revoke all on function public.create_activity_invitation(uuid, uuid) from public, anon;
grant execute on function public.create_activity_invitation(uuid, uuid) to authenticated;

create or replace function public.respond_activity_invitation(
  p_invitation_id uuid,
  p_accept boolean
)
returns public.activity_participation_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_invitation public.activity_invitations%rowtype;
  v_activity public.activities%rowtype;
  v_existing_status public.activity_participation_status;
  v_next_status public.activity_participation_status;
  v_joined_count integer;
  v_queue_position bigint;
  v_conversation_id uuid;
begin
  if v_actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select *
  into v_invitation
  from public.activity_invitations
  where id = p_invitation_id;

  if not found or v_invitation.invitee_id <> v_actor_id then
    raise exception 'INVITATION_NOT_FOUND' using errcode = '42501';
  end if;

  select *
  into v_activity
  from public.activities
  where id = v_invitation.activity_id
  for update;

  select *
  into v_invitation
  from public.activity_invitations
  where id = p_invitation_id
    and invitee_id = v_actor_id
    and status = 'pending'
  for update;

  if not found then
    raise exception 'PENDING_INVITATION_NOT_FOUND' using errcode = '22023';
  end if;

  if not p_accept then
    update public.activity_invitations
    set
      status = 'declined',
      responded_at = timezone('utc', now())
    where id = p_invitation_id;

    return null;
  end if;

  if v_activity.status not in ('scheduled', 'active') then
    raise exception 'ACTIVITY_NOT_AVAILABLE' using errcode = '22023';
  end if;

  select status
  into v_existing_status
  from public.activity_participations
  where activity_id = v_activity.id
    and profile_id = v_actor_id
  for update;

  if found and v_existing_status in ('joined', 'waitlisted') then
    v_next_status := v_existing_status;
  else
    select count(*)::integer
    into v_joined_count
    from public.activity_participations
    where activity_id = v_activity.id
      and status = 'joined';

    if v_activity.capacity is null or v_joined_count < v_activity.capacity then
      v_next_status := 'joined';
    else
      v_next_status := 'waitlisted';
      v_queue_position := nextval('public.activity_waitlist_queue_seq');
    end if;

    insert into public.activity_participations (
      activity_id,
      profile_id,
      status,
      queue_position,
      requested_at,
      responded_at,
      joined_at,
      left_at
    )
    values (
      v_activity.id,
      v_actor_id,
      v_next_status,
      v_queue_position,
      timezone('utc', now()),
      timezone('utc', now()),
      case when v_next_status = 'joined' then timezone('utc', now()) else null end,
      null
    )
    on conflict (activity_id, profile_id) do update
    set
      status = excluded.status,
      queue_position = excluded.queue_position,
      requested_at = excluded.requested_at,
      responded_at = excluded.responded_at,
      joined_at = excluded.joined_at,
      left_at = null;
  end if;

  update public.activity_invitations
  set
    status = 'accepted',
    responded_at = timezone('utc', now())
  where id = p_invitation_id;

  if v_next_status = 'joined' then
    select id
    into v_conversation_id
    from public.conversations
    where activity_id = v_activity.id;

    insert into public.conversation_members (conversation_id, profile_id)
    values (v_conversation_id, v_actor_id)
    on conflict (conversation_id, profile_id) do update
    set
      joined_at = timezone('utc', now()),
      left_at = null;
  end if;

  return v_next_status;
end;
$$;

revoke all on function public.respond_activity_invitation(uuid, boolean) from public, anon;
grant execute on function public.respond_activity_invitation(uuid, boolean) to authenticated;

create or replace function public.send_message(
  p_conversation_id uuid,
  p_kind public.message_kind,
  p_body text default null,
  p_storage_path text default null,
  p_mime_type text default null,
  p_client_nonce uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_message_id uuid;
  v_is_archived boolean;
begin
  if v_actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select is_archived
  into v_is_archived
  from public.conversations
  where id = p_conversation_id
  for update;

  if not found or v_is_archived or not public.is_conversation_member(p_conversation_id, true) then
    raise exception 'ACTIVE_CONVERSATION_MEMBERSHIP_REQUIRED' using errcode = '42501';
  end if;

  if p_kind = 'text' then
    if char_length(btrim(coalesce(p_body, ''))) not between 1 and 4000 then
      raise exception 'INVALID_MESSAGE_BODY' using errcode = '22023';
    end if;

    p_body := btrim(p_body);
    p_storage_path := null;
    p_mime_type := null;
  elsif p_kind = 'image' then
    if p_storage_path is null
      or split_part(p_storage_path, '/', 1) <> p_conversation_id::text
      or split_part(p_storage_path, '/', 2) <> v_actor_id::text
      or p_mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')
      or (p_body is not null and char_length(btrim(p_body)) > 500)
    then
      raise exception 'INVALID_IMAGE_MESSAGE' using errcode = '22023';
    end if;

    if not exists (
      select 1
      from storage.objects
      where bucket_id = 'chat-images'
        and name = p_storage_path
        and metadata ->> 'mimetype' = p_mime_type
    ) then
      raise exception 'CHAT_IMAGE_NOT_FOUND' using errcode = '22023';
    end if;

    p_body := nullif(btrim(coalesce(p_body, '')), '');
  else
    raise exception 'INVALID_MESSAGE_KIND' using errcode = '22023';
  end if;

  insert into public.messages (
    conversation_id,
    sender_id,
    kind,
    body,
    storage_path,
    mime_type,
    client_nonce
  )
  values (
    p_conversation_id,
    v_actor_id,
    p_kind,
    p_body,
    p_storage_path,
    p_mime_type,
    p_client_nonce
  )
  on conflict (sender_id, client_nonce) do update
  set client_nonce = excluded.client_nonce
  returning id into v_message_id;

  return v_message_id;
end;
$$;

revoke all on function public.send_message(uuid, public.message_kind, text, text, text, uuid) from public, anon;
grant execute on function public.send_message(uuid, public.message_kind, text, text, text, uuid) to authenticated;
