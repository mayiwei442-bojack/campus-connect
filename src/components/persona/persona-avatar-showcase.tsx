"use client";

import { Box, LockKeyhole, MousePointer2, Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

import type { PersonaAvatarModelConfig, PersonaAvatarSlot } from "@/components/persona/persona-avatar-stage";

const AVATAR_MODELS: PersonaAvatarModelConfig[] = [
  {
    accent: "#f4d7a2",
    displayScale: 1,
    label: "爱因斯坦形象",
    modelUrl: "/models/persona/einstein.glb",
    slot: 1,
    verticalOffset: 0,
  },
  {
    accent: "#ef694c",
    displayScale: 1.18,
    label: "钢铁侠形象",
    modelUrl: "/models/persona/ironman.glb",
    slot: 2,
    verticalOffset: 0.8,
  },
  {
    accent: "#63b7e6",
    displayScale: 1.38,
    label: "蜘蛛侠形象",
    modelUrl: "/models/persona/spider.glb",
    slot: 3,
    verticalOffset: 1.27,
  },
];

const PersonaAvatarStage = dynamic(
  () => import("./persona-avatar-stage").then((module) => module.PersonaAvatarStage),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full place-items-center bg-[#071923] text-center text-white/60">
        <div>
          <span className="mx-auto block size-8 animate-spin rounded-full border-2 border-white/15 border-t-[#ef694c]" />
          <p className="mt-4 font-mono text-[0.62rem] uppercase tracking-[0.2em]">正在装配 3D Persona</p>
        </div>
      </div>
    ),
  },
);

type PersonaAvatarShowcaseProps = {
  personas: Array<{
    name: string;
    slot: number;
    topic: string;
  }>;
};

export function PersonaAvatarShowcase({ personas }: PersonaAvatarShowcaseProps) {
  const [activeSlot, setActiveSlot] = useState<PersonaAvatarSlot>(1);
  const activeModel = AVATAR_MODELS.find((model) => model.slot === activeSlot) ?? AVATAR_MODELS[0];
  const activePersona = personas.find((persona) => persona.slot === activeSlot);

  return (
    <section className="mt-6 overflow-hidden rounded-[1.65rem] border border-white/10 bg-[#071923] text-white shadow-[0_26px_80px_rgba(7,25,35,0.2)]">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="relative h-[24rem] min-w-0 overflow-hidden sm:h-[29rem] lg:h-[32rem]">
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{ background: `radial-gradient(circle at 50% 72%, ${activeModel.accent}35, transparent 42%)` }}
          />
          <PersonaAvatarStage model={activeModel} />
          <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap gap-2 sm:left-5 sm:top-5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 font-mono text-[0.58rem] uppercase tracking-[0.16em] text-white/66 backdrop-blur-md">
              <Box size={12} aria-hidden="true" /> Live 3D Persona
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-[0.62rem] font-semibold text-white/66 backdrop-blur-md">
              <MousePointer2 size={12} aria-hidden="true" /> 拖动查看
            </span>
          </div>
        </div>

        <div className="relative flex flex-col border-t border-white/10 bg-white/[0.045] p-5 sm:p-6 lg:border-l lg:border-t-0">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.62rem] font-bold text-[#071923]" style={{ backgroundColor: activeModel.accent }}>
                <Sparkles size={12} aria-hidden="true" /> Persona 0{activeSlot}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[0.62rem] font-semibold text-white/38">
                <LockKeyhole size={12} aria-hidden="true" /> 仅路演账号可见
              </span>
            </div>
            <p className="mt-7 font-mono text-[0.58rem] uppercase tracking-[0.22em] text-white/32">Selected identity</p>
            <h3 className="mt-2 font-display text-3xl font-semibold tracking-[-0.04em] text-white">
              {activePersona?.name ?? `Persona 0${activeSlot}`}
            </h3>
            <p className="mt-2 text-sm leading-6 text-white/48">
              {activePersona?.topic ?? "等待与一个 Persona 槽位建立连接"}
            </p>
            <p className="mt-4 text-xs font-semibold" style={{ color: activeModel.accent }}>
              视觉原型 · {activeModel.label}
            </p>
          </div>

          <div className="mt-7 grid grid-cols-3 gap-2 lg:mt-auto lg:grid-cols-1">
            {AVATAR_MODELS.map((model) => {
              const persona = personas.find((item) => item.slot === model.slot);
              const selected = model.slot === activeSlot;
              return (
                <button
                  key={model.slot}
                  type="button"
                  aria-label={`查看 ${persona?.name ?? `Persona 0${model.slot}`}`}
                  aria-pressed={selected}
                  onClick={() => setActiveSlot(model.slot)}
                  className="group flex min-w-0 flex-col items-start gap-2 rounded-xl border px-2 py-3 text-left transition duration-300 hover:-translate-y-0.5 sm:flex-row sm:items-center sm:gap-3 sm:px-3 lg:px-4"
                  style={{
                    backgroundColor: selected ? `${model.accent}16` : "rgba(255,255,255,0.025)",
                    borderColor: selected ? `${model.accent}72` : "rgba(255,255,255,0.08)",
                  }}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg font-mono text-[0.65rem] font-bold text-[#071923]" style={{ backgroundColor: model.accent }}>
                    0{model.slot}
                  </span>
                  <span className="block min-w-0 max-w-full flex-1">
                    <span className="block truncate text-[0.68rem] font-bold text-white/82 sm:text-xs">{persona?.name ?? `Persona 0${model.slot}`}</span>
                    <span className="mt-0.5 hidden truncate text-[0.62rem] text-white/34 lg:block">{model.label}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
