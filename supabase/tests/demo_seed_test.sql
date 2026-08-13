begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

select extensions.is(
  (select count(*)::integer from auth.users where id::text like '20000000-0000-4000-8000-%'),
  36,
  'the demo seed creates 36 auth users'
);

select extensions.is(
  (select count(*)::integer from auth.identities where user_id::text like '20000000-0000-4000-8000-%' and provider = 'email'),
  36,
  'every demo user has an email identity'
);

select extensions.is(
  (select count(*)::integer from public.profiles where is_seed_user),
  36,
  'all demo profiles are marked as seed users'
);

select extensions.is(
  (
    select count(*)::integer
    from public.profiles
    where is_seed_user
      and campus = 'Campus Connect 示范校园'
      and bio is not null
      and is_public
  ),
  36,
  'demo profiles are complete and visible'
);

select extensions.is(
  (
    select count(*)::integer
    from public.skills
    where normalized_name in (
      '产品设计', 'figma 原型', '前端开发', 'react 开发', 'python 编程', '数据分析',
      '摄影', '视频剪辑', '活动策划', '文案写作', '英语口语', '公开表达',
      '羽毛球', '篮球', '跑步', '志愿服务', '天文观测', 'ui 设计',
      '校园产品', 'ai 应用', '创业实践', '阅读', '音乐', '环保行动'
    )
  ),
  24,
  'the seed provides a 24-skill catalog'
);

select extensions.is(
  (
    select count(*)::integer
    from public.profile_skills
    where profile_id::text like '20000000-0000-4000-8000-%'
  ),
  108,
  'the skill network has three relationships per demo student'
);

select extensions.is(
  (
    select count(*)::integer
    from (
      select profile_id
      from public.profile_skills
      where profile_id::text like '20000000-0000-4000-8000-%'
      group by profile_id
      having count(*) = 3
    ) as profiles_with_three_skills
  ),
  36,
  'all demo students have exactly three skills'
);

select extensions.is(
  (
    select count(*)::integer
    from public.personas
    where owner_id::text like '20000000-0000-4000-8000-%'
      and visibility = 'public'
      and is_enabled
      and allow_matching
  ),
  18,
  '18 demo students expose matching-enabled personas'
);

select extensions.is(
  (
    select count(*)::integer
    from public.persona_entries
    where owner_id::text like '20000000-0000-4000-8000-%'
      and status = 'confirmed'
  ),
  36,
  'demo personas contain confirmed authorized knowledge'
);

select extensions.is(
  (select count(*)::integer from public.activities where id::text like '30000000-0000-4000-8000-%'),
  10,
  'the seed creates ten school and club activities'
);

select extensions.is(
  (
    select count(*)::integer
    from public.activities
    where id::text like '30000000-0000-4000-8000-%'
      and description like '主办：%'
  ),
  10,
  'every seeded activity identifies its campus organizer'
);

select extensions.is(
  (
    select count(*)::integer
    from public.activities
    where id::text like '30000000-0000-4000-8000-%'
      and status in ('active', 'scheduled')
  ),
  8,
  'eight upcoming activities keep the demo map populated'
);

select extensions.is(
  (
    select count(*)::integer
    from public.activities
    where id::text like '30000000-0000-4000-8000-%'
      and status = 'ended'
  ),
  2,
  'two ended activities provide participation history'
);

select extensions.is(
  (
    select count(*)::integer
    from public.activity_participations
    where activity_id::text like '30000000-0000-4000-8000-%'
      and status = 'joined'
  ),
  40,
  'seeded activities have joined participants'
);

select extensions.is(
  (
    select count(*)::integer
    from public.activity_participations
    where activity_id::text like '30000000-0000-4000-8000-%'
      and status in ('pending', 'waitlisted', 'left')
  ),
  3,
  'participation data covers pending, waitlisted, and historical states'
);

select extensions.is(
  (
    select count(*)::integer
    from public.conversations
    where activity_id::text like '30000000-0000-4000-8000-%'
  ),
  10,
  'every seeded activity has a conversation'
);

select extensions.is(
  (
    select count(*)::integer
    from public.messages
    where id::text like '61000000-0000-4000-8000-%'
  ),
  20,
  'seeded activity chats contain representative history'
);

select extensions.is(
  (
    select count(*)::integer
    from public.activity_invitations
    where id::text like '62000000-0000-4000-8000-%'
      and status = 'pending'
  ),
  6,
  'pending invitations make Golden path B immediately demonstrable'
);

select * from extensions.finish();

rollback;
