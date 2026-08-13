"use client";

import {
  Bot,
  Check,
  CircleOff,
  Eye,
  FileCheck2,
  ImagePlus,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

import { PersonaAskCard } from "@/components/persona/persona-ask-card";
import type { PersonaEntryItem, PersonaItem } from "@/lib/persona/types";
import { createClient } from "@/lib/supabase/client";

const PersonaAvatarShowcase = dynamic(
  () => import("@/components/persona/persona-avatar-showcase").then((module) => module.PersonaAvatarShowcase),
  { ssr: false },
);

const kindLabels: Record<PersonaEntryItem["kind"], string> = {
  fact: "事实",
  preference: "偏好",
  opinion: "观点",
  experience: "经历",
  boundary: "边界",
};

const statusLabels: Record<PersonaEntryItem["status"], string> = {
  draft: "待确认",
  confirmed: "已确认",
  rejected: "已拒绝",
  replaced: "历史版本",
};

type PersonaStudioProps = {
  isOwner: boolean;
  personas: PersonaItem[];
  showAvatarShowcase: boolean;
  viewerId: string;
};

export function PersonaStudio({ isOwner, personas, showAvatarShowcase, viewerId }: PersonaStudioProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [busyKey, setBusyKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");

  function begin(key: string) {
    setBusyKey(key);
    setMessage("");
    setError("");
  }

  function finish(successMessage?: string) {
    setBusyKey("");
    if (successMessage) setMessage(successMessage);
    router.refresh();
  }

  function fail(cause: unknown, fallback: string) {
    setBusyKey("");
    setError(cause instanceof Error ? cause.message : fallback);
  }

  async function createPersona(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    begin("create");
    const { error: createError } = await supabase.rpc("create_persona", {
      p_name: String(data.get("name") ?? "").trim(),
      p_topic: String(data.get("topic") ?? "").trim(),
      p_summary: String(data.get("summary") ?? "").trim() || undefined,
      p_visibility: data.get("visibility") === "public" ? "public" : "private",
    });
    if (createError) {
      fail(new Error(createError.message.includes("persona_limit_reached") ? "每人最多创建 3 个 Persona。" : "Persona 创建失败，请检查名称和主题。"), "Persona 创建失败。");
      return;
    }
    form.reset();
    finish("Persona 已创建；默认未启用，确认知识后再公开更稳妥。");
  }

  async function savePersona(event: FormEvent<HTMLFormElement>, personaId: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    begin(`save:${personaId}`);
    const { error: updateError } = await supabase.from("personas").update({
      name: String(data.get("name") ?? "").trim(),
      topic: String(data.get("topic") ?? "").trim(),
      summary: String(data.get("summary") ?? "").trim() || null,
      visibility: data.get("visibility") === "public" ? "public" : "private",
      is_enabled: data.get("isEnabled") === "on",
      allow_matching: data.get("allowMatching") === "on",
    }).eq("id", personaId);
    if (updateError) return fail(updateError, "Persona 设置保存失败。");
    finish("Persona 设置已保存。");
  }

  async function uploadAsset(event: FormEvent<HTMLFormElement>, personaId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("image");
    if (!(file instanceof File) || !file.size) return setError("请选择图片。");
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type) || file.size > 4 * 1024 * 1024) {
      return setError("请选择 4 MB 以内的 JPG、PNG 或 WebP 图片。");
    }

    begin(`upload:${personaId}`);
    const uploadPayload = new FormData();
    uploadPayload.set("image", file);
    uploadPayload.set("description", String(data.get("description") ?? "").trim());
    const uploadResponse = await fetch(`/api/personas/${personaId}/assets`, { method: "POST", body: uploadPayload });
    const uploadResult = await uploadResponse.json() as { assetId?: string; error?: string };
    if (!uploadResponse.ok || !uploadResult.assetId) return fail(new Error(uploadResult.error || "图片记录创建失败。"), "图片记录创建失败。");
    const assetId = uploadResult.assetId;

    form.reset();
    const response = await fetch(`/api/personas/${personaId}/assets/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId }),
    });
    const payload = await response.json() as { error?: string; entryCount?: number };
    if (!response.ok) {
      finish();
      setError(`图片已安全保存；${payload.error || "自动理解暂时不可用，可重试或人工录入。"}`);
      return;
    }
    finish(`图片已保存，生成 ${payload.entryCount ?? 0} 条待确认草稿。`);
  }

  async function analyzeAsset(personaId: string, assetId: string) {
    begin(`analyze:${assetId}`);
    const response = await fetch(`/api/personas/${personaId}/assets/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId }),
    });
    const payload = await response.json() as { error?: string; entryCount?: number };
    if (!response.ok) return fail(new Error(payload.error || "图片理解暂时不可用。"), "图片理解暂时不可用。");
    finish(`已生成 ${payload.entryCount ?? 0} 条新的待确认草稿。`);
  }

  async function createManualDraft(event: FormEvent<HTMLFormElement>, personaId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    begin(`manual:${personaId}`);
    const { error: insertError } = await supabase.from("persona_entries").insert({
      persona_id: personaId,
      owner_id: viewerId,
      kind: String(data.get("kind")) as PersonaEntryItem["kind"],
      knowledge_key: String(data.get("knowledgeKey") ?? "").trim(),
      content: String(data.get("content") ?? "").trim(),
    });
    if (insertError) return fail(insertError, "人工草稿保存失败。");
    form.reset();
    finish("人工草稿已保存，确认后才会参与问答和匹配。");
  }

  async function decideEntry(entryId: string, decision: "confirm" | "reject") {
    begin(`${decision}:${entryId}`);
    const result = decision === "confirm"
      ? await supabase.rpc("confirm_persona_entry", { p_entry_id: entryId })
      : await supabase.rpc("reject_persona_entry", { p_entry_id: entryId });
    if (result.error) return fail(result.error, "草稿状态更新失败。");
    finish(decision === "confirm" ? "这条知识已确认，可以参与问答和匹配。" : "草稿已拒绝，不会参与问答或匹配。");
  }

  async function deleteAsset(personaId: string, assetId: string, path: string) {
    begin(`delete-asset:${assetId}`);
    const response = await fetch(`/api/personas/${personaId}/assets`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId, storagePath: path }),
    });
    const payload = await response.json() as { error?: string };
    if (!response.ok) return fail(new Error(payload.error || "图片删除失败。"), "图片删除失败。");
    finish("图片已移除；已确认的文字知识仍会保留。 ");
  }

  async function deletePersona(persona: PersonaItem) {
    if (deleteConfirm !== persona.id) {
      setDeleteConfirm(persona.id);
      return;
    }
    begin(`delete:${persona.id}`);
    const { error: deleteError } = await supabase.rpc("delete_persona", { p_persona_id: persona.id });
    if (deleteError) return fail(new Error(deleteError.message.includes("PERSONA_HAS_ASSETS") ? "请先移除所有未被已确认知识引用的图片；如需删除来源图，请先删除对应知识。" : "Persona 删除失败。"), "Persona 删除失败。");
    setDeleteConfirm("");
    finish("Persona 已删除。");
  }

  if (!isOwner) {
    return (
      <section className="overflow-hidden rounded-[1.9rem] border border-forest/10 bg-paper-deep/28 p-5 sm:p-7">
        <PersonaHeader count={personas.length} owner={false} />
        {personas.length ? <div className="mt-6 grid gap-5 xl:grid-cols-2">{personas.map((persona) => <PublicPersona key={persona.id} persona={persona} />)}</div> : <EmptyPersona owner={false} />}
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[1.9rem] border border-forest/10 bg-paper-deep/28 p-5 sm:p-7">
      <PersonaHeader count={personas.length} owner />
      {showAvatarShowcase ? <PersonaAvatarShowcase personas={personas} /> : null}
      <div className="mt-5 min-h-6" aria-live="polite">
        {message ? <p className="flex items-center gap-2 text-sm font-semibold text-forest"><Check size={16} />{message}</p> : null}
        {error ? <p role="alert" className="flex items-center gap-2 text-sm font-semibold text-signal"><CircleOff size={16} />{error}</p> : null}
      </div>
      {personas.length < 3 ? <CreatePersonaForm busy={busyKey === "create"} onSubmit={createPersona} /> : null}
      {personas.length ? (
        <div className="mt-6 space-y-6">
          {personas.map((persona) => (
            <OwnerPersona
              key={persona.id}
              busyKey={busyKey}
              deleteConfirm={deleteConfirm}
              onAnalyze={(assetId) => void analyzeAsset(persona.id, assetId)}
              onDelete={() => void deletePersona(persona)}
              onDeleteAsset={(assetId, path) => void deleteAsset(persona.id, assetId, path)}
              onEntryDecision={(entryId, decision) => void decideEntry(entryId, decision)}
              onManualDraft={(event) => void createManualDraft(event, persona.id)}
              onSave={(event) => void savePersona(event, persona.id)}
              onUpload={(event) => void uploadAsset(event, persona.id)}
              persona={persona}
            />
          ))}
        </div>
      ) : <EmptyPersona owner />}
    </section>
  );
}

