import { cache } from "react";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type Viewer = {
  id: string;
  initials: string;
  nickname: string;
};

function getInitials(nickname: string) {
  const compactName = nickname.replace(/\s+/g, "");
  return Array.from(compactName).slice(0, 2).join("").toUpperCase() || "CC";
}

export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const claims = claimsData?.claims;
    const userId = typeof claims?.sub === "string" ? claims.sub : null;

    if (!userId) {
      return null;
    }

    const { data: profile } = await supabase.from("profiles").select("nickname").eq("id", userId).maybeSingle();
    const email = claims && typeof claims.email === "string" ? claims.email : "";
    const nickname = profile?.nickname || email.split("@")[0] || "Campus Member";

    return {
      id: userId,
      initials: getInitials(nickname),
      nickname,
    };
  } catch {
    return null;
  }
});
