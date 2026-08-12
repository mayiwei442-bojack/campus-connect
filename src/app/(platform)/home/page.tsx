import type { Metadata } from "next";
import { ArrowRight, Clock3, MapPin, MoveUpRight, Radio, UsersRound } from "lucide-react";
import Link from "next/link";

import { IntentComposer } from "@/components/intent-composer";

export const metadata: Metadata = {
  title: "首页",
  description: "表达真实需求，发现校园里正在发生的活动。",
};

const activityPreviews = [
  {
    title: "五人制随便踢",
    place: "足球场 01",
    time: "今晚 19:30",
    people: "4 / 6 人",
    accent: "bg-signal",
  },
  {
    title: "六级自习小队",
    place: "图书馆",
    time: "20:00–22:00",
    people: "3 / 5 人",
    accent: "bg-cobalt",
  },
  {
    title: "AI 比赛路演互评",
    place: "教学楼 03",
    time: "明天 14:00",
    people: "2 / 4 人",
    accent: "bg-[#b18a3a]",
  },
];

export default function HomePage() {
  return (
    <div>
      <section className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(26rem,0.82fr)]">
        <div className="rise-in rounded-[2rem] border border-forest/10 bg-white/38 p-5 shadow-[0_24px_90px_rgba(20,35,31,0.06)] sm:p-8 lg:p-10">
          <div className="flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.22em] text-signal">
            <Radio size={15} aria-hidden="true" />
            Campus intent station
          </div>
          <h1 className="mt-5 max-w-3xl font-display text-[2.75rem] font-semibold leading-[1.08] tracking-[-0.055em] text-forest sm:text-6xl lg:text-[4.4rem]">
            今天想一起
            <span className="relative mx-2 inline-block text-signal">
              做什么
              <svg
                viewBox="0 0 210 20"
                className="absolute -bottom-2 left-0 w-full"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path d="M4 12C52 3 144 3 206 10" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </span>
            ？
          </h1>
          <p className="mt-6 max-w-2xl text-sm leading-7 text-forest/58 sm:text-base sm:leading-8">
            不用先决定找搭子、找队友还是找活动。说出真实意图，Campus Connect
            将把需求带到合适的人、Skill 与校园场景。
          </p>
          <IntentComposer />
        </div>

        <Link
          href="/map"
          className="campus-grid rise-in rise-in-delay-1 group relative min-h-[30rem] overflow-hidden rounded-[2rem] p-6 text-paper shadow-[0_28px_90px_rgba(20,60,50,0.2)] sm:p-8"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d2d25] via-transparent to-transparent" />
          <div className="absolute left-[18%] top-[32%] h-16 w-24 -skew-y-6 rounded-sm border border-white/16 bg-white/8 shadow-[12px_14px_0_rgba(7,28,23,0.32)]" />
          <div className="absolute right-[18%] top-[21%] h-24 w-20 skew-y-6 rounded-sm border border-white/16 bg-white/8 shadow-[-10px_16px_0_rgba(7,28,23,0.26)]" />
          <div className="absolute left-[43%] top-[48%] h-12 w-32 rotate-6 rounded-full border border-skyline/35 bg-skyline/12" />

          <div className="absolute left-[25%] top-[25%]">
            <span className="signal-ring absolute -inset-4 rounded-full border border-signal" />
            <span className="relative block size-3 rounded-full bg-signal shadow-[0_0_18px_5px_rgba(227,87,45,0.35)]" />
          </div>
          <div className="absolute right-[29%] top-[43%]">
            <span className="signal-ring absolute -inset-3 rounded-full border border-skyline [animation-delay:700ms]" />
            <span className="relative block size-2.5 rounded-full bg-skyline shadow-[0_0_18px_4px_rgba(141,185,199,0.3)]" />
          </div>

          <div className="relative flex h-full min-h-[26rem] flex-col justify-between">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.66rem] font-bold uppercase tracking-[0.22em] text-paper/48">Live campus map</p>
                <h2 className="mt-3 font-display text-3xl font-semibold">校园正在发生什么</h2>
              </div>
              <span className="grid size-11 place-items-center rounded-full border border-white/15 bg-white/8 transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1">
                <MoveUpRight size={20} aria-hidden="true" />
              </span>
            </div>

            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/12 px-3 py-2 text-xs font-semibold backdrop-blur-md">
                <span className="size-2 rounded-full bg-signal" />
                GLB 已入库 · 场景渲染待接入
              </div>
              <p className="max-w-md text-sm leading-7 text-paper/64">
                地图不是定位工具，而是将 Place、Activity 和实时连接放在同一个校园空间中。
              </p>
            </div>
          </div>
        </Link>
      </section>

      <section className="rise-in rise-in-delay-2 mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[0.66rem] font-bold uppercase tracking-[0.2em] text-cobalt">Activity preview</p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em] text-forest">正在发生</h2>
          </div>
          <div className="rounded-full border border-forest/10 px-3 py-2 text-xs text-forest/48">
            界面样例 · 静态数据
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {activityPreviews.map((activity) => (
            <article
              key={activity.title}
              className="group rounded-[1.55rem] border border-forest/10 bg-white/42 p-5 transition-all duration-300 hover:-translate-y-1 hover:bg-white/68 hover:shadow-[0_18px_50px_rgba(20,35,31,0.08)]"
            >
              <div className="flex items-center justify-between gap-3">
                <span className={`size-2.5 rounded-full ${activity.accent}`} />
                <ArrowRight size={18} className="text-forest/28 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </div>
              <h3 className="mt-6 font-display text-xl font-semibold text-forest">{activity.title}</h3>
              <div className="mt-5 space-y-2.5 text-xs font-medium text-forest/52">
                <p className="flex items-center gap-2">
                  <MapPin size={15} aria-hidden="true" />
                  {activity.place}
                </p>
                <p className="flex items-center gap-2">
                  <Clock3 size={15} aria-hidden="true" />
                  {activity.time}
                </p>
                <p className="flex items-center gap-2">
                  <UsersRound size={15} aria-hidden="true" />
                  {activity.people}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
