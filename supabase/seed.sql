-- Campus Connect deterministic demo data for local and non-production environments only.
-- All 36 demo students can sign in with the shared password: CampusDemo2026!
-- Do not apply this seed to a production project.

with seed_source as (
  select
    seed_no,
    (array[
      '林夏', '周屿', '陈默', '许晴', '江禾', '苏澄',
      '顾言', '沈知', '贺川', '唐棠', '温宁', '陆行',
      '乔安', '韩野', '夏栀', '宋予', '方舟', '白露',
      '程一', '叶帆', '黎星', '余音', '高远', '罗屿',
      '周周', '林溪', '徐安', '施雨', '赵可', '秦朗',
      '梁悦', '安然', '蒋新', '宁浩', '谢宁', '李想'
    ])[seed_no] as nickname,
    (array[
      '校创客社产品组，擅长把模糊想法拆成可测试的原型。',
      '计算机系学生，关注前端工程和 AI 产品落地。',
      '喜欢用 React 做校园工具，也愿意帮新手查问题。',
      '交互设计方向，关注可用性测试与视觉系统。',
      '摄影协会成员，常记录校园活动与人物故事。',
      '会剪辑和简单分镜，想让学校活动被更好地看见。',
      '校学生会活动部志愿者，擅长排期、协调和现场执行。',
      '喜欢采访与写作，正在做校园人物小志。',
      '数据分析学习者，希望用数据帮助校园公益项目。',
      '对 Python 和 AI 应用感兴趣，喜欢快速做小实验。',
      '英语角成员，愿意组织轻松的口语互助活动。',
      '校辩论队队员，关注观点结构、表达与倾听。',
      '羽毛球社干事，欢迎零基础同学一起打球。',
      '篮球社成员，喜欢友好、不计较胜负的校园局。',
      '校园跑团志愿领跑，也关注环保与户外安全。',
      '青年志愿者协会成员，常参与图书整理和社区服务。',
      '天文社观测组成员，喜欢把复杂知识讲得好懂。',
      '校话剧社成员，参与排练组织、舞台文案和招新。',
      '正在学习用户研究，对校园公共空间体验感兴趣。',
      '喜欢做小程序和自动化，希望找到稳定的学习搭子。',
      '校报学生记者，关注校园社群与真实人物。',
      '音乐爱好者，会简单录音和活动音频处理。',
      '喜欢学习新工具，能承担资料整理和项目记录。',
      '对创业实践和商业分析感兴趣，享受团队讨论。',
      '可以帮忙制作问卷、整理反馈，也爱读非虚构。',
      '前端入门中，愿意从小页面和组件任务做起。',
      '关注校园无障碍体验，希望参与更友好的产品设计。',
      '喜欢在活动中负责人员联络和流程提醒。',
      '数据可视化初学者，想用图表讲清校园故事。',
      '喜欢户外和环保行动，能为活动做拍摄记录。',
      '阅读会常客，愿意担任讨论主持和笔记整理。',
      '对校园地图和空间叙事感兴趣，会一些 UI 设计。',
      '细心、准时，愿意承担测试、物料和现场支持。',
      '喜欢运动与团队协作，愿意帮助新同学融入活动。',
      '影像与文案都在学习，希望参与有明确产出的项目。',
      '喜欢安静高效的合作，可以负责资料检索与校对。'
    ])[seed_no] as bio
  from generate_series(1, 36) as seed_numbers(seed_no)
), seed_users as (
  select
    seed_no,
    format('20000000-0000-4000-8000-%s', lpad(seed_no::text, 12, '0'))::uuid as id,
    format('seed.student%s@campus-connect.local', lpad(seed_no::text, 2, '0')) as email,
    nickname,
    bio
  from seed_source
)
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  id,
  'authenticated',
  'authenticated',
  email,
  extensions.crypt('CampusDemo2026!', extensions.gen_salt('bf')),
  timezone('utc', now()),
  '',
  '',
  '',
  '',
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object(
    'sub', id::text,
    'email', email,
    'nickname', nickname,
    'bio', bio,
    'email_verified', true,
    'phone_verified', false,
    'seed_user', true
  ),
  timezone('utc', now()),
  timezone('utc', now())
