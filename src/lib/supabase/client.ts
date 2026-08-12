import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

export function createClient() {
  const { publishableKey, url } = getSupabasePublicConfig();

  return createBrowserClient<Database>(url, publishableKey);
}
