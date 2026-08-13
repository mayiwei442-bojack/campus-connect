create type public.friendship_status as enum ('pending', 'accepted', 'declined', 'cancelled');

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  introduction text not null check (char_length(introduction) between 1 and 240),
  conversation_id uuid unique references public.conversations (id) on delete set null,
  requested_at timestamptz not null default timezone('utc', now()),
  responded_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (requester_id <> addressee_id),
  check (status <> 'accepted' or conversation_id is not null)
);

create unique index friendships_profile_pair_key
on public.friendships (
  least(requester_id, addressee_id),
  greatest(requester_id, addressee_id)
);

create index friendships_requester_status_idx
on public.friendships (requester_id, status, requested_at desc);

create index friendships_addressee_status_idx
on public.friendships (addressee_id, status, requested_at desc);

comment on table public.friendships is 'Mutually confirmed friend requests. Accepted rows own one reusable direct conversation.';
comment on column public.friendships.introduction is 'Short requester-authored verification or introduction message.';

alter table public.friendships enable row level security;

revoke all on table public.friendships from anon, authenticated;
grant select on table public.friendships to authenticated;

create policy "Friendship parties can read requests"
on public.friendships
for select
to authenticated
using (
  requester_id = (select auth.uid())
  or addressee_id = (select auth.uid())
);

drop trigger if exists set_friendships_updated_at on public.friendships;
create trigger set_friendships_updated_at
before update on public.friendships
for each row execute procedure public.set_profile_updated_at();

create or replace function public.search_people(p_query text)
returns table (
  profile_id uuid,
  nickname text,
  campus text,
  bio text,
  email_hint text,
  friendship_id uuid,
  friendship_status public.friendship_status,
  requested_by uuid,
  conversation_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_query text := lower(btrim(coalesce(p_query, '')));
  lookup_by_email boolean;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if char_length(normalized_query) < 2 or char_length(normalized_query) > 254 then
    raise exception 'INVALID_SEARCH_QUERY' using errcode = '22023';
  end if;

  lookup_by_email := position('@' in normalized_query) > 1;

  return query
  select
    candidate.id,
    candidate.nickname,
    candidate.campus,
    candidate.bio,
    case
      when lookup_by_email then
        left(split_part(auth_user.email, '@', 1), 1) || '***@' || split_part(auth_user.email, '@', 2)
      else null
    end,
    friendship.id,
    friendship.status,
    friendship.requester_id,
    friendship.conversation_id
  from public.profiles as candidate
  join auth.users as auth_user on auth_user.id = candidate.id
  left join public.friendships as friendship
    on least(friendship.requester_id, friendship.addressee_id) = least(actor_id, candidate.id)
   and greatest(friendship.requester_id, friendship.addressee_id) = greatest(actor_id, candidate.id)
  where candidate.id <> actor_id
    and candidate.is_public = true
    and candidate.allow_stranger_messages = true
    and not exists (
      select 1
      from public.blocks
      where (blocks.blocker_id = actor_id and blocks.blocked_id = candidate.id)
         or (blocks.blocker_id = candidate.id and blocks.blocked_id = actor_id)
    )
    and (
      (lookup_by_email and lower(auth_user.email) = normalized_query)
      or (
        not lookup_by_email
        and candidate.nickname ilike '%' || replace(replace(normalized_query, '%', '\%'), '_', '\_') || '%' escape '\'
      )
    )
  order by
    case when lower(candidate.nickname) = normalized_query then 0 else 1 end,
    candidate.updated_at desc,
    candidate.id
  limit 20;
end;
$$;

revoke all on function public.search_people(text) from public, anon, authenticated;
grant execute on function public.search_people(text) to authenticated;

create or replace function public.send_friend_request(
  p_addressee_id uuid,
  p_introduction text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_introduction text := btrim(coalesce(p_introduction, ''));
  friendship public.friendships%rowtype;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if p_addressee_id is null or p_addressee_id = actor_id then
    raise exception 'INVALID_ADDRESSEE' using errcode = '22023';
  end if;

  if char_length(normalized_introduction) not between 1 and 240 then
    raise exception 'INVALID_INTRODUCTION' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      least(actor_id::text, p_addressee_id::text) || ':' || greatest(actor_id::text, p_addressee_id::text),
      0
    )
  );

  if not exists (
    select 1
    from public.profiles
    where id = p_addressee_id
      and is_public = true
      and allow_stranger_messages = true
  ) or exists (
    select 1
    from public.blocks
    where (blocker_id = actor_id and blocked_id = p_addressee_id)
       or (blocker_id = p_addressee_id and blocked_id = actor_id)
  ) then
    raise exception 'ADDRESSEE_NOT_AVAILABLE' using errcode = '42501';
  end if;

  select *
  into friendship
  from public.friendships
  where least(requester_id, addressee_id) = least(actor_id, p_addressee_id)
    and greatest(requester_id, addressee_id) = greatest(actor_id, p_addressee_id)
  for update;

  if not found then
    insert into public.friendships (requester_id, addressee_id, introduction)
    values (actor_id, p_addressee_id, normalized_introduction)
    returning * into friendship;

    return friendship.id;
  end if;

  if friendship.status = 'accepted'
    or (friendship.status = 'pending' and friendship.requester_id = actor_id)
  then
    return friendship.id;
  end if;

  if friendship.status = 'pending' and friendship.addressee_id = actor_id then
    raise exception 'INCOMING_REQUEST_EXISTS' using errcode = '22023';
  end if;

  update public.friendships
  set
    requester_id = actor_id,
    addressee_id = p_addressee_id,
    status = 'pending',
    introduction = normalized_introduction,
    requested_at = timezone('utc', now()),
    responded_at = null
  where id = friendship.id;

  return friendship.id;
