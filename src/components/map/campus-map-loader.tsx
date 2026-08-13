"use client";

import dynamic from "next/dynamic";

import type { MapActivity } from "@/lib/activity/types";

const CampusMapExplorer = dynamic(
  () => import("./campus-map-explorer").then((module) => module.CampusMapExplorer),
  {
    ssr: false,
    loading: () => (
      <div className="campus-grid flex min-h-[38rem] items-center justify-center rounded-[1.8rem] border border-forest/10 px-6 text-center text-paper shadow-[0_24px_80px_rgba(20,60,50,0.14)]">
        <div>
          <div className="mx-auto size-8 animate-spin rounded-full border-2 border-paper/20 border-t-signal" />
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-paper/60">Loading spatial index</p>
          <p className="mt-2 font-display text-xl font-semibold">正在载入 3.9 MB 校园场景</p>
        </div>
      </div>
    ),
  },
);

export function CampusMapLoader({ activities }: { activities: MapActivity[] }) {
  return <CampusMapExplorer activities={activities} />;
}
