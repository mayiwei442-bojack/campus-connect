import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "登录",
  description: "登录 Campus Connect，继续校园活动、协作与真实连接。",
};

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const query = await searchParams;
  const message = typeof query.message === "string" ? query.message : null;
  const error = typeof query.error === "string" ? query.error : null;
  const notice = typeof query.notice === "string" ? query.notice : null;
  const initialNotice =
    message === "signed_out"
      ? "你已经安全退出。"
      : error === "confirmation_failed"
        ? "确认链接无效或已经过期，请重新注册或登录。"
        : error === "auth_unavailable"
          ? "认证服务暂时不可用，平台内容保持锁定，请稍后重试。"
        : notice === "config_required"
          ? "Supabase 尚未配置，平台页面暂时锁定。"
          : undefined;

  return <LoginForm configured={isSupabaseConfigured()} initialNotice={initialNotice} />;
}
