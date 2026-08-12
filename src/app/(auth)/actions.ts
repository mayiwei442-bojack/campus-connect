"use server";

import { redirect } from "next/navigation";

import type { AuthActionState } from "@/lib/auth/action-state";
import {
  getSafeAuthErrorMessage,
  validateLoginForm,
  validateRegistrationForm,
  validationErrorState,
} from "@/lib/auth/validation";
import { getSiteUrl } from "@/lib/site-url";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const missingConfigurationState: AuthActionState = {
  message: "Supabase 项目尚未连接。请先完成环境变量配置。",
  status: "error",
};

export async function loginAction(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const { email, fieldErrors, password } = validateLoginForm(formData);
  const validationState = validationErrorState(fieldErrors, { email });

  if (validationState) return validationState;
  if (!isSupabaseConfigured()) return missingConfigurationState;

  const supabase = await createClient();

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return {
        message: getSafeAuthErrorMessage(error, "login"),
        status: "error",
        values: { email },
      };
    }
  } catch {
    return {
      message: "认证服务暂时无法连接，请检查网络后重试。",
      status: "error",
      values: { email },
    };
  }

  redirect("/home");
}

export async function registerAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const { email, fieldErrors, nickname, password } = validateRegistrationForm(formData);
  const validationState = validationErrorState(fieldErrors, { email, nickname });

  if (validationState) return validationState;
  if (!isSupabaseConfigured()) return missingConfigurationState;

  const supabase = await createClient();
  const siteUrl = await getSiteUrl();
  let hasSession = false;

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nickname },
        emailRedirectTo: `${siteUrl}/auth/confirm`,
      },
    });

    if (error) {
      return {
        message: getSafeAuthErrorMessage(error, "register"),
        status: "error",
        values: { email, nickname },
      };
    }

    hasSession = Boolean(data.session);
  } catch {
    return {
      message: "认证服务暂时无法连接，请检查网络后重试。",
      status: "error",
      values: { email, nickname },
    };
  }

  if (hasSession) {
    redirect("/home");
  }

  return {
    message: "确认邮件已经发出。请在同一台设备上打开邮件中的链接完成注册。",
    status: "success",
    values: { email, nickname },
  };
}

export async function logoutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut().catch(() => undefined);
  }

  redirect("/login?message=signed_out");
}
