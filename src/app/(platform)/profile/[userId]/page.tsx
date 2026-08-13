import type { Metadata } from "next";
import {
  Bot,
  CalendarClock,
  Eye,
  EyeOff,
  Layers3,
  MapPin,
  MessageCircle,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { notFound } from "next/navigation";

import { PersonaStudio } from "@/components/persona/persona-studio";
import { ProfileBackgroundUpload } from "@/components/profile/profile-background-upload";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { SkillManager } from "@/components/skill/skill-manager";
import { SkillShowcase } from "@/components/skill/skill-showcase";
import { getViewer } from "@/lib/auth/viewer";
import type { ProfileFormValues } from "@/lib/profile/action-state";
import type { PersonaItem } from "@/lib/persona/types";
import type { ProfileSkillItem } from "@/lib/skill/action-state";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "个人主页",
  description: "查看或编辑 Campus Connect 校园协作名片。",
};

type ProfilePageProps = {
  params: Promise<{ userId: string }>;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function profileNameBadgeClass(nickname: string) {
  const characterCount = Array.from(nickname.replace(/\s+/g, "")).length;

  if (characterCount <= 3) return "text-3xl";
  if (characterCount <= 6) return "text-xl";
  if (characterCount <= 12) return "text-base";
  return "text-xs";
}

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).format(new Date(value));
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const [{ userId }, viewer] = await Promise.all([params, getViewer()]);

  if (!viewer) {
    throw new Error("无法确认当前用户身份");
  }

  const targetUserId = userId === "me" ? viewer.id : userId;

  if (!UUID_PATTERN.test(targetUserId)) {
    notFound();
  }

  const supabase = await createClient();
  const [{ data: profile, error }, { data: profileSkillRows, error: skillError }, { data: personaRows, error: personaError }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id,nickname,avatar_path,campus,bio,is_public,allow_stranger_messages,allow_matching,updated_at",
      )
      .eq("id", targetUserId)
      .maybeSingle(),
    supabase
      .from("profile_skills")
      .select(
        "id,self_rating,note,is_public,allow_contact,allow_matching,skill:skills!profile_skills_skill_id_fkey(name,kind)",
      )
      .eq("profile_id", targetUserId)
      .order("created_at", { ascending: true }),
    supabase
      .from("personas")
      .select("id,slot,name,topic,summary,visibility,is_enabled,allow_matching")
      .eq("owner_id", targetUserId)
      .order("slot", { ascending: true }),
  ]);

  if (error) {
    throw new Error("个人资料暂时无法读取");
  }
  if (!profile) {
    notFound();
  }
  if (skillError) {
    throw new Error("Skill 暂时无法读取");
  }
  if (personaError) {
    throw new Error("Persona 暂时无法读取");
  }

  const { data: backgroundProfile } = await supabase
    .from("profiles")
    .select("background_path")
    .eq("id", targetUserId)
    .maybeSingle();
  const backgroundResult = backgroundProfile?.background_path
    ? await supabase.storage.from("profile-backgrounds").createSignedUrl(backgroundProfile.background_path, 1800)
    : null;
  const profileBackgroundUrl = backgroundResult?.data?.signedUrl ?? null;

  const isOwner = viewer.id === profile.id;
  const personaIds = (personaRows ?? []).map((persona) => persona.id);
  let entryRows: Array<{
    id: string;
    source_asset_id: string | null;
    kind: PersonaItem["entries"][number]["kind"];
    knowledge_key: string;
    content: string;
    status: PersonaItem["entries"][number]["status"];
    confirmed_at: string | null;
    persona_id: string;
  }> = [];
  let assetRows: Array<Omit<PersonaItem["assets"][number], "imageUrl"> & { persona_id: string }> = [];
  let topicRows: Array<PersonaItem["questionTopics"][number] & { persona_id: string }> = [];

  if (personaIds.length) {
    const entryQuery = supabase
      .from("persona_entries")
      .select("id,persona_id,source_asset_id,kind,knowledge_key,content,status,confirmed_at")
      .in("persona_id", personaIds)
      .order("created_at", { ascending: true });
    const [{ data: entries, error: entryError }, assetResult, topicResult] = await Promise.all([
      isOwner ? entryQuery : entryQuery.eq("status", "confirmed"),
      isOwner
        ? supabase
          .from("persona_assets")
          .select("id,persona_id,storage_path,mime_type,byte_size,user_description,is_visible,analysis_status,analysis_error,model_name")
          .in("persona_id", personaIds)
          .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      isOwner
        ? supabase
          .from("persona_question_topics")
          .select("id,persona_id,topic_key,topic_label,question_count")
          .in("persona_id", personaIds)
          .order("question_count", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (entryError || assetResult.error || topicResult.error) throw new Error("Persona 内容暂时无法读取");
    entryRows = entries ?? [];
    assetRows = assetResult.data ?? [];
    topicRows = topicResult.data ?? [];
  }

  const signedAssets = await Promise.all(assetRows.map(async (asset) => {
    const { data } = await supabase.storage.from("persona-assets").createSignedUrl(asset.storage_path, 1800);
    return { ...asset, imageUrl: data?.signedUrl ?? null };
  }));
  const personas: PersonaItem[] = (personaRows ?? []).map((persona) => ({
    ...persona,
    assets: signedAssets.filter((asset) => asset.persona_id === persona.id).map((asset) => ({
      id: asset.id,
      storage_path: asset.storage_path,
      mime_type: asset.mime_type,
      byte_size: asset.byte_size,
      user_description: asset.user_description,
      is_visible: asset.is_visible,
      analysis_status: asset.analysis_status,
      analysis_error: asset.analysis_error,
      model_name: asset.model_name,
      imageUrl: asset.imageUrl,
    })),
    entries: entryRows.filter((entry) => entry.persona_id === persona.id).map((entry) => ({
      id: entry.id,
      source_asset_id: entry.source_asset_id,
      kind: entry.kind,
      knowledge_key: entry.knowledge_key,
      content: entry.content,
      status: entry.status,
      confirmed_at: entry.confirmed_at,
    })),
    questionTopics: topicRows.filter((topic) => topic.persona_id === persona.id).map((topic) => ({
      id: topic.id,
      topic_key: topic.topic_key,
      topic_label: topic.topic_label,
      question_count: topic.question_count,
    })),
  }));
  const formValues: ProfileFormValues = {
    allowMatching: profile.allow_matching,
    allowStrangerMessages: profile.allow_stranger_messages,
    bio: profile.bio ?? "",
    campus: profile.campus ?? "",
    isPublic: profile.is_public,
    nickname: profile.nickname,
  };
  const profileSkills: ProfileSkillItem[] = (profileSkillRows ?? []).map((row) => ({
    allowContact: row.allow_contact,
    allowMatching: row.allow_matching,
    id: row.id,
    isPublic: row.is_public,
    kind: row.skill.kind,
    name: row.skill.name,
    note: row.note ?? "",
    selfRating: row.self_rating,
  }));

  return (
    <section className="rise-in space-y-6">
      <header className="grid gap-6 overflow-hidden rounded-[2rem] border border-forest/10 bg-white/45 p-5 shadow-[0_24px_90px_rgba(20,35,31,0.07)] sm:p-7 lg:grid-cols-[minmax(17rem,0.7fr)_minmax(0,1.3fr)] lg:p-8">
        <div
          className="relative min-h-72 overflow-hidden rounded-[1.6rem] bg-cobalt bg-cover bg-center p-6 text-white sm:p-7"
          style={profileBackgroundUrl ? { backgroundImage: `linear-gradient(180deg, rgba(9, 31, 46, 0.2), rgba(9, 31, 46, 0.56)), url(${profileBackgroundUrl})` } : undefined}
        >
          <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full border border-white/12" />
          <div className="pointer-events-none absolute -right-6 top-5 size-36 rounded-full border border-white/10" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#123b58]/70 to-transparent" />
          {isOwner ? <ProfileBackgroundUpload /> : null}
          <div className="relative flex h-full flex-col">
            <div className="flex items-center justify-between gap-4 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-white/58">
              <span>Campus identity</span>
              <span className={isOwner ? "pr-32" : undefined}>{isOwner ? "Owner copy" : "Public copy"}</span>
            </div>
            <div
              className={`mt-8 grid min-h-24 w-fit min-w-40 max-w-full place-items-center rounded-[1.7rem] border border-white/18 bg-white/10 px-5 text-center font-display font-semibold shadow-[0_18px_50px_rgba(9,31,46,0.22)] ${profileNameBadgeClass(profile.nickname)}`}
              title={profile.nickname}
            >
              <span className="whitespace-nowrap">{profile.nickname}</span>
            </div>
            <div className="relative mt-auto pt-10">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-skyline">Member record</p>
              <p className="mt-2 break-all font-mono text-[0.68rem] text-white/45">CC/{profile.id.slice(0, 8)}</p>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-between py-1 lg:py-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-signal/10 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-signal">
                Profile · P0
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.65rem] font-bold ${profile.is_public ? "bg-forest/7 text-forest" : "bg-forest/5 text-forest/48"}`}>
                {profile.is_public ? <Eye size={13} aria-hidden="true" /> : <EyeOff size={13} aria-hidden="true" />}
                {profile.is_public ? "资料公开" : "仅自己可见"}
              </span>
            </div>

            <p className="mt-7 text-xs font-bold uppercase tracking-[0.2em] text-forest/38">
              {isOwner ? "你的校园协作名片" : "一位真实的校园成员"}
            </p>
            <h1 className="mt-3 font-display text-5xl font-semibold tracking-[-0.05em] text-forest sm:text-6xl">
              {profile.nickname}
            </h1>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-forest/52">
              <span className="inline-flex items-center gap-2">
                <MapPin size={16} className="text-cobalt" aria-hidden="true" />
                {profile.campus || "尚未填写校园信息"}
              </span>
              <span className="inline-flex items-center gap-2">
                <CalendarClock size={16} className="text-cobalt" aria-hidden="true" />
                更新于 {formatUpdatedAt(profile.updated_at)}
              </span>
            </div>
            <p className="mt-7 max-w-3xl whitespace-pre-wrap text-base leading-8 text-forest/62">
              {profile.bio || (isOwner ? "写一段愿意公开的介绍，让未来的活动伙伴更容易理解你。" : "这位成员暂时没有公开个人简介。")}
            </p>
          </div>

          <div className="mt-8 flex items-start gap-3 border-t border-forest/8 pt-5 text-xs leading-6 text-forest/48">
            <ShieldCheck size={17} className="mt-0.5 shrink-0 text-forest" aria-hidden="true" />
            <p>{isOwner ? "只有你的登录身份可以提交修改，数据库 RLS 会再次校验资料所有权。" : "此页面只显示主人允许其他已登录成员查看的基础资料。"}</p>
          </div>
        </div>
      </header>

      {isOwner ? (
        <ProfileEditor initialValues={formValues} />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          <ConnectionStatus
            active={profile.allow_stranger_messages}
            description={profile.allow_stranger_messages ? "这位成员允许陌生人发起联系。" : "这位成员目前只接受已有关系中的消息。"}
            icon={MessageCircle}
            label="消息边界"
          />
          <ConnectionStatus
            active={profile.allow_matching}
            description={profile.allow_matching ? "可以出现在符合条件的协作匹配结果中。" : "目前不参与 AI 协作匹配。"}
            icon={Bot}
            label="匹配状态"
          />
        </div>
      )}

      <section className="overflow-hidden rounded-[1.9rem] border border-forest/10 bg-paper-deep/28 p-5 sm:p-7">
        <header className="mb-6 flex flex-col gap-4 border-b border-forest/8 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-signal">
              <Layers3 size={14} aria-hidden="true" />
              Skill coordinates
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.035em] text-forest sm:text-4xl">
              {isOwner ? "我的能力与兴趣坐标" : `${profile.nickname} 的公开 Skill`}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-forest/48">
              能力和兴趣属于同一个连接网络，但每一条都保留独立的公开、联系与匹配边界。
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-white/55 px-3.5 py-2 font-mono text-[0.65rem] font-bold uppercase tracking-[0.14em] text-forest/45">
            {profileSkills.length} coordinates
          </span>
        </header>
        {isOwner ? <SkillManager items={profileSkills} /> : <SkillShowcase items={profileSkills} />}
      </section>

      <PersonaStudio isOwner={isOwner} personas={personas} viewerId={viewer.id} />
    </section>
  );
}

type ConnectionStatusProps = {
  active: boolean;
  description: string;
  icon: typeof UserRound;
  label: string;
};

function ConnectionStatus({ active, description, icon: Icon, label }: ConnectionStatusProps) {
  return (
    <div className="flex items-start gap-4 rounded-[1.45rem] border border-forest/10 bg-white/46 p-5">
      <span className={`grid size-11 shrink-0 place-items-center rounded-[1rem] ${active ? "bg-forest text-paper" : "bg-forest/6 text-forest/38"}`}>
        <Icon size={19} aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm font-bold text-forest">{label}</p>
        <p className="mt-1.5 text-xs leading-6 text-forest/48">{description}</p>
      </div>
    </div>
  );
}