from seed_users
on conflict (id) do update
set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  confirmation_token = excluded.confirmation_token,
  recovery_token = excluded.recovery_token,
  email_change_token_new = excluded.email_change_token_new,
  email_change = excluded.email_change,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = excluded.updated_at;

insert into auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  id::text,
  id,
  raw_user_meta_data,
  'email',
  timezone('utc', now()),
  timezone('utc', now()),
  timezone('utc', now())
from auth.users
where id::text like '20000000-0000-4000-8000-%'
on conflict (provider_id, provider) do update
set
  identity_data = excluded.identity_data,
  updated_at = excluded.updated_at;

update public.profiles as profile
set
  nickname = auth_user.raw_user_meta_data ->> 'nickname',
  campus = 'Campus Connect 示范校园',
  bio = auth_user.raw_user_meta_data ->> 'bio',
  is_public = true,
  allow_stranger_messages = true,
  allow_matching = profile.id <> '20000000-0000-4000-8000-000000000035'::uuid,
  is_seed_user = true,
  updated_at = timezone('utc', now())
from auth.users as auth_user
where profile.id = auth_user.id
  and auth_user.id::text like '20000000-0000-4000-8000-%';

with seed_skill_catalog(skill_no, name, kind) as (
  values
    (1, '产品设计', 'ability'::public.skill_kind),
    (2, 'Figma 原型', 'ability'::public.skill_kind),
    (3, '前端开发', 'ability'::public.skill_kind),
    (4, 'React 开发', 'ability'::public.skill_kind),
    (5, 'Python 编程', 'ability'::public.skill_kind),
    (6, '数据分析', 'ability'::public.skill_kind),
    (7, '摄影', 'ability'::public.skill_kind),
    (8, '视频剪辑', 'ability'::public.skill_kind),
    (9, '活动策划', 'ability'::public.skill_kind),
    (10, '文案写作', 'ability'::public.skill_kind),
    (11, '英语口语', 'ability'::public.skill_kind),
    (12, '公开表达', 'ability'::public.skill_kind),
    (13, '羽毛球', 'ability'::public.skill_kind),
    (14, '篮球', 'ability'::public.skill_kind),
    (15, '跑步', 'ability'::public.skill_kind),
    (16, '志愿服务', 'ability'::public.skill_kind),
    (17, '天文观测', 'ability'::public.skill_kind),
    (18, 'UI 设计', 'ability'::public.skill_kind),
    (19, '校园产品', 'interest'::public.skill_kind),
    (20, 'AI 应用', 'interest'::public.skill_kind),
    (21, '创业实践', 'interest'::public.skill_kind),
    (22, '阅读', 'interest'::public.skill_kind),
    (23, '音乐', 'interest'::public.skill_kind),
    (24, '环保行动', 'interest'::public.skill_kind)
)
insert into public.skills (name, kind, created_by)
select
  name,
  kind,
  '20000000-0000-4000-8000-000000000001'::uuid
from seed_skill_catalog
on conflict (kind, normalized_name) do update
set name = excluded.name;

