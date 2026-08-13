import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import {
  profileBackgroundExtension,
  validateProfileBackground,
} from "@/lib/profile/background";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  return { supabase, userId };
}

export async function POST(request: NextRequest) {
  const { supabase, userId } = await requireUser();
  if (!userId) return NextResponse.json({ error: "请先登录。" }, { status: 401 });

  let storagePath = "";

  try {
    const formData = await request.formData();
    const background = formData.get("background");
    if (!(background instanceof File)) {
      return NextResponse.json({ error: "请选择一张背景图片。" }, { status: 400 });
    }

    const validationError = validateProfileBackground(background);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    storagePath = `${userId}/${crypto.randomUUID()}.${profileBackgroundExtension(background.type)}`;
    const { error: uploadError } = await supabase.storage
      .from("profile-backgrounds")
      .upload(storagePath, background, {
        cacheControl: "3600",
        contentType: background.type,
        upsert: false,
      });
    if (uploadError) {
      return NextResponse.json({ error: "背景图片上传失败，请稍后重试。" }, { status: 502 });
    }

    const { data: previousPath, error: registerError } = await supabase.rpc("set_profile_background", {
      p_storage_path: storagePath,
    });
    if (registerError) {
      await supabase.storage.from("profile-backgrounds").remove([storagePath]);
      return NextResponse.json({ error: "背景图片已上传，但资料保存失败。" }, { status: 400 });
    }

    const { error: cleanupError } = previousPath && previousPath !== storagePath
      ? await supabase.storage.from("profile-backgrounds").remove([previousPath])
      : { error: null };

    revalidatePath("/profile/me");
    revalidatePath(`/profile/${userId}`);
    return NextResponse.json({ cleanupPending: Boolean(cleanupError), storagePath }, { status: 201 });
  } catch {
    if (storagePath) await supabase.storage.from("profile-backgrounds").remove([storagePath]);
    return NextResponse.json({ error: "背景图片暂时无法保存，请稍后重试。" }, { status: 500 });
  }
}
