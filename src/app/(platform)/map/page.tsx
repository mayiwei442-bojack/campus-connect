import type { Metadata } from "next";
import { Box, Link2, Map, RadioTower } from "lucide-react";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = {
  title: "校园地图",
  description: "在数字校园空间中发现 Place 与 Activity。",
};

const pipeline = [
  { label: "静态场景", value: "campus.glb", icon: Box },
  { label: "空间映射", value: "PLACE_* / ANCHOR_*", icon: Link2 },
  { label: "动态界面", value: "Activity → Beacon", icon: RadioTower },
];

export default function MapPage() {
  return (
    <ModulePlaceholder
      eyebrow="Module 01 · Campus Map"
      title="把校园空间变成可加入的现场"
      description="地图模块将加载仓库中的静态 GLB，通过 Place 与 Anchor 节点关联真实 Activity。用户主动选择场所，不使用 GPS 或后台定位。"
      nextMilestone="在地图板块接入 React Three Fiber、场景交互与 Place 配置。"
      icon={Map}
    >
      <div>
        <div className="campus-grid relative min-h-48 overflow-hidden rounded-[1.4rem] p-5 text-paper">
          <div className="absolute right-[22%] top-[35%] size-3 rounded-full bg-signal shadow-[0_0_22px_7px_rgba(227,87,45,0.32)]" />
          <div className="absolute bottom-[24%] left-[34%] size-2.5 rounded-full bg-skyline shadow-[0_0_20px_6px_rgba(141,185,199,0.25)]" />
          <p className="relative text-[0.65rem] font-bold uppercase tracking-[0.2em] text-paper/48">Scene asset ready</p>
          <p className="relative mt-3 max-w-md font-display text-2xl font-semibold">73 组 Place / Anchor 节点等待业务映射</p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {pipeline.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-[1.2rem] border border-forest/8 bg-paper/55 p-4">
                <Icon size={18} className="text-cobalt" aria-hidden="true" />
                <p className="mt-4 text-xs font-semibold text-forest/45">{item.label}</p>
                <p className="mt-1.5 text-sm font-bold text-forest">{item.value}</p>
              </div>
            );
          })}
        </div>
      </div>
    </ModulePlaceholder>
  );
}