function PersonaHeader({ count, owner }: { count: number; owner: boolean }) {
  return <header className="flex flex-col gap-4 border-b border-forest/8 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-cobalt"><Sparkles size={14} />Persona knowledge</p><h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.035em] text-forest sm:text-4xl">{owner ? "我的三面校园角色" : "已公开的 Persona"}</h2><p className="mt-2 max-w-2xl text-sm leading-7 text-forest/48">图片只产生草稿；只有主人确认的条目才会回答问题或进入 Connect 证据。</p></div><span className="rounded-full bg-white/55 px-3.5 py-2 font-mono text-[0.65rem] font-bold text-forest/45">{count} / 3</span></header>;
}

function EmptyPersona({ owner }: { owner: boolean }) {
  return <div className="mt-6 rounded-[1.4rem] border border-dashed border-forest/15 bg-white/25 p-8 text-center"><Bot className="mx-auto text-forest/22" size={32} /><p className="mt-3 text-sm font-bold text-forest/58">{owner ? "从一个你愿意亲自确认的兴趣或经验开始。" : "这位成员暂未公开 Persona。"}</p></div>;
}

function CreatePersonaForm({ busy, onSubmit }: { busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form onSubmit={onSubmit} className="mt-5 grid gap-3 rounded-[1.45rem] bg-forest p-4 text-paper sm:grid-cols-2 sm:p-5"><input name="name" required minLength={2} maxLength={40} placeholder="Persona 名称，例如：摄影现场" className="rounded-xl border border-white/12 bg-white/8 px-4 py-3 text-sm placeholder:text-paper/34" /><input name="topic" required minLength={2} maxLength={80} placeholder="主题，例如：校园摄影与构图" className="rounded-xl border border-white/12 bg-white/8 px-4 py-3 text-sm placeholder:text-paper/34" /><textarea name="summary" maxLength={500} rows={2} placeholder="你希望这张 Persona 表达什么？" className="rounded-xl border border-white/12 bg-white/8 px-4 py-3 text-sm placeholder:text-paper/34 sm:col-span-2" /><div className="flex items-center justify-between gap-3 sm:col-span-2"><label className="flex items-center gap-2 text-xs text-paper/64"><input type="checkbox" name="visibility" value="public" />创建为公开（仍默认未启用）</label><button disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-signal px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? <LoaderCircle className="animate-spin" size={16} /> : <Plus size={16} />}创建 Persona</button></div></form>;
}

