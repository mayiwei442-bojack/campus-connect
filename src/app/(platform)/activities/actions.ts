"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { parseActivityDraft } from "@/lib/activity/validation";
import { createClient } from "@/lib/supabase/server";

export type CreateActivityState = { message: string; status: "idle" | "error" };

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!userId) {
    throw new Error("请先登录。");
  }
  return { supabase, userId };
}

function refreshActivityPaths(activityId?: string) {
  revalidatePath("/home");
  revalidatePath("/map");
  revalidatePath("/messages");
  if (activityId) {
    revalidatePath(`/activities/${activityId}`);
  }
}

export async function createActivityAction(
  _previousState: CreateActivityState,
  formData: FormData,
): Promise<CreateActivityState> {
  try {
    const draft = parseActivityDraft(formData);
    const { supabase } = await requireUser();
    const { data: activityId, error } = await supabase.rpc("create_activity", {
      p_place_id: draft.placeId,
      p_title: draft.title,
      p_description: draft.description ?? undefined,
      p_starts_at: draft.startsAt ?? undefined,
      p_ends_at: draft.endsAt ?? undefined,
      p_capacity: draft.capacity ?? undefined,
      p_join_mode: draft.joinMode,
    });

    if (error || !activityId) {
      return { status: "error", message: "活动创建失败，请稍后重试。" };
    }

    refreshActivityPaths(activityId);
    redirect(`/activities/${activityId}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) {
      throw error;
    }
    return { status: "error", message: error instanceof Error ? error.message : "活动创建失败。" };
  }
}

export async function joinActivityAction(formData: FormData) {
  const activityId = String(formData.get("activityId") ?? "");
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("join_activity", { p_activity_id: activityId });
  if (error) {
    throw new Error("暂时无法加入该活动。");
  }
  refreshActivityPaths(activityId);
}

export async function reviewActivityRequestAction(formData: FormData) {
  const activityId = String(formData.get("activityId") ?? "");
  const profileId = String(formData.get("profileId") ?? "");
  const approve = String(formData.get("decision")) === "approve";
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("respond_activity_join_request", {
    p_activity_id: activityId,
    p_profile_id: profileId,
    p_approve: approve,
  });
  if (error) {
    throw new Error("无法处理该加入申请。");
  }
  refreshActivityPaths(activityId);
}

export async function leaveActivityAction(formData: FormData) {
  const activityId = String(formData.get("activityId") ?? "");
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("leave_activity", { p_activity_id: activityId });
  if (error) {
    throw new Error("暂时无法退出该活动。");
  }
  refreshActivityPaths(activityId);
}

export async function endActivityAction(formData: FormData) {
  const activityId = String(formData.get("activityId") ?? "");
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("end_activity", { p_activity_id: activityId });
  if (error) {
    throw new Error("暂时无法结束该活动。");
  }
  refreshActivityPaths(activityId);
}

export async function removeActivityMemberAction(formData: FormData) {
  const activityId = String(formData.get("activityId") ?? "");
  const profileId = String(formData.get("profileId") ?? "");
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("remove_activity_member", {
    p_activity_id: activityId,
    p_profile_id: profileId,
  });
  if (error) {
    throw new Error("暂时无法移除该成员。");
  }
  refreshActivityPaths(activityId);
}
