import type { Metadata } from "next";
import { ArrowDown, Braces, Database, Sparkles } from "lucide-react";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = {
  title: "AI 共创",
  description: "将自然语言需求转换为可执行的校园连接。",
};

type ConnectPageProps = {
  searchParams: Promise<{ intent?: string | string[] }>;
};

export default async function ConnectPage({ searchParams }: ConnectPageProps) {
  const parameters = await searchParams;
  const intent = Array.isArray(parameters.intent) ? parameters.intent[0] : parameters.intent;

  return (
    <ModulePlaceholder
      eyebrow="Module 02 · Connect"
      title="AI 理解意图，程序负责执行规则"
      description="这里将承接首页输入，先由 DeepSeek 输出结构化需求，再由数据库过滤、召回和排序符合权限规则的用户与 Skill。"
      nextMilestone="完成 Supabase 基础后，再接入服务端意图解析与确定性匹配管线。"
      icon={Sparkles}
    >
      <div className="flex h-full min-h-64 flex-col justify-center">
        {intent ? (
          <div className="rounded-[1.25rem] border border-signal/18 bg-signal/7 p-5">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-signal">来自首页的需求</p>
            <blockquote className="mt-3 font-display text-xl font-semibold leading-relaxed text-forest">“{intent}”</blockquote>
          </div>
        ) : (
          <p className="rounded-[1.25rem] border border-forest/8 bg-paper/60 p-5 text-sm leading-7 text-forest/54">
            从首页提交一条真实需求后，它会安全地以查询参数进入此页；当前不会发送到任何 AI 服务。
          </p>
        )}

        <div className="mt-5 grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
          <div className="rounded-xl border border-forest/8 p-4 text-center">
            <Braces size={20} className="mx-auto text-cobalt" aria-hidden="true" />
            <p className="mt-2 text-xs font-bold text-forest">结构化意图</p>
          </div>
          <ArrowDown className="mx-auto text-forest/28 sm:-rotate-90" size={18} aria-hidden="true" />
          <div className="rounded-xl border border-forest/8 p-4 text-center">
            <Database size={20} className="mx-auto text-cobalt" aria-hidden="true" />
            <p className="mt-2 text-xs font-bold text-forest">规则过滤</p>
          </div>
          <ArrowDown className="mx-auto text-forest/28 sm:-rotate-90" size={18} aria-hidden="true" />
          <div className="rounded-xl border border-forest/8 p-4 text-center">
            <Sparkles size={20} className="mx-auto text-signal" aria-hidden="true" />
            <p className="mt-2 text-xs font-bold text-forest">可核验解释</p>
          </div>
        </div>
      </div>
    </ModulePlaceholder>
  );
}
