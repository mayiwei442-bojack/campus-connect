import { BrainCircuit, EyeOff, MessageCircleOff, Radar, Sparkles, Wrench } from "lucide-react";

import type { ProfileSkillItem } from "@/lib/skill/action-state";

type SkillShowcaseProps = {
  items: ProfileSkillItem[];
};

export function SkillShowcase({ items }: SkillShowcaseProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-forest/16 bg-white/26 px-6 py-10 text-center">
        <Sparkles className="mx-auto text-forest/28" size={24} aria-hidden="true" />
        <p className="mt-4 font-display text-xl font-semibold text-forest">还没有公开的 Skill</p>
        <p className="mt-2 text-sm text-forest/45">主人可以选择哪些能力与兴趣出现在这张名片上。</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item, index) => (
        <ReadOnlySkillCard item={item} index={index} key={item.id} />
      ))}
    </div>
  );
}

function ReadOnlySkillCard({ item, index }: { item: ProfileSkillItem; index: number }) {
  const isAbility = item.kind === "ability";
  const Icon = isAbility ? Wrench : BrainCircuit;

  return (
    <article className="group relative overflow-hidden rounded-[1.5rem] border border-forest/10 bg-white/48 p-5 transition hover:-translate-y-0.5 hover:bg-white/66 hover:shadow-[0_18px_55px_rgba(20,35,31,0.08)]">
      <div className="absolute right-4 top-4 font-mono text-[0.6rem] tracking-[0.18em] text-forest/22">S-{String(index + 1).padStart(2, "0")}</div>
      <span className={`grid size-10 place-items-center rounded-[1rem] ${isAbility ? "bg-cobalt text-white" : "bg-signal/12 text-signal"}`}>
        <Icon size={18} aria-hidden="true" />
      </span>
      <p className="mt-5 text-[0.62rem] font-bold uppercase tracking-[0.18em] text-forest/38">
        {isAbility ? "Ability" : "Interest"}
      </p>
      <h3 className="mt-1.5 font-display text-2xl font-semibold tracking-[-0.03em] text-forest">{item.name}</h3>
      {item.selfRating ? (
        <div className="mt-4 flex items-center gap-1.5" aria-label={`自评 ${item.selfRating} / 5`}>
          {Array.from({ length: 5 }, (_, ratingIndex) => (
            <span key={ratingIndex} className={`h-1.5 flex-1 rounded-full ${ratingIndex < item.selfRating! ? (isAbility ? "bg-cobalt" : "bg-signal") : "bg-forest/8"}`} />
          ))}
        </div>
      ) : null}
      <p className="mt-4 min-h-12 text-sm leading-6 text-forest/52">{item.note || "主人暂时没有补充说明。"}</p>
      <div className="mt-5 flex flex-wrap gap-2 border-t border-forest/8 pt-4 text-[0.65rem] font-semibold">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 ${item.allowContact ? "bg-forest/7 text-forest" : "bg-forest/4 text-forest/38"}`}>
          {item.allowContact ? <Radar size={12} aria-hidden="true" /> : <MessageCircleOff size={12} aria-hidden="true" />}
          {item.allowContact ? "可联系" : "不接受联系"}
        </span>
        {!item.allowMatching ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-forest/4 px-2.5 py-1.5 text-forest/38">
            <EyeOff size={12} aria-hidden="true" />
            不参与匹配
          </span>
        ) : null}
      </div>
    </article>
  );
}