with seed_skill_catalog(skill_no, name, kind) as (
  values
    (1, '产品设计', 'ability'::public.skill_kind),
    (2, 'Figma 原型', 'ability'::public.skill_kind),
    (3, '前端开发', 'ability'::public.skill_kind),
    (4, 'React 开发', 'ability'::public.skill_kind),
    (5, 'Python 编程', 'ability'::public.skill_kind),
    (6, '数据分析', 'ability'::public.skill_kind),
    (7, '摄影', 'ability'::public.skill_kind),
    (8, '视频剪辑', 'ability'::public.skill_kind),
    (9, '活动策划', 'ability'::public.skill_kind),
    (10, '文案写作', 'ability'::public.skill_kind),
    (11, '英语口语', 'ability'::public.skill_kind),
    (12, '公开表达', 'ability'::public.skill_kind),
    (13, '羽毛球', 'ability'::public.skill_kind),
    (14, '篮球', 'ability'::public.skill_kind),
    (15, '跑步', 'ability'::public.skill_kind),
    (16, '志愿服务', 'ability'::public.skill_kind),
    (17, '天文观测', 'ability'::public.skill_kind),
    (18, 'UI 设计', 'ability'::public.skill_kind),
    (19, '校园产品', 'interest'::public.skill_kind),
    (20, 'AI 应用', 'interest'::public.skill_kind),
    (21, '创业实践', 'interest'::public.skill_kind),
    (22, '阅读', 'interest'::public.skill_kind),
    (23, '音乐', 'interest'::public.skill_kind),
    (24, '环保行动', 'interest'::public.skill_kind)
), seed_assignments as (
  select
    profile_no,
    unnest(
      case profile_no
        when 1 then array[1, 2, 19]
        when 2 then array[3, 4, 20]
        when 3 then array[3, 4, 5]
        when 4 then array[1, 2, 18]
        when 5 then array[7, 10, 19]
        when 6 then array[7, 8, 23]
        when 7 then array[9, 12, 16]
        when 8 then array[10, 12, 22]
        when 9 then array[5, 6, 20]
        when 10 then array[5, 20, 21]
        when 11 then array[11, 12, 22]
        when 12 then array[10, 12, 19]
        when 13 then array[9, 13, 19]
        when 14 then array[9, 14, 19]
        when 15 then array[15, 16, 24]
        when 16 then array[9, 16, 24]
        when 17 then array[7, 17, 22]
        when 18 then array[9, 12, 23]
        else array[
          ((profile_no - 1) % 24) + 1,
          ((profile_no + 5) % 24) + 1,
          ((profile_no + 11) % 24) + 1
        ]
      end
    ) as skill_no
  from generate_series(1, 36) as seed_profiles(profile_no)
)
insert into public.profile_skills (
  profile_id,
  skill_id,
  self_rating,
  note,
  is_public,
  allow_contact,
  allow_matching
)
select
  format('20000000-0000-4000-8000-%s', lpad(assignment.profile_no::text, 12, '0'))::uuid,
  skill.id,
  3 + ((assignment.profile_no + assignment.skill_no) % 3),
  format('%s：愿意与同学一起练习并交换经验。', catalog.name),
  true,
  true,
  not (assignment.profile_no = 36 and assignment.skill_no = ((36 - 1) % 24) + 1)
from seed_assignments as assignment
join seed_skill_catalog as catalog using (skill_no)
join public.skills as skill
  on skill.kind = catalog.kind
 and skill.normalized_name = lower(btrim(catalog.name))
on conflict (profile_id, skill_id) do update
set
  self_rating = excluded.self_rating,
  note = excluded.note,
  is_public = excluded.is_public,
  allow_contact = excluded.allow_contact,
  allow_matching = excluded.allow_matching,
  updated_at = timezone('utc', now());

with seed_personas as (
  select
    profile_no,
    format('50000000-0000-4000-8000-%s', lpad(profile_no::text, 12, '0'))::uuid as id,
    format('20000000-0000-4000-8000-%s', lpad(profile_no::text, 12, '0'))::uuid as owner_id,
    (array[
      '产品共创', '工程协作', '前端学习', '交互设计', '校园摄影', '影像记录',
      '活动执行', '采访写作', '数据分析', 'AI 小实验', '英语互助', '辩论表达',
      '羽毛球', '篮球友谊', '跑步户外', '志愿服务', '天文观测', '话剧排练'
    ])[profile_no] as topic
  from generate_series(1, 18) as seed_profiles(profile_no)
)
insert into public.personas (
  id,
  owner_id,
  slot,
  name,
  topic,
  summary,
  visibility,
  is_enabled,
  allow_matching
)
select
  persona.id,
  persona.owner_id,
  1,
  profile.nickname || '的协作档案',
  persona.topic,
  profile.bio,
  'public',
  true,
  true
