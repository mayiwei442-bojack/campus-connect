"use client";

import { Check, DoorOpen, MessageCircle, OctagonX, UserRoundPlus, X } from "lucide-react";
import Link from "next/link";
import { useFormStatus } from "react-dom";

import {
  endActivityAction,
  joinActivityAction,
  leaveActivityAction,
  removeActivityMemberAction,
  reviewActivityRequestAction,
} from "@/app/(platform)/activities/actions";
import type { ActivityDetail } from "@/lib/activity/types";

function SubmitButton({ children, tone = "forest" }: { children: React.ReactNode; tone?: "forest" | "signal" | "plain" }) {
  const { pending } = useFormStatus();
  const toneClass = tone === "signal" ? "bg-signal text-white" : tone === "plain" ? "border border-forest/12 bg-white/55 text-forest" : "bg-forest text-paper";
  return <button disabled={pending} className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold disabled:opacity-40 ${toneClass}`}>{pending ? "处理中…" : children}</button>;
}

export function ActivityControls({ activity, viewerId }: { activity: ActivityDetail; viewerId: string }) {
  const isCreator = activity.creatorId === viewerId;
  const active = activity.status === "active" || activity.status === "scheduled";
  const pending = activity.participants.filter((participant) => participant.status === "pending");
  const canOpenChat = activity.viewerStatus === "joined" && activity.conversationId;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {canOpenChat ? <Link href={`/messages?conversation=${activity.conversationId}`} className="inline-flex items-center gap-2 rounded-full bg-cobalt px-4 py-2.5 text-xs font-bold text-white"><MessageCircle size={15} />进入活动群聊</Link> : null}
        {active && !isCreator && !["joined", "pending", "waitlisted"].includes(activity.viewerStatus ?? "") ? (
          <form action={joinActivityAction}><input type="hidden" name="activityId" value={activity.id} /><SubmitButton><UserRoundPlus size={15} />{activity.joinMode === "approval" ? "申请加入" : "加入活动"}</SubmitButton></form>
        ) : null}
        {active && !isCreator && ["joined", "pending", "waitlisted"].includes(activity.viewerStatus ?? "") ? (
          <form action={leaveActivityAction}><input type="hidden" name="activityId" value={activity.id} /><SubmitButton tone="plain"><DoorOpen size={15} />退出活动</SubmitButton></form>
        ) : null}
        {active && isCreator ? (
          <form action={endActivityAction}><input type="hidden" name="activityId" value={activity.id} /><SubmitButton tone="signal"><OctagonX size={15} />结束并归档活动</SubmitButton></form>
        ) : null}
      </div>

      {isCreator && pending.length ? (
        <section className="rounded-[1.25rem] border border-signal/20 bg-signal/[0.055] p-4">
          <h2 className="text-sm font-bold text-forest">待审批申请 · {pending.length}</h2>
          <div className="mt-3 space-y-2">
            {pending.map((participant) => (
              <div key={participant.profileId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/60 p-3">
                <Link href={`/profile/${participant.profileId}`} className="text-sm font-semibold text-forest hover:underline">{participant.nickname}</Link>
                <div className="flex gap-2">
                  <form action={reviewActivityRequestAction}><input type="hidden" name="activityId" value={activity.id} /><input type="hidden" name="profileId" value={participant.profileId} /><input type="hidden" name="decision" value="approve" /><SubmitButton><Check size={14} />通过</SubmitButton></form>
                  <form action={reviewActivityRequestAction}><input type="hidden" name="activityId" value={activity.id} /><input type="hidden" name="profileId" value={participant.profileId} /><input type="hidden" name="decision" value="reject" /><SubmitButton tone="plain"><X size={14} />拒绝</SubmitButton></form>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {isCreator && active ? (
        <section className="rounded-[1.25rem] border border-forest/10 bg-paper/45 p-4">
          <h2 className="text-sm font-bold text-forest">成员管理</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {activity.participants.filter((participant) => participant.status === "joined" && participant.profileId !== viewerId).map((participant) => (
              <form action={removeActivityMemberAction} key={participant.profileId} className="flex items-center gap-2 rounded-full bg-white/65 py-1.5 pl-3 pr-1.5">
                <input type="hidden" name="activityId" value={activity.id} />
                <input type="hidden" name="profileId" value={participant.profileId} />
                <span className="text-xs font-semibold text-forest">{participant.nickname}</span>
                <button className="grid size-7 place-items-center rounded-full text-forest/45 hover:bg-signal hover:text-white" aria-label={`移除 ${participant.nickname}`}><X size={13} /></button>
              </form>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
