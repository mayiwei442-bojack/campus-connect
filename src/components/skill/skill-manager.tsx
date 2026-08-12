"use client";

import {
  BrainCircuit,
  CheckCircle2,
  Eye,
  LoaderCircle,
  MessageCircle,
  Plus,
  Radar,
  Save,
  Trash2,
  Wrench,
} from "lucide-react";
import { useActionState } from "react";

import { addProfileSkillAction, manageProfileSkillAction } from "@/app/(platform)/profile/skill-actions";
import { SkillShowcase } from "@/components/skill/skill-showcase";
import type { ProfileSkillItem, SkillFormValues, SkillKind } from "@/lib/skill/action-state";
import { initialSkillActionState } from "@/lib/skill/action-state";

type SkillManagerProps = {
  items: ProfileSkillItem[];
};

const emptySkillValues: SkillFormValues = {
  allowContact: true,
  allowMatching: true,
  isPublic: true,
  kind: "ability",
  name: "",
  note: "",
  selfRating: null,
};

export function SkillManager({ items }: SkillManagerProps) {
  return (
    <div className="space-y-5">
      <AddSkillForm />
      {items.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {items.map((item, index) => <EditableSkillCard item={item} index={index} key={item.id} />)}
        </div>
      ) : (
        <SkillShowcase items={[]} />
      )}
    </div>
  );
}

function AddSkillForm() {
  const [state, formAction, pending] = useActionState(addProfileSkillAction, initialSkillActionState);
  const values = state.values ?? emptySkillValues;

  return (
    <form action={formAction} className="relative overflow-hidden rounded-[1.7rem] bg-[#153d33] p-5 text-paper shadow-[0_22px_70px_rgba(20,60,50,0.16)] sm:p-7" noValidate>
      <div className="pointer-events-none absolute -right-12 -top-12 size-44 rounded-full border border-white/8" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-md">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-skyline">Add a coordinate</p>
          <h3 className="mt-2 font-display text-3xl font-semibold tracking-[-0.035em]">添加能力或兴趣</h3>
          <p className="mt-3 text-sm leading-6 text-paper/52">把同一种标签放进统一网络，再由每个人控制自己的说明与连接边界。</p>
        </div>
        <KindSelector defaultValue={values.kind} disabled={pending} />
      </div>

      <div className="relative mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_9rem]">
        <SkillTextField
          defaultValue={values.name}
          disabled={pending}
          error={state.fieldErrors?.name}
          label="Skill 名称"
          maxLength={40}
          name="name"
          placeholder="例如：Python、足球、摄影"
        />
        <RatingField defaultValue={values.selfRating} disabled={pending} error={state.fieldErrors?.selfRating} />
        <label className="block lg:col-span-2">
          <span className="flex items-center justify-between text-xs font-bold tracking-[0.06em] text-paper/66">
            <span>一句说明</span>
            <span className="font-mono text-[0.6rem] font-normal text-paper/34">最多 160 字</span>
          </span>
          <textarea
            className="mt-2 w-full resize-y rounded-[1.1rem] border border-white/12 bg-white/[0.065] px-4 py-3.5 text-sm leading-6 text-paper outline-none transition placeholder:text-paper/28 focus:border-skyline/55 focus:bg-white/[0.09] disabled:opacity-55"
            defaultValue={values.note}
            disabled={pending}
            maxLength={160}
            name="note"
            placeholder="你愿意在哪些场景中使用或分享它？"
            rows={3}
          />
          {state.fieldErrors?.note ? <span className="mt-1.5 block text-xs text-[#ff9474]">{state.fieldErrors.note}</span> : null}
        </label>
      </div>

      <div className="relative mt-5 grid gap-3 md:grid-cols-3">
        <CompactConsent defaultChecked={values.isPublic} disabled={pending} icon={Eye} label="公开展示" name="isPublic" />
        <CompactConsent defaultChecked={values.allowContact} disabled={pending} icon={MessageCircle} label="允许联系" name="allowContact" />
        <CompactConsent defaultChecked={values.allowMatching} disabled={pending} icon={Radar} label="参与匹配" name="allowMatching" />
      </div>

      <div className="relative mt-6 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <ActionMessage message={state.message} status={state.status} dark />
        <button className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-signal px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#c94823] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0" disabled={pending} type="submit">
          {pending ? <LoaderCircle className="animate-spin" size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}
          {pending ? "正在添加…" : "加入我的 Skill"}
        </button>
      </div>
    </form>
  );
}