from seed_personas as persona
join public.profiles as profile on profile.id = persona.owner_id
on conflict (id) do update
set
  name = excluded.name,
  topic = excluded.topic,
  summary = excluded.summary,
  visibility = excluded.visibility,
  is_enabled = excluded.is_enabled,
  allow_matching = excluded.allow_matching,
  updated_at = timezone('utc', now());

with seed_entries as (
  select
    profile_no,
    entry_no,
    format(
      '51000000-0000-4000-8000-%s',
      lpad((profile_no * 10 + entry_no)::text, 12, '0')
    )::uuid as id,
    format('50000000-0000-4000-8000-%s', lpad(profile_no::text, 12, '0'))::uuid as persona_id,
    format('20000000-0000-4000-8000-%s', lpad(profile_no::text, 12, '0'))::uuid as owner_id
  from generate_series(1, 18) as seed_profiles(profile_no)
  cross join generate_series(1, 2) as seed_entry_numbers(entry_no)
)
insert into public.persona_entries (
  id,
  persona_id,
  owner_id,
  kind,
  knowledge_key,
  content,
  status,
  confirmed_at
)
select
  entry.id,
  entry.persona_id,
  entry.owner_id,
  case entry.entry_no
    when 1 then 'preference'::public.persona_entry_kind
    else 'fact'::public.persona_entry_kind
  end,
  case entry.entry_no when 1 then '协作方式' else '可投入时间' end,
  case entry.entry_no
    when 1 then profile.nickname || '更喜欢先对齐目标，再用小任务快速试作。'
    else '通常可在工作日晚间或周末投入 2–4 小时。'
  end,
  'confirmed',
  timezone('utc', now()) - interval '7 days'
from seed_entries as entry
join public.profiles as profile on profile.id = entry.owner_id
on conflict (id) do update
set
  kind = excluded.kind,
  knowledge_key = excluded.knowledge_key,
  content = excluded.content,
  status = excluded.status,
  confirmed_at = excluded.confirmed_at,
  updated_at = timezone('utc', now());

