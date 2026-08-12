do $$
begin
  create type public.activity_join_mode as enum ('free', 'approval');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.activity_status as enum ('scheduled', 'active', 'ended', 'disabled');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.activity_participation_status as enum (
    'pending',
    'joined',
    'waitlisted',
    'left',
    'removed',
    'rejected'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.activity_invitation_status as enum ('pending', 'accepted', 'declined', 'cancelled');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.conversation_kind as enum ('activity', 'direct');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.message_kind as enum ('text', 'image');
exception
  when duplicate_object then null;
end
$$;

create table public.places (
  id text primary key check (id ~ '^[a-z0-9_ ]+$'),
  display_name text not null check (char_length(display_name) between 1 and 80),
  category text not null check (char_length(category) between 1 and 40),
  description text check (description is null or char_length(description) <= 500),
  glb_object_name text not null unique,
  glb_anchor_name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (glb_object_name = 'PLACE_' || id),
  check (glb_anchor_name = 'ANCHOR_' || id)
);

comment on table public.places is 'Curated logical campus locations backed by stable GLB object and anchor names.';

insert into public.places (id, display_name, category, glb_object_name, glb_anchor_name)
select
  place_id,
  initcap(replace(place_id, '_', ' ')),
  split_part(replace(place_id, '_', ' '), ' ', 1),
  'PLACE_' || place_id,
  'ANCHOR_' || place_id
from unnest(array[
  'badminton_1',
  'baseball_1',
  'basketball_1',
  'basketball_2',
  'basketball_3',
  'basketball_4',
  'basketball_5',
  'basketball_6',
  'basketball_7',
  'basketball_8',
  'basketball_9',
  'basketball_10',
  'basketball_11',
  'basketball_12',
  'basketball_13',
  'basketball_14',
  'canteen_1',
  'canteen_2',
  'canteen_3',
  'dormitory_1',
  'dormitory_2',
  'dormitory_3',
  'dormitory_4',
  'dormitory_5',
  'dormitory_6',
  'dormitory_7',
  'dormitory_8',
  'dormitory_9',
  'dormitory_10',
  'dormitory_11',
  'dormitory_12',
  'dormitory_13',
  'dormitory_14',
  'dormitory_15',
  'dormitory_16',
  'dormitory_17',
  'dormitory_18',
  'dormitory_19',
  'dormitory_20',
  'dormitory_21',
  'dormitory_22',
  'dormitory_23',
  'dormitory_24',
  'dormitory_25',
  'dormitory_26',
  'dormitory_27',
  'dormitory_28',
  'football_1',
  'football_2',
  'ground track field_1',
  'ground track field_2',
  'gym',
  'internship center',
  'library',
  'square_1',
  'square_2',
  'square_3',
  'teaching_1',
  'teaching_2',
  'teaching_3',
  'teaching_4',
  'teaching_5',
  'teaching_6',
  'teaching_7',
  'teaching_8',
  'teaching_9',
  'teaching_10',
  'teaching_11',
  'tennis_1',
  'tennis_2',
  'tennis_3',
  'tennis_4',
  'tennis_5'
]) as scene_places(place_id);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete restrict,
  place_id text not null references public.places (id) on delete restrict,
  title text not null check (char_length(title) between 2 and 80),
  description text check (description is null or char_length(description) <= 1000),
  starts_at timestamptz,
  ends_at timestamptz,
  capacity integer check (capacity is null or capacity >= 1),
  join_mode public.activity_join_mode not null,
  status public.activity_status not null default 'active',
  ended_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check ((status = 'ended') = (ended_at is not null))
);

create index activities_place_status_starts_at_idx
on public.activities (place_id, status, starts_at);

create index activities_creator_id_idx
on public.activities (creator_id);

comment on table public.activities is 'Persistent activity business entities; map Beacons are derived from active rows by place_id.';

create sequence public.activity_waitlist_queue_seq as bigint;

create table public.activity_participations (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status public.activity_participation_status not null,
  queue_position bigint,
  requested_at timestamptz not null default timezone('utc', now()),
  responded_at timestamptz,
  joined_at timestamptz,
  left_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  unique (activity_id, profile_id),
  check ((status = 'waitlisted') = (queue_position is not null)),
  check ((status = 'joined') = (joined_at is not null and left_at is null))
);

create unique index activity_participations_waitlist_order_key
on public.activity_participations (activity_id, queue_position)
where status = 'waitlisted';

create index activity_participations_profile_status_idx
on public.activity_participations (profile_id, status);

create table public.activity_invitations (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  invitee_id uuid not null references public.profiles (id) on delete cascade,
  status public.activity_invitation_status not null default 'pending',
  responded_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  check (inviter_id <> invitee_id)
);

create unique index activity_invitations_pending_key
on public.activity_invitations (activity_id, invitee_id)
where status = 'pending';

create index activity_invitations_invitee_status_idx
on public.activity_invitations (invitee_id, status, created_at desc);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind public.conversation_kind not null,
  activity_id uuid unique references public.activities (id) on delete cascade,
  title text check (title is null or char_length(title) <= 100),
  is_archived boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check ((kind = 'activity') = (activity_id is not null)),
  check (is_archived = (archived_at is not null))
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default timezone('utc', now()),
  left_at timestamptz,
  primary key (conversation_id, profile_id)
);

