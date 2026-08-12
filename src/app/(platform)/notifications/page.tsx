import type { Metadata } from "next";
import { Bell, CheckCircle2 } from "lucide-react";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = {
  title: "站内通知",
  description: "查看好友申请、活动审批与组队邀请。",
};

export default function NotificationsPage() {
  return (
    <ModulePlaceholder
      eyebrow="System · Notifications"
      title="重要变化，只在需要时抵达"
      description="MVP 使用站内通知承载好友申请、Activity 审批、候补变化与组队邀请，不提前引入 Push、短信或邮件。"
      nextMilestone="在数据库板块定义通知模型，在对应业务模块逐步接入事件。"
      icon={Bell}
    >
      <div className="space-y-3">
        {["好友申请与验证消息", "Activity 申请 / 审批 / 候补", "Team 与协作邀请"].map((item) => (
          <div key={item} className="flex items-center gap-3 rounded-[1.1rem] border border-forest/8 bg-paper/48 p-4">
            <span className="grid size-9 place-items-center rounded-full bg-forest/7 text-forest">
              <CheckCircle2 size={17} aria-hidden="true" />
            </span>
            <span className="text-sm font-semibold text-forest/62">{item}</span>
            <span className="ml-auto rounded-full bg-white/55 px-2.5 py-1 text-[0.62rem] font-bold text-forest/38">待接入</span>
          </div>
        ))}
      </div>
    </ModulePlaceholder>
  );
}
