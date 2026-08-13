"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type InvitationResponseState = {
  message: string;
  status: "idle" | "error" | "success";
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function respondActivityInvitationAction(
  _previousState: InvitationResponseState,
  formData: FormData,
): Promise<InvitationResponseState> {
  const invitationId = String(formData.get("invitationId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!UUID_PATTERN.test(invitationId) || !["accept", "decline"].includes(decision)) {
    return { message: "邀请信息无效，请刷新后重试。", status: "error" };
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return { message: "登录状态已失效，请重新登录。", status: "error" };

  const { data: invitation, error: invitationError } = await supabase
    .from("activity_invitations")
    .select("activity_id")
    .eq("id", invitationId)
    .eq("invitee_id", userId)
    .eq("status", "pending")
    .maybeSingle();
  if (invitationError || !invitation) {
    return { message: "这条邀请已处理或不可用。", status: "error" };
  }

  const accepted = decision === "accept";
  const { error } = await supabase.rpc("respond_activity_invitation", {
    p_accept: accepted,
    p_invitation_id: invitationId,
  });
  if (error) {
    return { message: accepted ? "暂时无法接受邀请，请稍后重试。" : "暂时无法婉拒邀请，请稍后重试。", status: "error" };
  }

  revalidatePath("/notifications");
  revalidatePath("/home");
  revalidatePath("/messages");
  revalidatePath(`/activities/${invitation.activity_id}`);

  if (accepted) redirect(`/activities/${invitation.activity_id}`);
  return { message: "已婉拒这条活动邀请。", status: "success" };
}
