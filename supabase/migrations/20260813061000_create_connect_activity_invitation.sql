create table app_private.ai_rate_limit_windows (
  actor_id uuid not null references public.profiles (id) on delete cascade,
  scope text not null check (char_length(scope) between 2 and 40),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (actor_id, scope, window_started_at)
);

revoke all on table app_private.ai_rate_limit_windows from public, anon, authenticated;

create or replace function public.consume_connect_rate_limit()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  current_window timestamptz := date_trunc('minute', now());
  new_count integer;
begin
  if viewer_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  delete from app_private.ai_rate_limit_windows
  where actor_id = viewer_id
    and scope = 'connect_recommend'
    and window_started_at < current_window - interval '1 minute';

  insert into app_private.ai_rate_limit_windows (actor_id, scope, window_started_at, request_count)
  values (viewer_id, 'connect_recommend', current_window, 1)
  on conflict (actor_id, scope, window_started_at) do update
  set request_count = ai_rate_limit_windows.request_count + 1
  where ai_rate_limit_windows.request_count < 8
  returning request_count into new_count;

  return new_count is not null;
end;
$$;

revoke all on function public.consume_connect_rate_limit() from public, anon, authenticated;
grant execute on function public.consume_connect_rate_limit() to authenticated;

create or replace function app_private.lock_block_contact_boundary()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  left_profile uuid := coalesce(new.blocker_id, old.blocker_id);
  right_profile uuid := coalesce(new.blocked_id, old.blocked_id);
begin
  perform pg_advisory_xact_lock(
    hashtextextended(least(left_profile::text, right_profile::text) || ':' || greatest(left_profile::text, right_profile::text), 0)
  );

  if tg_op = 'INSERT' then
    update public.activity_invitations
    set status = 'cancelled', responded_at = timezone('utc', now())
    where status = 'pending'
      and (
        (inviter_id = left_profile and invitee_id = right_profile)
        or (inviter_id = right_profile and invitee_id = left_profile)
      );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function app_private.lock_block_contact_boundary() from public, anon, authenticated;

drop trigger if exists lock_block_contact_boundary on public.blocks;
create trigger lock_block_contact_boundary
before insert or delete on public.blocks
for each row execute function app_private.lock_block_contact_boundary();

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
  actor_id uuid := auth.uid();
  activity public.activities%rowtype;
  invitation_id uuid;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into activity
  from public.activities
  where id = p_activity_id
  for update;

  if not found or activity.creator_id <> actor_id then
    raise exception 'ACTIVITY_OWNER_REQUIRED' using errcode = '42501';
  end if;

  if activity.status not in ('scheduled', 'active') then
    raise exception 'ACTIVITY_NOT_AVAILABLE' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(least(actor_id::text, p_invitee_id::text) || ':' || greatest(actor_id::text, p_invitee_id::text), 0)
  );

  if p_invitee_id = actor_id or not exists (
    select 1 from public.profiles
    where id = p_invitee_id
      and is_public = true
      and allow_matching = true
  ) or exists (
    select 1 from public.blocks
    where (blocker_id = actor_id and blocked_id = p_invitee_id)
       or (blocker_id = p_invitee_id and blocked_id = actor_id)
  ) then
    raise exception 'INVITEE_NOT_ELIGIBLE' using errcode = '42501';
  end if;

  select id into invitation_id
  from public.activity_invitations
  where activity_id = p_activity_id
    and invitee_id = p_invitee_id
    and status = 'pending';

  if invitation_id is not null then
    return invitation_id;
  end if;

  insert into public.activity_invitations (activity_id, inviter_id, invitee_id)
  values (p_activity_id, actor_id, p_invitee_id)
  returning id into invitation_id;

  return invitation_id;
end;
$$;

revoke all on function public.create_activity_invitation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_activity_invitation(uuid, uuid) to authenticated;

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
