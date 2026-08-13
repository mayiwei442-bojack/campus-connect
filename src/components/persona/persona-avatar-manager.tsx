"use client";

import { Box, LoaderCircle, ShieldCheck, Trash2, UploadCloud } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

import type { PersonaAvatarModelConfig, PersonaAvatarSlot } from "@/components/persona/persona-avatar-stage";
import {
  PERSONA_GLB_MIME_TYPE,
  personaGlbStoragePath,
  validatePersonaGlb,
} from "@/lib/persona/avatar-models";
import type { PersonaItem } from "@/lib/persona/types";
import { createClient } from "@/lib/supabase/client";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

const PersonaAvatarShowcase = dynamic(
  () => import("@/components/persona/persona-avatar-showcase").then((module) => module.PersonaAvatarShowcase),
  { ssr: false },
);

const SLOT_ACCENTS = ["#f4d7a2", "#ef694c", "#63b7e6"] as const;
const TUS_CHUNK_BYTES = 6 * 1024 * 1024;

type PersonaAvatarManagerProps = {
  personas: PersonaItem[];
  viewerId: string;
};

function resumableUploadEndpoint(supabaseUrl: string) {
  const url = new URL(supabaseUrl);
  if (url.hostname.endsWith(".supabase.co") && !url.hostname.endsWith(".storage.supabase.co")) {
    url.hostname = url.hostname.replace(/\.supabase\.co$/, ".storage.supabase.co");
  }
  url.pathname = "/storage/v1/upload/resumable";
  url.search = "";
  return url.toString();
}

async function uploadWithTus({
  accessToken,
  file,
  onProgress,
  path,
}: {
  accessToken: string;
  file: File;
  onProgress: (progress: number) => void;
  path: string;
}) {
  const [{ Upload }, { publishableKey, url }] = await Promise.all([
    import("tus-js-client"),
    Promise.resolve(getSupabasePublicConfig()),
  ]);

  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      chunkSize: TUS_CHUNK_BYTES,
      endpoint: resumableUploadEndpoint(url),
      headers: {
        apikey: publishableKey,
        authorization: `Bearer ${accessToken}`,
        "x-upsert": "false",
      },
      metadata: {
        bucketName: "persona-models",
        cacheControl: "3600",
        contentType: PERSONA_GLB_MIME_TYPE,
        fileName: file.name,
        objectName: path,
      },
      onError: reject,
      onProgress(bytesUploaded, bytesTotal) {
        onProgress(bytesTotal ? Math.round((bytesUploaded / bytesTotal) * 100) : 0);
      },
      onSuccess: () => resolve(),
      removeFingerprintOnSuccess: true,
      retryDelays: [0, 3000, 5000, 10_000, 20_000],
      uploadDataDuringCreation: true,
    });
    upload.start();
  });
}