with seed_activities(
  activity_no,
  creator_no,
  place_id,
  title,
  description,
  start_hours,
  duration_hours,
  capacity,
  join_mode,
  status
) as (
  values
    (1, 1, 'library', '校创客社·校园应用原型共创', '主办：校创客社。围绕校园真实问题，用 Figma 产出一个可测试的产品原型。', 24, 3, 8, 'free'::public.activity_join_mode, 'active'::public.activity_status),
    (2, 5, 'square_1', '摄影协会·校园光影采风', '主办：校摄影协会。从广场出发，一起练习人像和建筑光影。', 48, 2, 12, 'free'::public.activity_join_mode, 'active'::public.activity_status),
    (3, 16, 'library', '青协·旧书整理志愿行动', '主办：青年志愿者协会。整理闲置图书，为后续校园分享做准备。', 72, 3, 16, 'free'::public.activity_join_mode, 'active'::public.activity_status),
    (4, 17, 'ground track field_1', '天文社·夏夜星空观测', '主办：校天文社。从辨认夏季大三角开始，无基础也可参加。', 96, 2, 20, 'approval'::public.activity_join_mode, 'active'::public.activity_status),
    (5, 12, 'teaching_3', '校辩论队·开放训练', '主办：校辩论队。通过短题练习论点构建、反驳和复盘。', 120, 2, 14, 'approval'::public.activity_join_mode, 'active'::public.activity_status),
    (6, 13, 'badminton_1', '羽毛球社·新生友谊赛', '主办：校羽毛球社。友好分组，提供少量备用球拍，欢迎新手。', 144, 3, 12, 'free'::public.activity_join_mode, 'active'::public.activity_status),
    (7, 7, 'teaching_2', '校学生会·迎新服务设计工坊', '主办：校学生会。共同梳理新生报到体验，完成服务蓝图。', 168, 3, 10, 'approval'::public.activity_join_mode, 'scheduled'::public.activity_status),
    (8, 18, 'square_2', '校话剧社·秋季招新排练', '主办：校话剧社。包含破冰、声音练习和短片段试排。', 192, 3, 18, 'free'::public.activity_join_mode, 'scheduled'::public.activity_status),
    (9, 15, 'ground track field_2', '校园跑团·晨跑打卡', '主办：校园跑团。以舒适配速完成操场晨跑，跑后一起拉伸。', -240, 2, 24, 'free'::public.activity_join_mode, 'ended'::public.activity_status),
    (10, 14, 'basketball_1', '篮球社·周末 3v3', '主办：校篮球社。现场混合组队，以交流和友谊为主。', -168, 3, 18, 'free'::public.activity_join_mode, 'ended'::public.activity_status)
), activity_rows as (
  select
    activity_no,
    format('30000000-0000-4000-8000-%s', lpad(activity_no::text, 12, '0'))::uuid as id,
    format('20000000-0000-4000-8000-%s', lpad(creator_no::text, 12, '0'))::uuid as creator_id,
    place_id,
    title,
    description,
    timezone('utc', now()) + make_interval(hours => start_hours) as starts_at,
    timezone('utc', now()) + make_interval(hours => start_hours + duration_hours) as ends_at,
    capacity,
    join_mode,
    status
  from seed_activities
)
insert into public.activities (
  id,
  creator_id,
  place_id,
  title,
  description,
  starts_at,
  ends_at,
  capacity,
  join_mode,
  status,
  ended_at,
  created_at
)
select
  id,
  creator_id,
  place_id,
  title,
  description,
  starts_at,
  ends_at,
  capacity,
  join_mode,
  status,
  case when status = 'ended' then ends_at else null end,
  timezone('utc', now()) - interval '14 days'
from activity_rows
on conflict (id) do update
set
  creator_id = excluded.creator_id,
  place_id = excluded.place_id,
  title = excluded.title,
  description = excluded.description,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  capacity = excluded.capacity,
  join_mode = excluded.join_mode,
  status = excluded.status,
  ended_at = excluded.ended_at,
  updated_at = timezone('utc', now());

insert into public.conversations (id, kind, activity_id, title)
select
  format(
    '60000000-0000-4000-8000-%s',
    lpad(right(activity.id::text, 12), 12, '0')
  )::uuid,
  'activity',
  activity.id,
  activity.title
from public.activities as activity
where activity.id::text like '30000000-0000-4000-8000-%'
on conflict (activity_id) do update
set
  title = excluded.title,
  updated_at = timezone('utc', now());

with joined_seed_members as (
  select distinct
    activity_no,
    unnest(array[activity_no, activity_no + 8, activity_no + 9, activity_no + 10]) as profile_no
  from generate_series(1, 10) as seed_activities(activity_no)
)
insert into public.activity_participations (
  activity_id,
  profile_id,
  status,
  joined_at,
  requested_at
)
select
  format('30000000-0000-4000-8000-%s', lpad(member.activity_no::text, 12, '0'))::uuid,
  format('20000000-0000-4000-8000-%s', lpad(member.profile_no::text, 12, '0'))::uuid,
  'joined',
  timezone('utc', now()) - interval '12 days',
  timezone('utc', now()) - interval '13 days'
from joined_seed_members as member
on conflict (activity_id, profile_id) do update
set
  status = excluded.status,
  queue_position = null,
  joined_at = excluded.joined_at,
  left_at = null,
  updated_at = timezone('utc', now());

