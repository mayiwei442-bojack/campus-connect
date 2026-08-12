import { ArrowLeft, Clock3, MapPin, ShieldCheck, UsersRound } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ActivityControls } from "@/components/activity/activity-controls";
import { getActivityDetail } from "@/lib/activity/queries";
import { getViewer } from "@/lib/auth/viewer";

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "待定";
}

export default async function ActivityPage({ params }: { params: Promise<{ activityId: string }> }) {
  const [viewer, route] = await Promise.all([getViewer(), params]);
  if (!viewer) redirect("/login");
  const activity = await getActivityDetail(route.activityId, viewer.id);
  if (!activity) notFound();
  const visibleMembers = activity.participants.filter((participant) => participant.status === "joined");
  const waitlisted = activity.participants.filter((participant) => participant.status === "waitlisted");

  return (
    <section className="mx-auto max-w-5xl rise-in">
      <Link href="/home" className="inline-flex items-center gap-2 text-xs font-bold text-forest/55 hover:text-forest"><ArrowLeft size={15} />返回活动列表</Link>
      <div className="mt-5 rounded-[2rem] border border-forest/10 bg-white/46 p-6 shadow-[0_24px_80px_rgba(20,35,31,0.07)] sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-signal">{activity.status} · {activity.joinMode === "approval" ? "需审批" : "自由加入"}</p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em] text-forest sm:text-5xl">{activity.title}</h1>
            {activity.description ? <p className="mt-5 max-w-3xl text-sm leading-7 text-forest/60">{activity.description}</p> : null}
          </div>
          <span className="grid size-14 place-items-center rounded-2xl bg-forest text-paper"><MapPin size={25} /></span>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <p className="rounded-xl bg-paper/65 p-3 text-xs text-forest/62"><MapPin size={15} className="mb-2 text-cobalt" />{activity.placeName}</p>
          <p className="rounded-xl bg-paper/65 p-3 text-xs text-forest/62"><Clock3 size={15} className="mb-2 text-cobalt" />{formatDate(activity.startsAt)}</p>
          <p className="rounded-xl bg-paper/65 p-3 text-xs text-forest/62"><UsersRound size={15} className="mb-2 text-cobalt" />{activity.joinedCount} / {activity.capacity ?? "不限"}</p>
          <p className="rounded-xl bg-paper/65 p-3 text-xs text-forest/62"><ShieldCheck size={15} className="mb-2 text-cobalt" />{activity.creatorName}</p>
        </div>
        <div className="mt-7"><ActivityControls activity={activity} viewerId={viewer.id} /></div>
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="rounded-[1.5rem] border border-forest/10 bg-white/42 p-5"><h2 className="font-display text-xl font-semibold text-forest">已加入 · {visibleMembers.length}</h2><div className="mt-4 flex flex-wrap gap-2">{visibleMembers.map((member) => <Link key={member.profileId} href={`/profile/${member.profileId}`} className="rounded-full border border-forest/10 bg-white/65 px-3 py-2 text-xs font-semibold text-forest">{member.nickname}</Link>)}</div></section>
        <section className="rounded-[1.5rem] border border-forest/10 bg-white/42 p-5"><h2 className="font-display text-xl font-semibold text-forest">候补 · {waitlisted.length}</h2><p className="mt-3 text-xs leading-6 text-forest/48">候补按事务生成的 FIFO 顺序晋升；只有本人和活动创建者能看到具体状态。</p></section>
      </div>
    </section>
  );
}
