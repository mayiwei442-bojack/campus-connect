"use server";

import { revalidatePath } from "next/cache";

import type { ProfileActionState } from "@/lib/profile/action-state";
import { profileValidationErrorState, validateProfileForm } from "@/lib/profile/validation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function updateProfileAction(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const { fieldErrors, values } = validateProfileForm(formData);
  const validationState = profileValidationErrorState(fieldErrors, values);

  if (validationState) return validationState;
  if (!isSupabaseConfigured()) {
    return {
      message: "Supabase 项目尚未连接，资料没有保存。",
      status: "error",
      values,
    };
  }

  const supabase = await createClient();

  try {
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;

    if (claimsError || !userId) {
      return {
        message: "登录状态已经失效，请重新登录后再保存。",
        status: "error",
        values,
      };
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({
        allow_matching: values.allowMatching,
        allow_stranger_messages: values.allowStrangerMessages,
        bio: values.bio || null,
        campus: values.campus || null,
        is_public: values.isPublic,
        nickname: values.nickname,
      })
      .eq("id", userId)
      .select("id")
      .single();

    if (error || !data) {
      return {
        message: "资料暂时无法保存，请稍后重试。",
        status: "error",
        values,
      };
    }

    revalidatePath("/profile/me");
    revalidatePath(`/profile/${userId}`);

    return {
      message: "资料已保存，新的公开范围立即生效。",
      status: "success",
      values,
    };
  } catch {
    return {
      message: "资料服务暂时无法连接，请检查网络后重试。",
      status: "error",
      values,
    };
  }
}