create index conversation_members_profile_id_idx
on public.conversation_members (profile_id, left_at, conversation_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete restrict,
  kind public.message_kind not null,
  body text,
  storage_path text,
  mime_type text,
  client_nonce uuid not null default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  unique (sender_id, client_nonce),
  check (
    (kind = 'text' and body is not null and char_length(body) between 1 and 4000 and storage_path is null)
    or
    (kind = 'image' and storage_path is not null and char_length(storage_path) between 1 and 500 and (body is null or char_length(body) <= 500))
  )
);

create index messages_conversation_created_at_idx
on public.messages (conversation_id, created_at, id);

alter table public.places enable row level security;
alter table public.activities enable row level security;
alter table public.activity_participations enable row level security;
alter table public.activity_invitations enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

revoke all on table public.places from anon, authenticated;
revoke all on table public.activities from anon, authenticated;
revoke all on table public.activity_participations from anon, authenticated;
revoke all on table public.activity_invitations from anon, authenticated;
revoke all on table public.conversations from anon, authenticated;
revoke all on table public.conversation_members from anon, authenticated;
revoke all on table public.messages from anon, authenticated;
revoke all on sequence public.activity_waitlist_queue_seq from public, anon, authenticated;

grant select on table public.places to authenticated;
grant select on table public.activities to authenticated;
grant select on table public.activity_participations to authenticated;
grant select on table public.activity_invitations to authenticated;
grant select on table public.conversations to authenticated;
grant select on table public.conversation_members to authenticated;
grant select on table public.messages to authenticated;

create or replace function public.is_conversation_member(
  p_conversation_id uuid,
  p_require_active boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members
    where conversation_id = p_conversation_id
      and profile_id = (select auth.uid())
      and (not p_require_active or left_at is null)
  );
$$;

revoke all on function public.is_conversation_member(uuid, boolean) from public, anon;
grant execute on function public.is_conversation_member(uuid, boolean) to authenticated;

create policy "Authenticated users can read active places"
on public.places
for select
to authenticated
using (is_active = true);

create policy "Authenticated users can read available activities"
on public.activities
for select
to authenticated
using (status <> 'disabled' or creator_id = (select auth.uid()));

create policy "Authenticated users can read activity participation"
on public.activity_participations
for select
to authenticated
using (
  exists (
    select 1
    from public.activities
    where activities.id = activity_participations.activity_id
      and (activities.status <> 'disabled' or activities.creator_id = (select auth.uid()))
  )
);

create policy "Invitation parties can read invitations"
on public.activity_invitations
for select
to authenticated
using (
  inviter_id = (select auth.uid())
  or invitee_id = (select auth.uid())
  or exists (
    select 1
    from public.activities
    where activities.id = activity_invitations.activity_id
      and activities.creator_id = (select auth.uid())
  )
);

create policy "Members can read conversations"
on public.conversations
for select
to authenticated
using ((select public.is_conversation_member(id, false)));

create policy "Members can read conversation membership"
on public.conversation_members
for select
to authenticated
using ((select public.is_conversation_member(conversation_id, false)));

create policy "Members can read conversation messages"
on public.messages
for select
to authenticated
using ((select public.is_conversation_member(conversation_id, false)));

drop trigger if exists set_places_updated_at on public.places;
create trigger set_places_updated_at
before update on public.places
for each row execute procedure public.set_profile_updated_at();

drop trigger if exists set_activities_updated_at on public.activities;
create trigger set_activities_updated_at
before update on public.activities
for each row execute procedure public.set_profile_updated_at();

drop trigger if exists set_activity_participations_updated_at on public.activity_participations;
create trigger set_activity_participations_updated_at
before update on public.activity_participations
for each row execute procedure public.set_profile_updated_at();

drop trigger if exists set_conversations_updated_at on public.conversations;
create trigger set_conversations_updated_at
before update on public.conversations
for each row execute procedure public.set_profile_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-images',
  'chat-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Conversation members can read chat images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'chat-images'
  and public.is_conversation_member(((storage.foldername(name))[1])::uuid, false)
  and (
    (storage.foldername(name))[2] = (select auth.uid())::text
    or exists (
      select 1
      from public.messages
      where messages.conversation_id = ((storage.foldername(name))[1])::uuid
        and messages.storage_path = name
    )
  )
);

create policy "Active members can upload chat images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'chat-images'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and public.is_conversation_member(((storage.foldername(name))[1])::uuid, true)
  and exists (
    select 1
    from public.conversations
    where conversations.id = ((storage.foldername(name))[1])::uuid
      and conversations.is_archived = false
  )
);

create policy "Uploaders can remove unsent chat images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'chat-images'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and public.is_conversation_member(((storage.foldername(name))[1])::uuid, true)
  and not exists (
    select 1
    from public.messages
    where messages.conversation_id = ((storage.foldername(name))[1])::uuid
      and messages.storage_path = name
  )
);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'activities'
  ) then
    alter publication supabase_realtime add table public.activities;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'activity_participations'
  ) then
    alter publication supabase_realtime add table public.activity_participations;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end
$$;
