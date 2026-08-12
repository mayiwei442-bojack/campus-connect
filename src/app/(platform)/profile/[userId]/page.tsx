import type { Metadata } from "next";
import { BadgeCheck, ShieldCheck, UserRound } from "lucide-react";

import { ModulePlaceholder } from "@/components/module-placeholder";
import { getViewer } from "@/lib/auth/viewer";

export const metadata: Metadata = {
  title: "个人主页",
  description: "展示个人资料、Skill、共同经历与授权 Persona。",
};

type ProfilePageProps = {
  params: Promise<{ userId: string }>;
};

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { userId } = await params;
  const isSelf = userId === "me";
  const viewer = isSelf ? await getViewer() : null;
  const displayName = viewer?.nickname ?? (isSelf ? "你的公开主页" : `用户 ${userId}`);

  return (
    <ModulePlaceholder
      eyebrow="Module 04 · Profile / Persona"
      title={isSelf ? "我的校园协作名片" : "了解这个人，再决定如何连接"}
      description="个人主页将组合基础资料、Skill、共同经历和最多三个授权 Persona。普通资料独立加载，不等待 AI 回答。"
      nextMilestone="先完成 Profile 与 Skill 数据权限，再实现 Persona 的授权知识与拒答边界。"
      icon={UserRound}
    >
      <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
        <div className="grid size-24 place-items-center rounded-[1.5rem] bg-cobalt font-display text-2xl font-bold text-white">
          {viewer?.initials ?? (isSelf ? "CC" : userId.slice(0, 2).toUpperCase())}
        </div>
        <div className="rounded-[1.35rem] border border-forest/8 bg-paper/48 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-semibold text-forest">{displayName}</h2>
            <BadgeCheck size={18} className="text-cobalt" aria-hidden="true" />
          </div>
          <p className="mt-2 text-sm leading-7 text-forest/48">
            {viewer ? "昵称来自受 RLS 保护的 Profile；Skill 与 Persona 将在后续板块接入。" : "当前只能查看允许公开展示的基础资料。"}
          </p>
        </div>
        <div className="sm:col-span-2 grid gap-3 sm:grid-cols-3">
          {["Skill", "共同经历", "Persona · 最多 3 个"].map((item) => (
            <div key={item} className="rounded-xl border border-forest/8 bg-white/38 p-4 text-sm font-semibold text-forest/58">
              {item}
            </div>
          ))}
        </div>
        <div className="sm:col-span-2 flex items-start gap-3 rounded-xl bg-forest/6 p-4 text-xs leading-6 text-forest/56">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-forest" aria-hidden="true" />
          Persona 只能使用主人明确授权的信息；没有依据时必须拒绝代答。
        </div>
      </div>
    </ModulePlaceholder>
  );
}
