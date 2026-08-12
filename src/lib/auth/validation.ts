import type { AuthError } from "@supabase/supabase-js";

import type { AuthActionState, AuthFieldErrors } from "@/lib/auth/action-state";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isEmail(value: string) {
  return EMAIL_PATTERN.test(value);
}

export function validateLoginForm(formData: FormData) {
  const email = readFormValue(formData, "email").toLowerCase();
  const passwordValue = formData.get("password");
  const password = typeof passwordValue === "string" ? passwordValue : "";
  const fieldErrors: AuthFieldErrors = {};

  if (!isEmail(email)) fieldErrors.email = "请输入有效的邮箱地址。";
  if (!password) fieldErrors.password = "请输入密码。";

  return { email, fieldErrors, password };
}

export function validateRegistrationForm(formData: FormData) {
  const nickname = readFormValue(formData, "nickname");
  const email = readFormValue(formData, "email").toLowerCase();
  const passwordValue = formData.get("password");
  const confirmPasswordValue = formData.get("confirmPassword");
  const password = typeof passwordValue === "string" ? passwordValue : "";
  const confirmPassword = typeof confirmPasswordValue === "string" ? confirmPasswordValue : "";
  const fieldErrors: AuthFieldErrors = {};

  if (Array.from(nickname).length < 2 || Array.from(nickname).length > 24) {
    fieldErrors.nickname = "昵称需要 2–24 个字符。";
  }
  if (!isEmail(email)) fieldErrors.email = "请输入有效的邮箱地址。";
  if (password.length < 8) fieldErrors.password = "密码至少需要 8 个字符。";
  if (password.length > 72) fieldErrors.password = "密码不能超过 72 个字符。";
  if (confirmPassword !== password) fieldErrors.confirmPassword = "两次输入的密码不一致。";

  return { confirmPassword, email, fieldErrors, nickname, password };
}

export function validationErrorState(
  fieldErrors: AuthFieldErrors,
  values: AuthActionState["values"],
): AuthActionState | null {
  if (Object.keys(fieldErrors).length === 0) {
    return null;
  }

  return {
    fieldErrors,
    message: "请检查标记的内容后再提交。",
    status: "error",
    values,
  };
}

export function getSafeAuthErrorMessage(error: AuthError, mode: "login" | "register") {
  switch (error.code) {
    case "email_not_confirmed":
      return "邮箱还没有完成确认，请先查看确认邮件。";
    case "weak_password":
      return "这个密码强度不足，请换一个更长、更难猜的密码。";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "请求过于频繁，请稍后再试。";
    case "user_already_exists":
      return "这个邮箱无法完成注册，请尝试登录或更换邮箱。";
    case "invalid_credentials":
      return "邮箱或密码不正确。";
    default:
      return mode === "login" ? "暂时无法登录，请稍后重试。" : "暂时无法注册，请稍后重试。";
  }
}
