"use client";

import { CalendarClock, MapPin, Plus, UsersRound } from "lucide-react";
import { useActionState, useRef } from "react";

import { createActivityAction, type CreateActivityState } from "@/app/(platform)/activities/actions";

type PlaceOption = { id: string; displayName: string };
const initialState: CreateActivityState = { message: "", status: "idle" };

export function ActivityComposer({ places, initialPlaceId, initialTitle, invitee }: { places: PlaceOption[]; initialPlaceId?: string; initialTitle?: string; invitee?: { id: string; nickname: string } | null }) {
  const [state, formAction, pending] = useActionState(createActivityAction, initialState);
  const timezoneOffsetRef = useRef<HTMLInputElement>(null);

  function captureTimezone() {
    if (timezoneOffsetRef.current) timezoneOffsetRef.current.value = String(new Date().getTimezoneOffset());
  }

  return (
    <form action={formAction} onSubmit={captureTimezone} className="rounded-[1.7rem] border border-forest/10 bg-white/48 p-5 shadow-[0_18px_55px_rgba(20,35,31,0.06)] sm:p-6">
      <input ref={timezoneOffsetRef} type="hidden" name="timezoneOffset" defaultValue="0" />
      {invitee ? <input type="hidden" name="inviteeId" value={invitee.id} /> : null}
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-signal text-white"><Plus size={19} aria-hidden="true" /></span>
        <div>
          <p className="text-[0.64rem] font-bold uppercase tracking-[0.2em] text-signal">Create activity</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-forest">发起一件真实可参与的事</h2>
        </div>
      </div>

      {invitee ? <p className="mt-5 rounded-xl border border-cobalt/15 bg-cobalt/6 px-4 py-3 text-sm font-semibold text-cobalt">创建成功后会同时向 {invitee.nickname} 发送活动邀请；提交时会再次检查匹配与屏蔽状态。</p> : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="text-xs font-bold text-forest/60">活动标题</span>
          <input name="title" defaultValue={initialTitle} required minLength={2} maxLength={80} placeholder="例如：图书馆两小时产品冲刺" className="mt-2 w-full rounded-xl border border-forest/12 bg-white/70 px-4 py-3 text-sm text-forest" />
        </label>
        <label>
          <span className="flex items-center gap-2 text-xs font-bold text-forest/60"><MapPin size={14} />地点</span>
          <select name="placeId" defaultValue={initialPlaceId ?? ""} required className="mt-2 w-full rounded-xl border border-forest/12 bg-white/70 px-4 py-3 text-sm text-forest">
            <option value="" disabled>选择 GLB 地点</option>
            {places.map((place) => <option key={place.id} value={place.id}>{place.displayName}</option>)}
          </select>
        </label>
        <label>
          <span className="flex items-center gap-2 text-xs font-bold text-forest/60"><UsersRound size={14} />人数上限</span>
          <input name="capacity" type="number" min={1} max={500} placeholder="留空表示不限" className="mt-2 w-full rounded-xl border border-forest/12 bg-white/70 px-4 py-3 text-sm text-forest" />
        </label>
        <label>
          <span className="flex items-center gap-2 text-xs font-bold text-forest/60"><CalendarClock size={14} />开始时间</span>
          <input name="startsAt" type="datetime-local" className="mt-2 w-full rounded-xl border border-forest/12 bg-white/70 px-4 py-3 text-sm text-forest" />
        </label>
        <label>
          <span className="flex items-center gap-2 text-xs font-bold text-forest/60"><CalendarClock size={14} />结束时间</span>
          <input name="endsAt" type="datetime-local" className="mt-2 w-full rounded-xl border border-forest/12 bg-white/70 px-4 py-3 text-sm text-forest" />
        </label>
        <fieldset className="sm:col-span-2">
          <legend className="text-xs font-bold text-forest/60">加入方式</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="rounded-xl border border-forest/10 bg-white/55 p-3 text-sm text-forest"><input type="radio" name="joinMode" value="free" defaultChecked className="mr-2" />有空位直接加入</label>
            <label className="rounded-xl border border-forest/10 bg-white/55 p-3 text-sm text-forest"><input type="radio" name="joinMode" value="approval" className="mr-2" />由发起者审批</label>
          </div>
        </fieldset>
        <label className="sm:col-span-2">
          <span className="text-xs font-bold text-forest/60">活动说明</span>
          <textarea name="description" maxLength={1000} rows={4} placeholder="说明目标、准备事项或集合方式" className="mt-2 w-full resize-y rounded-xl border border-forest/12 bg-white/70 px-4 py-3 text-sm leading-6 text-forest" />
        </label>
      </div>

      {state.status === "error" ? <p role="alert" className="mt-4 text-sm font-semibold text-signal">{state.message}</p> : null}
      <button type="submit" disabled={pending} className="mt-5 inline-flex items-center gap-2 rounded-full bg-forest px-5 py-3 text-sm font-bold text-paper disabled:opacity-45">
        <Plus size={16} aria-hidden="true" />{pending ? "正在创建…" : "创建活动"}
      </button>
    </form>
  );
}
