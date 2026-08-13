import { NextResponse, type NextRequest } from "next/server";

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

export async function DELETE(request: NextRequest, context: { params: Promise<{ personaId: string }> }) {
  const { personaId } = await context.params;
  const { supabase, userId } = await requireUser();
  if (!userId) return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  if (!UUID_PATTERN.test(personaId)) return NextResponse.json({ error: "Persona 不存在。" }, { status: 404 });

  try {
    const body = await request.json() as { assetId?: unknown; storagePath?: unknown };
    const assetId = typeof body.assetId === "string" ? body.assetId : "";
    const suppliedPath = typeof body.storagePath === "string" ? body.storagePath : "";
    if (!UUID_PATTERN.test(assetId) || !suppliedPath.startsWith(`${userId}/${personaId}/`)) {
      return NextResponse.json({ error: "图片记录无效。" }, { status: 400 });
    }

    const { data: trustedPath, error: prepareError } = await supabase.rpc("prepare_persona_asset_deletion", {
      p_persona_id: personaId,
      p_asset_id: assetId,
    });
    if (prepareError) {
      if (prepareError.message.includes("CONFIRMED_SOURCE_CANNOT_BE_DELETED")) {
        return NextResponse.json({ error: "该图片仍是已确认知识的来源，不能删除。" }, { status: 409 });
      }
      if (prepareError.message.includes("ANALYSIS_IN_PROGRESS")) {
        return NextResponse.json({ error: "图片正在分析，完成后再删除。" }, { status: 409 });
      }
      if (!prepareError.message.includes("PERSONA_ASSET_NOT_FOUND")) throw prepareError;
    }

    const path = typeof trustedPath === "string" ? trustedPath : suppliedPath;
    if (path !== suppliedPath) return NextResponse.json({ error: "图片路径校验失败。" }, { status: 400 });
    const { error: storageError } = await supabase.storage.from("persona-assets").remove([path]);
    if (storageError) return NextResponse.json({ error: "图片记录已移除，但对象清理失败；可再次点击重试。" }, { status: 503 });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "图片暂时无法删除。" }, { status: 500 });
  }
}
