import type { Metadata } from "next";
import { MessageCircle, Search } from "lucide-react";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = {
  title: "消息",
  description: "好友与临时连接的沟通协作空间。",
};

export default function MessagesPage() {
  return (
    <ModulePlaceholder
      eyebrow="Module 03 · Messages"
      title="让已经发生的连接继续发展"
      description="桌面端采用会话列表与当前会话双栏结构。正式实现将同时支持好友私聊、Activity 临时群聊、历史消息和归档会话。"
      nextMilestone="在聊天板块接入 Conversation、Message、Storage 与 Supabase Realtime。"
      icon={MessageCircle}
    >
      <div className="grid min-h-64 gap-4 sm:grid-cols-[0.72fr_1.28fr]">
        <div className="rounded-[1.2rem] border border-forest/8 bg-paper/46 p-4">
          <div className="flex items-center gap-2 rounded-full bg-white/65 px-3 py-2 text-xs text-forest/38">
            <Search size={14} aria-hidden="true" />
            搜索会话
          </div>
          <div className="mt-4 space-y-3">
            {["Activity 临时群聊", "好友会话", "Team 协作会话"].map((item, index) => (
              <div key={item} className={`rounded-xl p-3 ${index === 0 ? "bg-forest text-paper" : "bg-white/45 text-forest/55"}`}>
                <div className="flex items-center gap-3">
                  <span className={`size-8 rounded-full ${index === 0 ? "bg-signal" : "bg-forest/10"}`} />
                  <span className="text-xs font-semibold">{item}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-center rounded-[1.2rem] border border-dashed border-forest/14 bg-white/28 p-6 text-center">
          <div>
            <MessageCircle size={30} className="mx-auto text-forest/28" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-forest/52">会话内容区</p>
            <p className="mt-2 text-xs leading-6 text-forest/38">当前只有布局边界，不保存或模拟私人消息。</p>
          </div>
        </div>
      </div>
    </ModulePlaceholder>
  );
}
