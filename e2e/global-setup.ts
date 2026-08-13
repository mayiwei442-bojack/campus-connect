import { createClient } from "@supabase/supabase-js";

import { E2E_USERS } from "./support/users";

export default async function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Playwright requires NEXT_PUBLIC_SUPABASE_URL and E2E_SUPABASE_SERVICE_ROLE_KEY.");
  }

  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
    throw new Error("Golden-path E2E setup may only create test users in a local Supabase instance.");
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const user of Object.values(E2E_USERS)) {
    const { error } = await admin.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { nickname: user.nickname },
    });

    if (error) {
      throw new Error(`Unable to create local E2E user ${user.email}: ${error.message}`);
    }
  }
}