insert into public.activity_participations (
  activity_id,
  profile_id,
  status,
  queue_position,
  requested_at,
  joined_at,
  left_at
)
values
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000025', 'pending', null, timezone('utc', now()) - interval '1 day', null, null),
  ('30000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000026', 'waitlisted', 900001, timezone('utc', now()) - interval '2 days', null, null),
  ('30000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000027', 'left', null, timezone('utc', now()) - interval '20 days', timezone('utc', now()) - interval '19 days', timezone('utc', now()) - interval '16 days')
on conflict (activity_id, profile_id) do update
set
  status = excluded.status,
  queue_position = excluded.queue_position,
  requested_at = excluded.requested_at,
  joined_at = excluded.joined_at,
  left_at = excluded.left_at,
  updated_at = timezone('utc', now());

insert into public.conversation_members (conversation_id, profile_id, joined_at, left_at)
select
  conversation.id,
  participation.profile_id,
  coalesce(participation.joined_at, participation.requested_at),
  participation.left_at
from public.activity_participations as participation
join public.conversations as conversation on conversation.activity_id = participation.activity_id
where participation.activity_id::text like '30000000-0000-4000-8000-%'
  and participation.status in ('joined', 'left')
on conflict (conversation_id, profile_id) do update
set
  joined_at = excluded.joined_at,
  left_at = excluded.left_at;

with seed_conversations as (
  select
    row_number() over (order by activity.id)::integer as activity_no,
    activity.id as activity_id,
    activity.creator_id,
    activity.title,
    conversation.id as conversation_id,
    (
      select member.profile_id
      from public.conversation_members as member
      where member.conversation_id = conversation.id
        and member.profile_id <> activity.creator_id
      order by member.profile_id
      limit 1
    ) as participant_id
  from public.activities as activity
  join public.conversations as conversation on conversation.activity_id = activity.id
  where activity.id::text like '30000000-0000-4000-8000-%'
)
insert into public.messages (
  id,
  conversation_id,
  sender_id,
  kind,
  body,
  client_nonce,
  created_at
)
select
  format(
    '61000000-0000-4000-8000-%s',
    lpad((seed.activity_no * 10 + message_no)::text, 12, '0')
  )::uuid,
  seed.conversation_id,
  case message_no when 1 then seed.creator_id else seed.participant_id end,
  'text',
  case message_no
    when 1 then '欢迎加入「' || seed.title || '」，请在群里说说你想负责的部分。'
    else '收到，我会提前到场，也可以协助准备物料。'
  end,
  format(
    '61100000-0000-4000-8000-%s',
    lpad((seed.activity_no * 10 + message_no)::text, 12, '0')
  )::uuid,
  timezone('utc', now()) - make_interval(days => 11, hours => 3 - message_no)
from seed_conversations as seed
cross join generate_series(1, 2) as seed_messages(message_no)
where seed.participant_id is not null
on conflict (id) do update
set
  conversation_id = excluded.conversation_id,
  sender_id = excluded.sender_id,
  kind = excluded.kind,
  body = excluded.body,
  client_nonce = excluded.client_nonce,
  created_at = excluded.created_at;

with seed_invitations as (
  select
    activity_no,
    activity_no as inviter_no,
    activity_no + 21 as invitee_no
  from generate_series(1, 6) as seed_activities(activity_no)
)
insert into public.activity_invitations (
  id,
  activity_id,
  inviter_id,
  invitee_id,
  status,
  created_at
)
select
  format('62000000-0000-4000-8000-%s', lpad(activity_no::text, 12, '0'))::uuid,
  format('30000000-0000-4000-8000-%s', lpad(activity_no::text, 12, '0'))::uuid,
  format('20000000-0000-4000-8000-%s', lpad(inviter_no::text, 12, '0'))::uuid,
  format('20000000-0000-4000-8000-%s', lpad(invitee_no::text, 12, '0'))::uuid,
  'pending',
  timezone('utc', now()) - interval '6 hours'
from seed_invitations
on conflict (id) do update
set
  inviter_id = excluded.inviter_id,
  invitee_id = excluded.invitee_id,
  status = excluded.status,
  responded_at = null,
  created_at = excluded.created_at;
