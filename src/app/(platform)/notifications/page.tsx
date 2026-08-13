import type { Metadata } from "next";
import { Bell, CheckCircle2, Clock3, MapPin, UserRoundPlus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { InvitationResponseControls } from "@/components/notifications/invitation-response-controls";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "站内通知",
  description: "查看并响应活动邀请。",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

export default async function NotificationsPage() {
  const [viewer, supabase] = await Promise.all([getViewer(), createClient()]);
  if (!viewer) redirect("/login");

  const { data: rows, error } = await supabase
    .from("activity_invitations")
    .select("id,activity_id,inviter_id,status,responded_at,created_at")
    .eq("invitee_id", viewer.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("活动邀请暂时无法读取");

  const activityIds = [...new Set((rows ?? []).map((row) => row.activity_id))];
  const inviterIds = [...new Set((rows ?? []).map((row) => row.inviter_id))];
  const [{ data: activities, error: activityError }, { data: inviters, error: inviterError }] = await Promise.all([
    activityIds.length
      ? supabase.from("activities").select("id,title,place_id,starts_at,status").in("id", activityIds)
      : Promise.resolve({ data: [], error: null }),
    inviterIds.length
      ? supabase.from("profiles").select("id,nickname").in("id", inviterIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (activityError || inviterError) throw new Error("邀请关联信息暂时无法读取");

  const activityById = new Map((activities ?? []).map((activity) => [activity.id, activity]));
  const inviterById = new Map((inviters ?? []).map((inviter) => [inviter.id, inviter.nickname]));
  const invitations = (rows ?? []).map((row) => ({
    ...row,
    activity: activityById.get(row.activity_id),
    inviterName: inviterById.get(row.inviter_id) ?? "Campus member",
  }));
  const pending = invitations.filter((invitation) => invitation.status === "pending");
  const history = invitations.filter((invitation) => invitation.status !== "pending");

  return (
    <section className="rise-in space-y-6">
      <header className="campus-grid overflow-hidden rounded-[2rem] p-6 text-paper shadow-[0_24px_80px_rgba(20,60,50,0.16)] sm:p-8">
        <p className="flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.22em] text-paper/55"><Bell size={16} />Invitation inbox</p>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">把一次推荐，变成真正的共同活动。</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-paper/62">活动邀请只有被邀请者本人可以响应；接受后，数据库会按容量规则加入活动，并在成功加入时开放临时群聊。</p>
      </header>

      <section className="rounded-[1.7rem] border border-forest/10 bg-white/46 p-5 sm:p-6">
        <div className="flex items-end justify-between gap-3">
          <div><p className="text-[0.64rem] font-bold uppercase tracking-[0.2em] text-signal">Pending</p><h2 className="mt-2 font-display text-3xl font-semibold text-forest">待响应邀请</h2></div>
          <span className="rounded-full bg-forest/7 px-3 py-2 text-xs font-bold text-forest/55">{pending.length} 条</span>
        </div>
        {pending.length ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {pending.map((invitation) => (
              <article key={invitation.id} className="rounded-[1.45rem] border border-forest/10 bg-paper/55 p-5">
                <p className="flex items-center gap-2 text-xs font-bold text-cobalt"><UserRoundPlus size={15} />{invitation.inviterName} 邀请你参加</p>
                <h3 className="mt-3 font-display text-2xl font-semibold text-forest">{invitation.activity?.title ?? "活动已不可用"}</h3>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-forest/50">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/65 px-3 py-2"><MapPin size={13} />{invitation.activity?.place_id ?? "地点待确认"}</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/65 px-3 py-2"><Clock3 size={13} />{invitation.activity?.starts_at ? formatDate(invitation.activity.starts_at) : "时间待定"}</span>
                </div>
                <div className="mt-5 border-t border-forest/8 pt-4">
                  {invitation.activity ? <InvitationResponseControls invitationId={invitation.id} /> : <p className="text-xs font-semibold text-signal">活动已不可响应。</p>}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-[1.4rem] border border-dashed border-forest/15 bg-paper/35 p-8 text-center">
            <CheckCircle2 className="mx-auto text-forest/24" size={30} />
            <p className="mt-3 text-sm font-semibold text-forest/55">当前没有等待处理的活动邀请。</p>
          </div>
        )}
      </section>

      {history.length ? (
        <section className="rounded-[1.7rem] border border-forest/10 bg-white/36 p-5 sm:p-6">
          <p className="text-[0.64rem] font-bold uppercase tracking-[0.2em] text-forest/38">Recent history</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-forest">最近处理</h2>
          <div className="mt-4 divide-y divide-forest/8">
            {history.map((invitation) => (
              <div key={invitation.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <span className="font-semibold text-forest">{invitation.activity?.title ?? "已失效活动"}</span>
                <span className="rounded-full bg-forest/7 px-2.5 py-1 text-[0.65rem] font-bold text-forest/50">{invitation.status === "accepted" ? "已接受" : invitation.status === "declined" ? "已婉拒" : "已取消"}</span>
                {invitation.status === "accepted" && invitation.activity ? <Link href={`/activities/${invitation.activity_id}`} className="ml-auto text-xs font-bold text-cobalt hover:underline">查看活动</Link> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
