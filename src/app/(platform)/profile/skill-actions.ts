"use server";

import { revalidatePath } from "next/cache";

import type { SkillActionState } from "@/lib/skill/action-state";
import {
  normalizeSkillNameForLookup,
  skillValidationErrorState,
  UUID_PATTERN,
  validateSkillForm,
} from "@/lib/skill/validation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const DUPLICATE_KEY_CODE = "23505";

function errorState(message: string, values?: SkillActionState["values"]): SkillActionState {
  return { message, status: "error", values };
}

async function getAuthenticatedUserId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  return error ? null : userId;
}

function revalidateProfile(userId: string) {
  revalidatePath("/profile/me");
  revalidatePath(`/profile/${userId}`);
}

export async function addProfileSkillAction(
  _previousState: SkillActionState,
  formData: FormData,
): Promise<SkillActionState> {
  const { fieldErrors, values } = validateSkillForm(formData);
  const validationState = skillValidationErrorState(fieldErrors, values);

  if (validationState) return validationState;
  if (!isSupabaseConfigured()) return errorState("Supabase 项目尚未连接，Skill 没有保存。", values);

  const supabase = await createClient();

  try {
    const userId = await getAuthenticatedUserId(supabase);
    if (!userId) return errorState("登录状态已经失效，请重新登录后再添加。", values);

    const normalizedName = normalizeSkillNameForLookup(values.name);
    let { data: skill } = await supabase
      .from("skills")
      .select("id")
      .eq("kind", values.kind)
      .eq("normalized_name", normalizedName)
      .maybeSingle();

    if (!skill) {
      const { data: insertedSkill, error: skillError } = await supabase
        .from("skills")
        .insert({ created_by: userId, kind: values.kind, name: values.name })
        .select("id")
        .single();

      if (skillError?.code === DUPLICATE_KEY_CODE) {
        const { data: concurrentSkill } = await supabase
          .from("skills")
          .select("id")
          .eq("kind", values.kind)
          .eq("normalized_name", normalizedName)
          .maybeSingle();
        skill = concurrentSkill;
      } else if (skillError) {
        return errorState("Skill 目录暂时无法更新，请稍后重试。", values);
      } else {
        skill = insertedSkill;
      }
    }

    if (!skill) return errorState("Skill 目录暂时无法读取，请稍后重试。", values);

    const { error } = await supabase.from("profile_skills").insert({
      allow_contact: values.allowContact,
      allow_matching: values.allowMatching,
      is_public: values.isPublic,
      note: values.note || null,
      profile_id: userId,
      self_rating: values.selfRating,
      skill_id: skill.id,
    });

    if (error?.code === DUPLICATE_KEY_CODE) {
      return errorState("这个 Skill 已经在你的名片里，可以直接编辑现有条目。", values);
    }
    if (error) return errorState("Skill 暂时无法添加，请稍后重试。", values);

    revalidateProfile(userId);

    return { message: "Skill 已加入你的校园名片。", status: "success" };
  } catch {
    return errorState("Skill 服务暂时无法连接，请检查网络后重试。", values);
  }
}

export async function manageProfileSkillAction(
  _previousState: SkillActionState,
  formData: FormData,
): Promise<SkillActionState> {
  const profileSkillId = formData.get("profileSkillId");
  const operation = formData.get("operation");

  if (typeof profileSkillId !== "string" || !UUID_PATTERN.test(profileSkillId)) {
    return errorState("无法识别这条 Skill 记录。请刷新页面后重试。");
  }
  if (operation !== "update" && operation !== "delete") {
    return errorState("不支持这项 Skill 操作。请刷新页面后重试。");
  }
  if (!isSupabaseConfigured()) return errorState("Supabase 项目尚未连接，Skill 没有改变。");

  const supabase = await createClient();

  try {
    const userId = await getAuthenticatedUserId(supabase);
    if (!userId) return errorState("登录状态已经失效，请重新登录后再操作。");

    if (operation === "delete") {
      const { data, error } = await supabase
        .from("profile_skills")
        .delete()
        .eq("id", profileSkillId)
        .eq("profile_id", userId)
        .select("id")
        .maybeSingle();

      if (error || !data) return errorState("Skill 无法移除，它可能已经不存在。");

      revalidateProfile(userId);
      return { message: "Skill 已从你的名片移除。", status: "success" };
    }

    const { fieldErrors, values } = validateSkillForm(formData);
    const validationState = skillValidationErrorState(fieldErrors, values);
    if (validationState) return validationState;

    const { data, error } = await supabase
      .from("profile_skills")
      .update({
        allow_contact: values.allowContact,
        allow_matching: values.allowMatching,
        is_public: values.isPublic,
        note: values.note || null,
        self_rating: values.selfRating,
      })
      .eq("id", profileSkillId)
      .eq("profile_id", userId)
      .select("id")
      .maybeSingle();

    if (error || !data) return errorState("Skill 设置暂时无法保存，请稍后重试。", values);

    revalidateProfile(userId);
    return { message: "Skill 设置已更新。", status: "success", values };
  } catch {
    return errorState("Skill 服务暂时无法连接，请检查网络后重试。");
  }
}
