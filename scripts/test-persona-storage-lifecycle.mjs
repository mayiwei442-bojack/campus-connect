import { createClient } from "@supabase/supabase-js";

const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

if (!apiUrl || !publishableKey || !serviceRoleKey) {
  throw new Error("Local Supabase URL and keys are required.");
}

const endpoint = new URL(apiUrl);
if (!new Set(["127.0.0.1", "localhost"]).has(endpoint.hostname)) {
  throw new Error("The Persona Storage test may only run against local Supabase.");
}

const admin = createClient(apiUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const client = createClient(apiUrl, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const userId = crypto.randomUUID();
const email = `persona-storage-${userId}@example.test`;
const password = `Local-${crypto.randomUUID()}-Aa1!`;
let cleanupStoragePath;

try {
  const { error: createError } = await admin.auth.admin.createUser({
    id: userId,
    email,
    password,
    email_confirm: true,
    user_metadata: { nickname: "Persona Storage test" },
  });
  if (createError) throw createError;

  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  // Avoid a transient "JWT issued at future" response when local CI containers
  // cross a whole-second clock boundary immediately after sign-in.
  await new Promise((resolve) => setTimeout(resolve, 1_100));

  const { data: personaId, error: personaError } = await client.rpc("create_persona", {
    p_name: "Storage lifecycle",
    p_topic: "Private image provenance",
    p_summary: "Local integration test",
    p_visibility: "private",
  });
  if (personaError || !personaId) throw personaError ?? new Error("Persona was not created.");

  const payload = new Uint8Array([82, 73, 70, 70, 8, 0, 0, 0, 87, 69, 66, 80]);
  const storagePath = `${userId}/${personaId}/${crypto.randomUUID()}.webp`;
  cleanupStoragePath = storagePath;
  const { error: uploadError } = await client.storage
    .from("persona-assets")
    .upload(storagePath, payload, { contentType: "image/webp", upsert: false });
  if (uploadError) throw uploadError;

  const { data: assetId, error: registerError } = await client.rpc("register_persona_asset", {
    p_persona_id: personaId,
    p_storage_path: storagePath,
    p_mime_type: "image/webp",
    p_byte_size: payload.byteLength,
    p_user_description: "Local lifecycle proof",
  });
  if (registerError || !assetId) throw registerError ?? new Error("Asset was not registered.");

  await client.storage.from("persona-assets").remove([storagePath]);
  const { data: stillRegistered, error: registeredListError } = await admin.storage
    .from("persona-assets")
    .list(`${userId}/${personaId}`);
  if (registeredListError) throw registeredListError;
  if (!stillRegistered?.some((object) => storagePath.endsWith(`/${object.name}`))) {
    throw new Error("A registered Persona asset was deleted without preparing its metadata.");
  }

  const { data: trustedPath, error: prepareError } = await client.rpc(
    "prepare_persona_asset_deletion",
    { p_persona_id: personaId, p_asset_id: assetId },
  );
  if (prepareError || trustedPath !== storagePath) {
    throw prepareError ?? new Error("The deletion RPC returned an untrusted Storage path.");
  }

  const { error: removeError } = await client.storage.from("persona-assets").remove([trustedPath]);
  if (removeError) throw removeError;
  const { data: afterRemoval, error: removedListError } = await admin.storage
    .from("persona-assets")
    .list(`${userId}/${personaId}`);
  if (removedListError) throw removedListError;
  if (afterRemoval?.some((object) => trustedPath.endsWith(`/${object.name}`))) {
    throw new Error("The prepared orphan Persona asset was not deleted through the Storage API.");
  }

  const { error: deletePersonaError } = await client.rpc("delete_persona", {
    p_persona_id: personaId,
  });
  if (deletePersonaError) throw deletePersonaError;

  console.log("Persona Storage lifecycle: registered object protected, prepared orphan deleted.");
} finally {
  if (cleanupStoragePath) {
    await admin.storage.from("persona-assets").remove([cleanupStoragePath]);
  }
  await admin.auth.admin.deleteUser(userId);
}
