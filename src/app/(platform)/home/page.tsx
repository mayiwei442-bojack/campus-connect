import type { Metadata } from "next";
import { MoveUpRight, Plus, Radio } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ActivityCard } from "@/components/activity/activity-card";
import { IntentComposer } from "@/components/intent-composer";
import { listActivities } from "@/lib/activity/queries";
import { getViewer } from "@/lib/auth/viewer";

export const metadata: Metadata = { title: "首页", description: "表达真实需求，发现校园里正在发生的活动。" };

export default async function HomePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const activities = await listActivities(viewer.id);

  return (
    <div>
      <section className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(26rem,0.82fr)]">
        <div className="rise-in rounded-[2rem] border border-forest/10 bg-white/38 p-5 shadow-[0_24px_90px_rgba(20,35,31,0.06)] sm:p-8 lg:p-10">
          <div className="flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.22em] text-signal"><Radio size={15} />Campus intent station</div>
          <h1 className="mt-5 max-w-3xl font-display text-[2.75rem] font-semibold leading-[1.08] tracking-[-0.055em] text-forest sm:text-6xl lg:text-[4.4rem]">今天想一起<span className="relative mx-2 inline-block text-signal">做什么？</span></h1>
          <p className="mt-6 max-w-2xl text-sm leading-7 text-forest/58 sm:text-base sm:leading-8">先说出真实意图，再让 Campus Connect 把人、Skill、活动与校园空间连接起来。</p>
          <IntentComposer />
        </div>

        <Link href="/map" className="campus-grid rise-in rise-in-delay-1 group relative min-h-[30rem] overflow-hidden rounded-[2rem] p-6 text-paper shadow-[0_28px_90px_rgba(20,60,50,0.2)] sm:p-8">
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d2d25] via-transparent to-transparent" />
          <div className="absolute left-[18%] top-[32%] h-16 w-24 -skew-y-6 rounded-sm border border-white/16 bg-white/8 shadow-[12px_14px_0_rgba(7,28,23,0.32)]" />
          <div className="absolute right-[18%] top-[21%] h-24 w-20 skew-y-6 rounded-sm border border-white/16 bg-white/8 shadow-[-10px_16px_0_rgba(7,28,23,0.26)]" />
          <div className="relative flex h-full min-h-[26rem] flex-col justify-between">
            <div className="flex items-start justify-between gap-4"><div><p className="text-[0.66rem] font-bold uppercase tracking-[0.22em] text-paper/48">Live campus map</p><h2 className="mt-3 font-display text-3xl font-semibold">校园正在发生什么</h2></div><span className="grid size-11 place-items-center rounded-full border border-white/15 bg-white/8 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1"><MoveUpRight size={20} /></span></div>
            <div><p className="mb-4 inline-flex rounded-full border border-white/12 bg-black/12 px-3 py-2 text-xs font-semibold">{activities.length} 个可参与活动 · 动态 Beacon</p><p className="max-w-md text-sm leading-7 text-paper/64">地图 Beacon 直接由真实 Activity 与 Place Anchor 派生，不维护重复的 Beacon 数据。</p></div>
          </div>
        </Link>
      </section>

      <section className="rise-in rise-in-delay-2 mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[0.66rem] font-bold uppercase tracking-[0.2em] text-cobalt">Live activities</p><h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em] text-forest">正在发生</h2></div><Link href="/activities/new" className="inline-flex items-center gap-2 rounded-full bg-forest px-4 py-2.5 text-xs font-bold text-paper"><Plus size={15} />创建活动</Link></div>
        {activities.length ? <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{activities.slice(0, 9).map((activity) => <ActivityCard key={activity.id} activity={activity} />)}</div> : <div className="mt-5 rounded-[1.5rem] border border-dashed border-forest/15 bg-white/30 p-10 text-center"><p className="font-display text-2xl font-semibold text-forest">校园还很安静</p><p className="mt-2 text-sm text-forest/50">创建第一个真实活动，它会立即出现在 Home 与地图 Anchor 上。</p></div>}
      </section>
    </div>
  );
}
