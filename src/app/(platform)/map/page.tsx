import type { Metadata } from "next";
import { Box, Link2, Map, MousePointer2 } from "lucide-react";

import { CampusMapLoader } from "@/components/map/campus-map-loader";

export const metadata: Metadata = {
  title: "校园地图",
  description: "浏览 Campus Connect 的三维校园场景与空间节点。",
};

const sceneFacts = [
  { label: "静态场景", value: "campus.glb · 235 KB", icon: Box },
  { label: "空间配对", value: "73 Place · 73 Anchor", icon: Link2 },
  { label: "本阶段交互", value: "搜索 · 旋转 · 点击定位", icon: MousePointer2 },
];

export default function MapPage() {
  return (
    <section className="rise-in">
      <div className="flex max-w-5xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-signal">Module 01 · Campus Map</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold leading-[1.18] tracking-[-0.04em] text-forest sm:text-5xl">
            从模型节点进入校园现场
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-forest/62">
            当前地图直接读取仓库中的 GLB 场景，按同名后缀配对 Place 与 Anchor。这里展示的是技术场景索引，尚未将节点包装成未经确认的真实地点资料。
          </p>
        </div>
        <div className="grid size-20 shrink-0 place-items-center rounded-[1.6rem] border border-forest/10 bg-white/45 text-cobalt shadow-[0_16px_50px_rgba(39,91,131,0.1)]">
          <Map size={34} strokeWidth={1.5} aria-hidden="true" />
        </div>
      </div>

      <div className="mt-9">
        <CampusMapLoader />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {sceneFacts.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-[1.25rem] border border-forest/8 bg-white/48 p-4 shadow-[0_12px_36px_rgba(20,35,31,0.04)]">
              <Icon size={18} className="text-cobalt" aria-hidden="true" />
              <p className="mt-4 text-xs font-semibold text-forest/45">{item.label}</p>
              <p className="mt-1.5 text-sm font-bold text-forest">{item.value}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
