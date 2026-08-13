import { createClient } from "@supabase/supabase-js";

const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

if (!apiUrl || !publishableKey || !serviceRoleKey) {
  throw new Error("Local Supabase URL and keys are required.");
}

const endpoint = new URL(apiUrl);
if (!new Set(["127.0.0.1", "localhost"]).has(endpoint.hostname)) {
  throw new Error("The concurrency test may only run against local Supabase.");
}

const admin = createClient(apiUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const email = `connect-rate-${crypto.randomUUID()}@example.test`;
const password = `Local-${crypto.randomUUID()}-Aa1!`;
const { error: createError } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { nickname: "Connect rate test" },
});
if (createError) throw createError;

const client = createClient(apiUrl, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { error: signInError } = await client.auth.signInWithPassword({ email, password });
if (signInError) throw signInError;

const millisecondInMinute = Date.now() % 60_000;
if (millisecondInMinute > 50_000) {
  await new Promise((resolve) => setTimeout(resolve, 60_100 - millisecondInMinute));
}

const results = await Promise.all(
  Array.from({ length: 9 }, () => client.rpc("consume_connect_rate_limit")),
);
const errors = results.flatMap(({ error }) => (error ? [error.message] : []));
if (errors.length > 0) throw new Error(`Rate-limit RPC failed: ${errors.join("; ")}`);

const allowed = results.filter(({ data }) => data === true).length;
const rejected = results.filter(({ data }) => data === false).length;
if (allowed !== 8 || rejected !== 1) {
  throw new Error(`Expected 8 allowed and 1 rejected concurrent calls; got ${allowed} and ${rejected}.`);
}

console.log("Connect shared rate limiter: 8 allowed, 1 rejected under concurrent load.");
