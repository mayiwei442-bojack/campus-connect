import { Buffer } from "node:buffer";

import { NextResponse, type NextRequest } from "next/server";

import { DashscopeUnavailableError, requestPersonaImageAnalysis } from "@/lib/ai/dashscope";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maximumBase64SourceBytes = 7 * 1024 * 1024;

function asRecord(value: Json | null) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, Json | undefined> : null;
}

function text(value: Json | undefined, maximum = 500) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

export async function POST(request: NextRequest, context: { params: Promise<{ personaId: string }> }) {
  const { personaId } = await context.params;
  let assetId = "";
  let analysisNonce = "";
  let analysisStarted = false;
  const supabase = await createClient();

  try {
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
    if (!userId) return NextResponse.json({ error: "请先登录。" }, { status: 401 });
    if (!UUID_PATTERN.test(personaId)) return NextResponse.json({ error: "Persona 不存在。" }, { status: 404 });

    const body = await request.json() as { assetId?: unknown };
    assetId = typeof body.assetId === "string" ? body.assetId : "";
    if (!UUID_PATTERN.test(assetId)) return NextResponse.json({ error: "图片记录无效。" }, { status: 400 });

    const { data: withinLimit, error: limitError } = await supabase.rpc("consume_persona_ai_rate_limit", { p_scope: "analyze" });
    if (limitError) throw new Error("图片理解限流检查失败。");
    if (!withinLimit) return NextResponse.json({ error: "图片理解请求过于频繁，请稍后再试。" }, { status: 429 });

    const { data: rawAsset, error: beginError } = await supabase.rpc("begin_persona_asset_analysis", {
      p_persona_id: personaId,
      p_asset_id: assetId,
    });
    if (beginError) {
      const inProgress = beginError.message.includes("ANALYSIS_IN_PROGRESS");
      return NextResponse.json({ error: inProgress ? "这张图片正在分析中。" : "无法分析这张图片。" }, { status: inProgress ? 409 : 404 });
    }
    analysisStarted = true;
    const asset = asRecord(rawAsset);
    if (!asset) throw new Error("图片记录返回格式无效。");
    analysisNonce = text(asset.analysisNonce, 80);
    if (!UUID_PATTERN.test(analysisNonce)) throw new Error("图片分析状态无效。");

    const storagePath = text(asset.storagePath, 500);
    const mimeType = text(asset.mimeType, 80);
    const byteSize = typeof asset.byteSize === "number" ? asset.byteSize : 0;
    if (!storagePath || !["image/jpeg", "image/png", "image/webp"].includes(mimeType)) throw new Error("图片格式不受支持。");
    if (byteSize < 1 || byteSize > maximumBase64SourceBytes) throw new Error("图片需小于 7 MB 才能自动理解；图片本身仍已安全保存。 ");

    const { data: blob, error: downloadError } = await supabase.storage.from("persona-assets").download(storagePath);
    if (downloadError || !blob) throw new Error("图片暂时无法读取。");
    const bytes = Buffer.from(await blob.arrayBuffer());
    if (!bytes.length || bytes.length > maximumBase64SourceBytes) throw new Error("图片需小于 7 MB 才能自动理解；图片本身仍已安全保存。");

    const analysis = await requestPersonaImageAnalysis({
      dataUrl: `data:${mimeType};base64,${bytes.toString("base64")}`,
      personaName: text(asset.personaName, 40) || "未命名 Persona",
      personaTopic: text(asset.personaTopic, 80) || "校园经历",
      userDescription: text(asset.userDescription, 500) || null,
    });
    const { error: completeError } = await supabase.rpc("complete_persona_asset_analysis", {
      p_persona_id: personaId,
      p_asset_id: assetId,
      p_analysis_nonce: analysisNonce,
      p_model_name: analysis.model,
      p_entries: analysis.entries as unknown as Json,
    });
    if (completeError) throw new Error("分析草稿暂时无法保存。");
    analysisStarted = false;

    return NextResponse.json({ entryCount: analysis.entries.length, model: analysis.model, status: "ready" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "图片理解暂时不可用。";
    if (analysisStarted && assetId && UUID_PATTERN.test(analysisNonce)) {
      await supabase.rpc("fail_persona_asset_analysis", {
        p_persona_id: personaId,
        p_asset_id: assetId,
        p_analysis_nonce: analysisNonce,
        p_error: message,
      });
    }
    const isInputError = /格式|7 MB|无效/.test(message);
    return NextResponse.json(
      { error: error instanceof DashscopeUnavailableError ? message : isInputError ? message : "图片理解暂时不可用，图片和人工录入仍可继续使用。" },
      { status: isInputError ? 400 : 503 },
    );
  }
}