export function PersonaAvatarManager({ personas, viewerId }: PersonaAvatarManagerProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [busyPersonaId, setBusyPersonaId] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const models = personas.flatMap((persona) => {
    if (!persona.avatarModel?.modelUrl) return [];
    return [{
      accent: SLOT_ACCENTS[persona.slot - 1] ?? SLOT_ACCENTS[0],
      displayScale: 1,
      label: persona.avatarModel.original_filename,
      modelUrl: persona.avatarModel.modelUrl,
      slot: persona.slot as PersonaAvatarSlot,
      verticalOffset: 0,
    } satisfies PersonaAvatarModelConfig];
  });

  function begin(personaId: string) {
    setBusyPersonaId(personaId);
    setDeleteConfirm("");
    setError("");
    setMessage("");
    setProgress(0);
  }

  async function uploadModel(event: FormEvent<HTMLFormElement>, persona: PersonaItem) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("model");
    if (!(file instanceof File) || !file.size) {
      setError("请选择 GLB 文件。");
      return;
    }

    const validationError = await validatePersonaGlb(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    begin(persona.id);
    const storagePath = personaGlbStoragePath(viewerId, persona.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("登录状态已失效，请刷新页面后重试。");

      await uploadWithTus({ accessToken, file, onProgress: setProgress, path: storagePath });
      const response = await fetch(`/api/personas/${persona.id}/avatar-model`, {
        body: JSON.stringify({
          byteSize: file.size,
          originalFilename: file.name,
          storagePath,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json() as { cleanupPending?: boolean; error?: string };
      if (!response.ok) throw new Error(payload.error || "GLB 登记失败。");

      form.reset();
      setMessage(payload.cleanupPending
        ? `${persona.name} 的新形象已生效；旧文件将在稍后清理。`
        : `${persona.name} 的 3D 形象已更新。`);
      setBusyPersonaId("");
      router.refresh();
    } catch (cause) {
      await supabase.storage.from("persona-models").remove([storagePath]);
      setBusyPersonaId("");
      setError(cause instanceof Error ? cause.message : "GLB 上传失败，请重试。");
    }
  }

  async function deleteModel(persona: PersonaItem) {
    const model = persona.avatarModel;
    if (!model) return;
    if (deleteConfirm !== model.id) {
      setDeleteConfirm(model.id);
      return;
    }

    begin(persona.id);
    const response = await fetch(`/api/personas/${persona.id}/avatar-model`, {
      body: JSON.stringify({ modelId: model.id, storagePath: model.storage_path }),
      headers: { "Content-Type": "application/json" },
      method: "DELETE",
    });
    const payload = await response.json() as { error?: string };
    setBusyPersonaId("");
    if (!response.ok) {
      setError(payload.error || "GLB 删除失败。");
      return;
    }
    setMessage(`${persona.name} 的 3D 形象已移除。`);
    router.refresh();
  }

  return (
    <section className="mt-6 overflow-hidden rounded-[1.65rem] border border-cobalt/12 bg-white/42 p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 font-mono text-[0.62rem] font-bold uppercase tracking-[0.18em] text-cobalt">
            <Box size={14} aria-hidden="true" /> Persona 3D identity
          </p>
          <h3 className="mt-2 font-display text-2xl font-semibold text-forest">为 Persona 添加 GLB 形象</h3>
          <p className="mt-2 max-w-2xl text-xs leading-6 text-forest/48">
            每个 Persona 可绑定一个不超过 50 MB 的 GLB 2.0 文件。模型存放在私有空间；只有公开且启用的 Persona 才会向其他登录用户展示。
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-forest/7 px-3 py-2 text-[0.65rem] font-bold text-forest/62">
          <ShieldCheck size={14} aria-hidden="true" /> 私有存储 · 权限校验
        </span>
      </div>

      {models.length ? <PersonaAvatarShowcase models={models} personas={personas} /> : null}

      <div className="mt-5 min-h-6" aria-live="polite">
        {message ? <p className="text-sm font-semibold text-forest">{message}</p> : null}
        {error ? <p role="alert" className="text-sm font-semibold text-signal">{error}</p> : null}
      </div>

      {personas.length ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {personas.map((persona) => {
            const busy = busyPersonaId === persona.id;
            const model = persona.avatarModel;
            return (
              <form
                key={persona.id}
                onSubmit={(event) => void uploadModel(event, persona)}
                className="flex min-w-0 flex-col rounded-[1.25rem] border border-forest/10 bg-paper/55 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-cobalt">Persona 0{persona.slot}</p>
                    <p className="mt-1 truncate text-sm font-bold text-forest">{persona.name}</p>
                  </div>
                  {model ? (
                    <button
                      type="button"
                      disabled={Boolean(busyPersonaId)}
                      onClick={() => void deleteModel(persona)}
                      className="grid size-9 shrink-0 place-items-center rounded-full bg-signal/8 text-signal disabled:opacity-45"
                      aria-label={deleteConfirm === model.id ? `确认删除 ${persona.name} 的 3D 形象` : `删除 ${persona.name} 的 3D 形象`}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
                <p className="mt-3 min-h-10 break-all text-[0.68rem] leading-5 text-forest/42">
                  {model ? `${model.original_filename} · ${(model.byte_size / 1024 / 1024).toFixed(1)} MB` : "尚未添加 3D 形象"}
                </p>
                <input
                  type="file"
                  name="model"
                  required
                  accept=".glb,model/gltf-binary,application/octet-stream"
                  disabled={Boolean(busyPersonaId)}
                  className="mt-3 min-w-0 text-[0.65rem] text-forest/52 file:mr-2 file:rounded-full file:border-0 file:bg-forest file:px-3 file:py-2 file:text-[0.65rem] file:font-bold file:text-paper disabled:opacity-45"
                />
                {busy ? (
                  <div className="mt-3" aria-label={`上传进度 ${progress}%`}>
                    <div className="h-1.5 overflow-hidden rounded-full bg-forest/8">
                      <div className="h-full rounded-full bg-cobalt transition-[width]" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="mt-1 text-right font-mono text-[0.58rem] text-forest/42">{progress}%</p>
                  </div>
                ) : null}
                <button
                  disabled={Boolean(busyPersonaId)}
                  className="mt-3 inline-flex items-center justify-center gap-2 rounded-full bg-cobalt px-4 py-2.5 text-xs font-bold text-white disabled:opacity-45"
                >
                  {busy ? <LoaderCircle className="animate-spin" size={15} aria-hidden="true" /> : <UploadCloud size={15} aria-hidden="true" />}
                  {model ? "替换 GLB" : "上传 GLB"}
                </button>
                {model && deleteConfirm === model.id ? (
                  <p className="mt-2 text-center text-[0.62rem] font-semibold text-signal">再次点击垃圾桶确认删除</p>
                ) : null}
              </form>
            );
          })}
        </div>
      ) : (
        <p className="mt-5 rounded-xl border border-dashed border-forest/15 p-5 text-center text-xs text-forest/42">
          先创建一个 Persona，再为它上传 GLB 形象。
        </p>
      )}
    </section>
  );
}