end;
$$;

revoke all on function public.send_friend_request(uuid, text) from public, anon, authenticated;
grant execute on function public.send_friend_request(uuid, text) to authenticated;

create or replace function public.respond_friend_request(
  p_friendship_id uuid,
  p_accept boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  friendship public.friendships%rowtype;
  direct_conversation_id uuid;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select *
  into friendship
  from public.friendships
  where id = p_friendship_id;

  if not found
    or friendship.addressee_id <> actor_id
    or friendship.status <> 'pending'
  then
    raise exception 'PENDING_FRIEND_REQUEST_NOT_FOUND' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      least(friendship.requester_id::text, friendship.addressee_id::text)
        || ':' ||
      greatest(friendship.requester_id::text, friendship.addressee_id::text),
      0
    )
  );

  select *
  into friendship
  from public.friendships
  where id = p_friendship_id
    and addressee_id = actor_id
    and status = 'pending'
  for update;

  if not found then
    raise exception 'PENDING_FRIEND_REQUEST_NOT_FOUND' using errcode = '42501';
  end if;

  if not p_accept then
    update public.friendships
    set status = 'declined', responded_at = timezone('utc', now())
    where id = friendship.id;

    return null;
  end if;

  if exists (
    select 1
    from public.blocks
    where (blocker_id = friendship.requester_id and blocked_id = friendship.addressee_id)
       or (blocker_id = friendship.addressee_id and blocked_id = friendship.requester_id)
  ) then
    raise exception 'FRIEND_REQUEST_BLOCKED' using errcode = '42501';
  end if;

  direct_conversation_id := friendship.conversation_id;

  if direct_conversation_id is null then
    insert into public.conversations (kind, title)
    values ('direct', null)
    returning id into direct_conversation_id;
  else
    update public.conversations
    set is_archived = false, archived_at = null
    where id = direct_conversation_id
      and kind = 'direct';

    if not found then
      raise exception 'DIRECT_CONVERSATION_NOT_FOUND' using errcode = '55000';
    end if;
  end if;

  insert into public.conversation_members (conversation_id, profile_id)
  values
    (direct_conversation_id, friendship.requester_id),
    (direct_conversation_id, friendship.addressee_id)
  on conflict (conversation_id, profile_id) do update
  set joined_at = timezone('utc', now()), left_at = null;

  update public.friendships
  set
    status = 'accepted',
    conversation_id = direct_conversation_id,
    responded_at = timezone('utc', now())
  where id = friendship.id;

  return direct_conversation_id;
end;
$$;

revoke all on function public.respond_friend_request(uuid, boolean) from public, anon, authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

-- Extend the existing contact-boundary trigger so blocking also closes direct friendship contact.
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

    update public.friendships
    set status = 'cancelled', responded_at = timezone('utc', now())
    where status in ('pending', 'accepted')
      and (
        (requester_id = left_profile and addressee_id = right_profile)
        or (requester_id = right_profile and addressee_id = left_profile)
      );

    update public.conversations
    set is_archived = true, archived_at = timezone('utc', now())
    where kind = 'direct'
      and is_archived = false
      and id in (
        select conversation_id
        from public.friendships
        where conversation_id is not null
          and (
            (requester_id = left_profile and addressee_id = right_profile)
            or (requester_id = right_profile and addressee_id = left_profile)
          )
      );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function app_private.lock_block_contact_boundary() from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'friendships'
  ) then
    alter publication supabase_realtime add table public.friendships;
  end if;
end
$$;