function EditableSkillCard({ item, index }: { item: ProfileSkillItem; index: number }) {
  const [state, formAction, pending] = useActionState(manageProfileSkillAction, initialSkillActionState);
  const values = state.values ?? item;
  const isAbility = item.kind === "ability";
  const Icon = isAbility ? Wrench : BrainCircuit;

  return (
    <form action={formAction} className="rounded-[1.55rem] border border-forest/10 bg-white/52 p-5 shadow-[0_18px_60px_rgba(20,35,31,0.055)]" noValidate>
      <input name="profileSkillId" type="hidden" value={item.id} />
      <input name="kind" type="hidden" value={item.kind} />
      <input name="name" type="hidden" value={item.name} />

      <div className="flex items-start gap-4">
        <span className={`grid size-11 shrink-0 place-items-center rounded-[1rem] ${isAbility ? "bg-cobalt text-white" : "bg-signal/12 text-signal"}`}>
          <Icon size={19} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-forest/34">{isAbility ? "Ability" : "Interest"} · S-{String(index + 1).padStart(2, "0")}</p>
          <h3 className="mt-1 truncate font-display text-2xl font-semibold text-forest">{item.name}</h3>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[0.62rem] font-bold ${values.isPublic ? "bg-forest/7 text-forest" : "bg-forest/4 text-forest/38"}`}>
          {values.isPublic ? "公开" : "私密"}
        </span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <RatingField defaultValue={values.selfRating} disabled={pending} error={state.fieldErrors?.selfRating} light />
        <label className="block">
          <span className="text-xs font-bold tracking-[0.06em] text-forest/62">说明</span>
          <input className="mt-2 w-full rounded-[1rem] border border-forest/12 bg-paper/38 px-3.5 py-3 text-sm text-forest outline-none transition placeholder:text-forest/28 focus:border-forest/35 focus:bg-white disabled:opacity-55" defaultValue={values.note} disabled={pending} maxLength={160} name="note" placeholder="补充一个具体场景" />
          {state.fieldErrors?.note ? <span className="mt-1.5 block text-xs text-signal">{state.fieldErrors.note}</span> : null}
        </label>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <CompactConsent defaultChecked={values.isPublic} disabled={pending} icon={Eye} label="公开" name="isPublic" light />
        <CompactConsent defaultChecked={values.allowContact} disabled={pending} icon={MessageCircle} label="联系" name="allowContact" light />
        <CompactConsent defaultChecked={values.allowMatching} disabled={pending} icon={Radar} label="匹配" name="allowMatching" light />
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-forest/8 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <ActionMessage message={state.message} status={state.status} />
        <div className="flex shrink-0 gap-2">
          <button
            className="inline-flex items-center gap-1.5 rounded-full border border-signal/15 px-3.5 py-2 text-xs font-bold text-signal transition hover:bg-signal/7 disabled:opacity-45"
            disabled={pending}
            name="operation"
            onClick={(event) => {
              if (!window.confirm(`从名片移除「${item.name}」？`)) event.preventDefault();
            }}
            type="submit"
            value="delete"
          >
            <Trash2 size={14} aria-hidden="true" />
            移除
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-full bg-forest px-4 py-2 text-xs font-bold text-paper transition hover:bg-forest-soft disabled:opacity-45" disabled={pending} name="operation" type="submit" value="update">
            {pending ? <LoaderCircle className="animate-spin" size={14} aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}
            保存
          </button>
        </div>
      </div>
    </form>
  );
}

function KindSelector({ defaultValue, disabled }: { defaultValue: SkillKind; disabled: boolean }) {
  return (
    <fieldset className="grid grid-cols-2 gap-1.5 rounded-[1.1rem] border border-white/10 bg-black/8 p-1.5">
      <legend className="sr-only">Skill 类型</legend>
      <KindOption checked={defaultValue === "ability"} disabled={disabled} icon={Wrench} label="能力" value="ability" />
      <KindOption checked={defaultValue === "interest"} disabled={disabled} icon={BrainCircuit} label="兴趣" value="interest" />
    </fieldset>
  );
}

function KindOption({ checked, disabled, icon: Icon, label, value }: { checked: boolean; disabled: boolean; icon: typeof Wrench; label: string; value: SkillKind }) {
  return (
    <label className="cursor-pointer has-[:disabled]:cursor-not-allowed">
      <input className="peer sr-only" defaultChecked={checked} disabled={disabled} name="kind" type="radio" value={value} />
      <span className="flex items-center justify-center gap-2 rounded-[0.85rem] px-4 py-2.5 text-xs font-bold text-paper/48 transition peer-checked:bg-paper peer-checked:text-forest peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-skyline">
        <Icon size={15} aria-hidden="true" />
        {label}
      </span>
    </label>
  );
}

function SkillTextField({ defaultValue, disabled, error, label, maxLength, name, placeholder }: { defaultValue: string; disabled: boolean; error?: string; label: string; maxLength: number; name: string; placeholder: string }) {
  return (
    <label className="block">
      <span className="text-xs font-bold tracking-[0.06em] text-paper/66">{label}</span>
      <input aria-invalid={Boolean(error)} className="mt-2 w-full rounded-[1.1rem] border border-white/12 bg-white/[0.065] px-4 py-3.5 text-sm text-paper outline-none transition placeholder:text-paper/28 focus:border-skyline/55 focus:bg-white/[0.09] disabled:opacity-55" defaultValue={defaultValue} disabled={disabled} maxLength={maxLength} name={name} placeholder={placeholder} type="text" />
      {error ? <span className="mt-1.5 block text-xs text-[#ff9474]">{error}</span> : null}
    </label>
  );
}

function RatingField({ defaultValue, disabled, error, light = false }: { defaultValue: number | null; disabled: boolean; error?: string; light?: boolean }) {
  return (
    <label className="block">
      <span className={`text-xs font-bold tracking-[0.06em] ${light ? "text-forest/62" : "text-paper/66"}`}>自评</span>
      <select className={`mt-2 w-full rounded-[1rem] border px-3.5 py-3 text-sm outline-none transition disabled:opacity-55 ${light ? "border-forest/12 bg-paper/38 text-forest focus:border-forest/35" : "border-white/12 bg-[#214b40] text-paper focus:border-skyline/55"}`} defaultValue={defaultValue ?? ""} disabled={disabled} name="selfRating">
        <option value="">暂不评分</option>
        {[1, 2, 3, 4, 5].map((rating) => <option value={rating} key={rating}>{rating} / 5</option>)}
      </select>
      {error ? <span className={`mt-1.5 block text-xs ${light ? "text-signal" : "text-[#ff9474]"}`}>{error}</span> : null}
    </label>
  );
}

function CompactConsent({ defaultChecked, disabled, icon: Icon, label, light = false, name }: { defaultChecked: boolean; disabled: boolean; icon: typeof Eye; label: string; light?: boolean; name: string }) {
  return (
    <label className={`flex cursor-pointer items-center gap-2.5 rounded-[0.95rem] border px-3 py-2.5 transition has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 ${light ? "border-forest/9 bg-paper/34 text-forest/58" : "border-white/10 bg-white/[0.05] text-paper/58"}`}>
      <input className="peer sr-only" defaultChecked={defaultChecked} disabled={disabled} name={name} type="checkbox" />
      <Icon size={15} aria-hidden="true" />
      <span className="flex-1 text-xs font-bold">{label}</span>
      <span className={`relative h-5 w-9 rounded-full transition peer-checked:bg-signal peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 ${light ? "bg-forest/10 peer-focus-visible:outline-forest" : "bg-white/12 peer-focus-visible:outline-skyline"} after:absolute after:left-1 after:top-1 after:size-3 after:rounded-full after:bg-paper after:transition-transform peer-checked:after:translate-x-4`} aria-hidden="true" />
    </label>
  );
}

function ActionMessage({ dark = false, message, status }: { dark?: boolean; message: string; status: "idle" | "error" | "success" }) {
  if (!message) return <span className="min-h-5" />;

  return (
    <p className={`flex items-center gap-2 text-xs font-semibold ${status === "success" ? (dark ? "text-skyline" : "text-forest") : (dark ? "text-[#ff9474]" : "text-signal")}`} role={status === "error" ? "alert" : "status"} aria-live="polite">
      {status === "success" ? <CheckCircle2 size={15} aria-hidden="true" /> : null}
      {message}
    </p>
  );
}
