import { ArrowUpRight, Clock3, MapPin, ShieldCheck, UsersRound } from "lucide-react";
import Link from "next/link";

import type { ActivitySummary } from "@/lib/activity/types";

const statusLabels = {
  pending: "等待审批",
  joined: "已加入",
  waitlisted: "候补中",
  left: "已退出",
  removed: "已移除",
  rejected: "未通过",
} as const;

function formatTime(value: string | null) {
  if (!value) return "时间待定";
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai" }).format(new Date(value));
}

export function ActivityCard({ activity }: { activity: ActivitySummary }) {
  const full = activity.capacity !== null && activity.joinedCount >= activity.capacity;
  return (
    <Link href={`/activities/${activity.id}`} className="group block rounded-[1.45rem] border border-forest/10 bg-white/48 p-5 transition hover:-translate-y-1 hover:bg-white/75 hover:shadow-[0_18px_50px_rgba(20,35,31,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-forest px-3 py-1 text-[0.64rem] font-bold uppercase tracking-[0.1em] text-paper">{activity.joinMode === "approval" ? "需审批" : "自由加入"}</span>
          {activity.viewerStatus ? <span className="rounded-full bg-skyline/25 px-3 py-1 text-[0.64rem] font-bold text-cobalt">{statusLabels[activity.viewerStatus]}</span> : null}
        </div>
        <ArrowUpRight size={18} className="text-forest/30 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </div>
      <h3 className="mt-5 font-display text-xl font-semibold text-forest">{activity.title}</h3>
      {activity.description ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-forest/55">{activity.description}</p> : null}
      <div className="mt-5 grid gap-2 text-xs font-medium text-forest/52">
        <p className="flex items-center gap-2"><MapPin size={14} />{activity.placeName}</p>
        <p className="flex items-center gap-2"><Clock3 size={14} />{formatTime(activity.startsAt)}</p>
        <p className="flex items-center gap-2"><UsersRound size={14} />{activity.joinedCount} / {activity.capacity ?? "不限"}{full ? " · 已满，加入候补" : ""}</p>
        <p className="flex items-center gap-2"><ShieldCheck size={14} />发起者：{activity.creatorName}</p>
      </div>
    </Link>
  );
}
