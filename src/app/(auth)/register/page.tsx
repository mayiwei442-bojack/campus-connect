import type { Metadata } from "next";

import { RegisterForm } from "@/components/auth/register-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "注册",
  description: "创建 Campus Connect 账号与公开校园昵称。",
};

export default function RegisterPage() {
  return <RegisterForm configured={isSupabaseConfigured()} />;
}
