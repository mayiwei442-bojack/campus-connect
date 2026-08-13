import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error("Demo seed Auth verification requires the public Supabase URL and publishable key.");
}

const client = createClient(url, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const seedProfileIds = Array.from(
  { length: 36 },
  (_, index) => `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
);
const seedActivityIds = Array.from(
  { length: 10 },
  (_, index) => `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
);

const { data: signIn, error: signInError } = await client.auth.signInWithPassword({
  email: "seed.student01@campus-connect.local",
  password: "CampusDemo2026!",
});

if (signInError || !signIn.user) {
  throw new Error(`Demo seed login failed: ${signInError?.message ?? "missing user"}`);
}

const [profiles, activities, personas] = await Promise.all([
  client.from("profiles").select("id", { count: "exact", head: true }).in("id", seedProfileIds),
  client.from("activities").select("id", { count: "exact", head: true }).in("id", seedActivityIds),
  client
    .from("personas")
    .select("id", { count: "exact", head: true })
    .in("owner_id", seedProfileIds)
    .eq("visibility", "public")
    .eq("is_enabled", true),
]);

for (const result of [profiles, activities, personas]) {
  if (result.error) throw result.error;
}

if (profiles.count !== 36 || activities.count !== 10 || personas.count !== 18) {
  throw new Error(
    `Unexpected demo visibility counts: profiles=${profiles.count}, activities=${activities.count}, personas=${personas.count}`,
  );
}

await client.auth.signOut();

console.log("Demo seed Auth and RLS verification passed.");
