import type { EmailOtpType } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const emailOtpTypes = new Set<EmailOtpType>(["email", "invite", "magiclink", "recovery", "email_change"]);

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/home";
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login?notice=config_required", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const requestedType = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"));
  const supabase = await createClient();
  let verified = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    verified = !error;
  } else if (tokenHash && requestedType && emailOtpTypes.has(requestedType)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: requestedType });
    verified = !error;
  }

  return NextResponse.redirect(new URL(verified ? nextPath : "/login?error=confirmation_failed", request.url));
}
