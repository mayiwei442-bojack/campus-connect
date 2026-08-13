import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import {
  MAX_PERSONA_GLB_JSON_BYTES,
  PERSONA_GLB_MIME_TYPE,
  readGlbJsonChunkLength,
  validateGlbJsonChunk,
  validatePersonaGlbMetadata,
} from "@/lib/persona/avatar-models";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  return { supabase, userId };
}

async function readSignedPrefix(url: string, byteCount: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Range: `bytes=0-${byteCount - 1}` },
      signal: controller.signal,
    });
    if (!response.ok || !response.body) throw new Error("MODEL_DOWNLOAD_FAILED");

    const result = new Uint8Array(byteCount);
    const reader = response.body.getReader();
    let offset = 0;
    while (offset < byteCount) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = byteCount - offset;
      result.set(value.subarray(0, remaining), offset);
      offset += Math.min(value.byteLength, remaining);
    }
    void reader.cancel().catch(() => undefined);
    if (offset < byteCount) throw new Error("MODEL_DOWNLOAD_INCOMPLETE");
    return result;
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

function registrationValues(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return {
    id: typeof record.id === "string" ? record.id : null,
    previousStoragePath: typeof record.previousStoragePath === "string" ? record.previousStoragePath : null,
  };
}

export async function POST(request: NextRequest, context: { params: Promise<{ personaId: string }> }) {
  const { personaId } = await context.params;
  const { supabase, userId } = await requireUser();
  if (!userId) return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  if (!UUID_PATTERN.test(personaId)) return NextResponse.json({ error: "Persona 不存在。" }, { status: 404 });

  let storagePath = "";
  try {
    const body = await request.json() as {
      byteSize?: unknown;
      originalFilename?: unknown;
      storagePath?: unknown;
    };
    const byteSize = typeof body.byteSize === "number" ? body.byteSize : 0;
    const originalFilename = typeof body.originalFilename === "string" ? body.originalFilename.trim() : "";
    storagePath = typeof body.storagePath === "string" ? body.storagePath : "";
    const metadataError = validatePersonaGlbMetadata({
      name: originalFilename,
      size: byteSize,
      type: PERSONA_GLB_MIME_TYPE,
    });
    if (
      metadataError
      || !Number.isSafeInteger(byteSize)
      || originalFilename.length > 255
      || !storagePath.startsWith(`${userId}/${personaId}/`)
      || !storagePath.toLowerCase().endsWith(".glb")
    ) {
      return NextResponse.json({ error: metadataError || "GLB 上传记录无效。" }, { status: 400 });
    }

    const { data: signed, error: signError } = await supabase.storage
      .from("persona-models")
      .createSignedUrl(storagePath, 120);
    if (signError || !signed?.signedUrl) {
      return NextResponse.json({ error: "找不到刚上传的 GLB 文件。" }, { status: 404 });
    }

    const header = await readSignedPrefix(signed.signedUrl, 20);
    const { error: headerError, jsonByteSize } = readGlbJsonChunkLength(header, byteSize);
    if (headerError || jsonByteSize > MAX_PERSONA_GLB_JSON_BYTES) {
      await supabase.storage.from("persona-models").remove([storagePath]);
      return NextResponse.json({ error: headerError || "GLB 场景描述过大。" }, { status: 400 });
    }

    const scenePrefix = await readSignedPrefix(signed.signedUrl, 20 + jsonByteSize);
    const sceneError = validateGlbJsonChunk(scenePrefix, jsonByteSize);
    if (sceneError) {
      await supabase.storage.from("persona-models").remove([storagePath]);
      return NextResponse.json({ error: sceneError }, { status: 400 });
    }

    const { data: registered, error: registerError } = await supabase.rpc("register_persona_avatar_model", {
      p_byte_size: byteSize,
      p_original_filename: originalFilename,
      p_persona_id: personaId,
      p_storage_path: storagePath,
    });
    const registration = registrationValues(registered);
    if (registerError || !registration?.id) {
      await supabase.storage.from("persona-models").remove([storagePath]);
      const denied = registerError?.message.includes("PERSONA_NOT_FOUND");
      return NextResponse.json({ error: denied ? "你不能修改这个 Persona。" : "GLB 登记失败，上传对象已清理。" }, { status: denied ? 403 : 400 });
    }

    let cleanupPending = false;
    if (registration.previousStoragePath && registration.previousStoragePath !== storagePath) {
      const { error: cleanupError } = await supabase.storage
        .from("persona-models")
        .remove([registration.previousStoragePath]);
      cleanupPending = Boolean(cleanupError);
    }

    revalidatePath("/profile/me");
    revalidatePath(`/profile/${userId}`);
    return NextResponse.json({ id: registration.id, cleanupPending }, { status: 201 });
  } catch (cause) {
    if (storagePath) await supabase.storage.from("persona-models").remove([storagePath]);
    const unavailable = cause instanceof Error && cause.message.startsWith("MODEL_DOWNLOAD_");
    return NextResponse.json(
      { error: unavailable ? "GLB 校验服务暂时无法读取该文件，请重试。" : "GLB 暂时无法登记。" },
      { status: unavailable ? 503 : 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ personaId: string }> }) {
  const { personaId } = await context.params;
  const { supabase, userId } = await requireUser();
  if (!userId) return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  if (!UUID_PATTERN.test(personaId)) return NextResponse.json({ error: "Persona 不存在。" }, { status: 404 });

  try {
    const body = await request.json() as { modelId?: unknown; storagePath?: unknown };
    const modelId = typeof body.modelId === "string" ? body.modelId : "";
    const suppliedPath = typeof body.storagePath === "string" ? body.storagePath : "";
    if (!UUID_PATTERN.test(modelId) || !suppliedPath.startsWith(`${userId}/${personaId}/`)) {
      return NextResponse.json({ error: "GLB 记录无效。" }, { status: 400 });
    }

    const { data: trustedPath, error: prepareError } = await supabase.rpc("prepare_persona_avatar_model_deletion", {
      p_model_id: modelId,
      p_persona_id: personaId,
    });
    if (prepareError && !prepareError.message.includes("PERSONA_AVATAR_MODEL_NOT_FOUND")) {
      return NextResponse.json({ error: "你不能删除这个 GLB 形象。" }, { status: 403 });
    }

    const path = typeof trustedPath === "string" ? trustedPath : suppliedPath;
    if (path !== suppliedPath) return NextResponse.json({ error: "GLB 路径校验失败。" }, { status: 400 });
    const { error: storageError } = await supabase.storage.from("persona-models").remove([path]);
    if (storageError) {
      return NextResponse.json({ error: "形象记录已移除，但存储清理暂时失败；再次点击删除即可重试。" }, { status: 503 });
    }

    revalidatePath("/profile/me");
    revalidatePath(`/profile/${userId}`);
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "GLB 形象暂时无法删除。" }, { status: 500 });
  }
}