type OwnerPersonaProps = {
  busyKey: string;
  deleteConfirm: string;
  persona: PersonaItem;
  onAnalyze: (assetId: string) => void;
  onDelete: () => void;
  onDeleteAsset: (assetId: string, path: string) => void;
  onEntryDecision: (entryId: string, decision: "confirm" | "reject") => void;
  onManualDraft: (event: FormEvent<HTMLFormElement>) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onUpload: (event: FormEvent<HTMLFormElement>) => void;
};

function OwnerPersona(props: OwnerPersonaProps) {
  const { persona } = props;
  const currentEntries = persona.entries.filter((entry) => entry.status === "draft" || entry.status === "confirmed");
  return <article className="overflow-hidden rounded-[1.6rem] border border-forest/10 bg-white/48"><div className="grid gap-0 xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]"><form onSubmit={props.onSave} className="bg-cobalt p-5 text-white sm:p-6"><p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-skyline">Slot 0{persona.slot}</p><input name="name" defaultValue={persona.name} required minLength={2} maxLength={40} className="mt-4 w-full border-b border-white/16 bg-transparent pb-2 font-display text-3xl font-semibold outline-none" /><input name="topic" defaultValue={persona.topic} required minLength={2} maxLength={80} className="mt-3 w-full border-b border-white/12 bg-transparent pb-2 text-sm text-white/76 outline-none" /><textarea name="summary" defaultValue={persona.summary ?? ""} maxLength={500} rows={4} className="mt-4 w-full rounded-xl border border-white/12 bg-white/7 px-3 py-2.5 text-sm leading-6 text-white/72" /><div className="mt-4 space-y-2 text-xs"><label className="flex items-center gap-2"><input type="checkbox" name="visibility" value="public" defaultChecked={persona.visibility === "public"} /><Eye size={14} />公开 Persona</label><label className="flex items-center gap-2"><input type="checkbox" name="isEnabled" defaultChecked={persona.is_enabled} /><ShieldCheck size={14} />启用公开问答</label><label className="flex items-center gap-2"><input type="checkbox" name="allowMatching" defaultChecked={persona.allow_matching} /><Bot size={14} />允许进入 Connect 证据</label></div><div className="mt-5 flex flex-wrap gap-2"><button disabled={Boolean(props.busyKey)} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-bold text-cobalt disabled:opacity-50"><Save size={14} />保存设置</button><button type="button" disabled={Boolean(props.busyKey)} onClick={props.onDelete} className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2.5 text-xs font-bold text-white"><Trash2 size={14} />{props.deleteConfirm === persona.id ? "再次点击确认删除" : "删除"}</button></div></form><div className="p-5 sm:p-6"><h3 className="font-display text-2xl font-semibold text-forest">图片素材与待确认知识</h3><p className="mt-1 text-xs leading-5 text-forest/44">自动理解失败不会影响图片保存和人工草稿。</p><form onSubmit={props.onUpload} className="mt-4 grid gap-2 rounded-xl border border-forest/10 bg-paper/45 p-3 sm:grid-cols-[1fr_1fr_auto]"><input type="file" name="image" required accept="image/jpeg,image/png,image/webp" className="min-w-0 text-xs text-forest/55 file:mr-2 file:rounded-full file:border-0 file:bg-forest file:px-3 file:py-2 file:text-xs file:font-bold file:text-paper" /><input name="description" maxLength={500} placeholder="人工描述（可选）" className="rounded-lg border border-forest/10 bg-white/60 px-3 py-2 text-xs text-forest" /><button disabled={Boolean(props.busyKey)} className="inline-flex items-center justify-center gap-2 rounded-full bg-signal px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><ImagePlus size={14} />上传并分析</button></form>{persona.assets.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{persona.assets.map((asset) => <div key={asset.id} className="rounded-xl border border-forest/8 bg-white/60 p-3">{asset.imageUrl ? <Image unoptimized src={asset.imageUrl} alt={asset.user_description || "Persona 图片素材"} width={640} height={420} className="h-36 w-full rounded-lg object-cover" /> : <div className="grid h-36 place-items-center rounded-lg bg-forest/5 text-xs text-forest/35">私有图片暂时无法加载</div>}<div className="mt-3 flex items-center justify-between gap-2"><span className="text-[0.65rem] font-bold text-forest/55">{asset.analysis_status === "ready" ? `已生成草稿 · ${asset.model_name ?? "AI"}` : asset.analysis_status === "analyzing" ? "分析中" : asset.analysis_status === "failed" ? "可重试" : "等待分析"}</span><div className="flex gap-1"><button type="button" onClick={() => props.onAnalyze(asset.id)} disabled={Boolean(props.busyKey)} className="grid size-8 place-items-center rounded-full bg-cobalt/8 text-cobalt" aria-label="重新分析图片">{props.busyKey === `analyze:${asset.id}` ? <LoaderCircle className="animate-spin" size={13} /> : <RefreshCw size={13} />}</button><button type="button" onClick={() => props.onDeleteAsset(asset.id, asset.storage_path)} disabled={Boolean(props.busyKey)} className="grid size-8 place-items-center rounded-full bg-signal/8 text-signal" aria-label="删除图片"><Trash2 size={13} /></button></div></div>{asset.user_description ? <p className="mt-2 text-xs leading-5 text-forest/45">{asset.user_description}</p> : null}{asset.analysis_error ? <p className="mt-2 text-[0.65rem] leading-5 text-signal">{asset.analysis_error}</p> : null}</div>)}</div> : null}</div></div><div className="border-t border-forest/8 p-5 sm:p-6"><div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]"><div><h4 className="flex items-center gap-2 text-sm font-bold text-forest"><FileCheck2 size={16} className="text-cobalt" />当前知识</h4>{currentEntries.length ? <div className="mt-3 space-y-2">{currentEntries.map((entry) => <div key={entry.id} className={`rounded-xl border p-3 ${entry.status === "confirmed" ? "border-forest/10 bg-forest/5" : "border-signal/15 bg-signal/5"}`}><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold text-forest">{kindLabels[entry.kind]} · {entry.knowledge_key}</p><span className="rounded-full bg-white/60 px-2 py-1 text-[0.6rem] font-bold text-forest/45">{statusLabels[entry.status]}</span></div><p className="mt-2 text-sm leading-6 text-forest/62">{entry.content}</p>{entry.status === "draft" ? <div className="mt-3 flex gap-2"><button type="button" onClick={() => props.onEntryDecision(entry.id, "confirm")} disabled={Boolean(props.busyKey)} className="inline-flex items-center gap-1 rounded-full bg-forest px-3 py-2 text-[0.65rem] font-bold text-paper"><Check size={13} />确认</button><button type="button" onClick={() => props.onEntryDecision(entry.id, "reject")} disabled={Boolean(props.busyKey)} className="inline-flex items-center gap-1 rounded-full border border-signal/20 px-3 py-2 text-[0.65rem] font-bold text-signal"><X size={13} />拒绝</button></div> : null}</div>)}</div> : <p className="mt-3 text-xs text-forest/38">还没有待确认或已确认知识。</p>}</div><form onSubmit={props.onManualDraft} className="rounded-xl bg-paper/55 p-4"><h4 className="text-sm font-bold text-forest">人工录入草稿</h4><select name="kind" className="mt-3 w-full rounded-lg border border-forest/10 bg-white/70 px-3 py-2 text-xs">{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input name="knowledgeKey" required minLength={2} maxLength={80} placeholder="知识标题" className="mt-2 w-full rounded-lg border border-forest/10 bg-white/70 px-3 py-2 text-xs" /><textarea name="content" required maxLength={1000} rows={4} placeholder="只写你愿意确认并用于回答的信息" className="mt-2 w-full rounded-lg border border-forest/10 bg-white/70 px-3 py-2 text-xs leading-5" /><button disabled={Boolean(props.busyKey)} className="mt-3 inline-flex items-center gap-2 rounded-full bg-cobalt px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"><Plus size={14} />保存待确认草稿</button></form></div>{persona.questionTopics.length ? <div className="mt-5 border-t border-forest/8 pt-4"><p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-forest/38">匿名问题主题 · 至少 3 次才显示</p><div className="mt-2 flex flex-wrap gap-2">{persona.questionTopics.map((topic) => <span key={topic.id} className="rounded-full bg-white/70 px-3 py-1.5 text-xs text-forest/55">{topic.topic_label} · {topic.question_count}</span>)}</div></div> : null}</div></article>;
}

function PublicPersona({ persona }: { persona: PersonaItem }) {
  const confirmed = persona.entries.filter((entry) => entry.status === "confirmed");
  return <article className="rounded-[1.55rem] border border-forest/10 bg-white/52 p-5 shadow-[0_18px_55px_rgba(20,35,31,0.05)]"><div className="flex items-start justify-between gap-4"><div><p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-cobalt">Persona 0{persona.slot}</p><h3 className="mt-2 font-display text-3xl font-semibold text-forest">{persona.name}</h3><p className="mt-1 text-sm text-forest/48">{persona.topic}</p></div><span className="rounded-full bg-forest/7 px-3 py-1.5 text-[0.62rem] font-bold text-forest">已启用</span></div>{persona.summary ? <p className="mt-4 text-sm leading-7 text-forest/60">{persona.summary}</p> : null}<div className="mt-4 space-y-2">{confirmed.map((entry) => <div key={entry.id} className="rounded-xl bg-paper/55 p-3"><p className="text-[0.65rem] font-bold text-cobalt">{kindLabels[entry.kind]} · {entry.knowledge_key}</p><p className="mt-1 text-sm leading-6 text-forest/62">{entry.content}</p></div>)}</div><PersonaAskCard personaId={persona.id} personaName={persona.name} /></article>;
}
