import { createClient } from "@supabase/supabase-js";

const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!apiUrl || !publishableKey) {
  throw new Error("Supabase public URL and key are required.");
}

const endpoint = new URL(apiUrl);
const allowedHosts = new Set([
  "127.0.0.1",
  "localhost",
  "imkipffhtzfeuayyvzsj.supabase.co",
]);
if (!allowedHosts.has(endpoint.hostname)) {
  throw new Error("The Persona avatar lifecycle test may only run locally or against the approved development project.");
}

const client = createClient(apiUrl, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const viewer = createClient(apiUrl, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const seedEmail = "seed.student01@campus-connect.local";
const seedPassword = "CampusDemo2026!";
const viewerEmail = "seed.student02@campus-connect.local";
let cleanupPath;
let createdPersonaId;

function createMinimalGlb() {
  const json = new TextEncoder().encode(JSON.stringify({ asset: { version: "2.0" }, scene: 0, scenes: [{}] }));
  const jsonByteSize = Math.ceil(json.byteLength / 4) * 4;
  const bytes = new Uint8Array(20 + jsonByteSize);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, bytes.byteLength, true);
  view.setUint32(12, jsonByteSize, true);
  view.setUint32(16, 0x4e4f534a, true);
  bytes.set(json, 20);
  bytes.fill(0x20, 20 + json.byteLength);
  return bytes;
}

try {
  const { data: signIn, error: signInError } = await client.auth.signInWithPassword({
    email: seedEmail,
    password: seedPassword,
  });
  if (signInError || !signIn.user) throw signInError ?? new Error("Seed user sign-in failed.");

  const { error: viewerSignInError } = await viewer.auth.signInWithPassword({
    email: viewerEmail,
    password: seedPassword,
  });
  if (viewerSignInError) throw viewerSignInError;

  const { data: personaId, error: personaError } = await client.rpc("create_persona", {
    p_name: "Avatar lifecycle",
    p_topic: "Private GLB storage",
    p_summary: "Temporary integration-test Persona",
    p_visibility: "private",
  });
  if (personaError || !personaId) throw personaError ?? new Error("Persona was not created.");
  createdPersonaId = personaId;

  const payload = createMinimalGlb();
  cleanupPath = `${signIn.user.id}/${personaId}/${crypto.randomUUID()}.glb`;
  const { error: uploadError } = await client.storage.from("persona-models").upload(cleanupPath, payload, {
    contentType: "model/gltf-binary",
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data: registered, error: registerError } = await client.rpc("register_persona_avatar_model", {
    p_byte_size: payload.byteLength,
    p_original_filename: "lifecycle-test.glb",
    p_persona_id: personaId,
    p_storage_path: cleanupPath,
  });
  if (registerError || !registered?.id) throw registerError ?? new Error("Model was not registered.");

  const { data: privateRow, error: privateReadError } = await viewer
    .from("persona_avatar_models")
    .select("id")
    .eq("id", registered.id)
    .maybeSingle();
  if (privateReadError || privateRow) {
    throw privateReadError ?? new Error("Another user could read a private Persona model row.");
  }
  const { data: privateUrl, error: privateUrlError } = await viewer.storage
    .from("persona-models")
    .createSignedUrl(cleanupPath, 60);
  if (!privateUrlError || privateUrl?.signedUrl) {
    throw new Error("Another user received a signed URL for a private Persona model.");
  }

  const { error: publishError } = await client
    .from("personas")
    .update({ is_enabled: true, visibility: "public" })
    .eq("id", personaId);
  if (publishError) throw publishError;

  const { data: publicRow, error: publicReadError } = await viewer
    .from("persona_avatar_models")
    .select("id")
    .eq("id", registered.id)
    .maybeSingle();
  if (publicReadError || publicRow?.id !== registered.id) {
    throw publicReadError ?? new Error("An eligible viewer could not read a public Persona model row.");
  }
  const { data: publicUrl, error: publicUrlError } = await viewer.storage
    .from("persona-models")
    .createSignedUrl(cleanupPath, 60);
  if (publicUrlError || !publicUrl?.signedUrl) {
    throw publicUrlError ?? new Error("An eligible viewer could not sign a public Persona model URL.");
  }

  await client.storage.from("persona-models").remove([cleanupPath]);
  const { data: protectedObjects, error: protectedListError } = await client.storage
    .from("persona-models")
    .list(`${signIn.user.id}/${personaId}`);
  if (protectedListError) throw protectedListError;
  if (!protectedObjects?.some((object) => cleanupPath.endsWith(`/${object.name}`))) {
    throw new Error("A registered Persona model was deleted without preparing its metadata.");
  }

  const { data: trustedPath, error: prepareError } = await client.rpc("prepare_persona_avatar_model_deletion", {
    p_model_id: registered.id,
    p_persona_id: personaId,
  });
  if (prepareError || trustedPath !== cleanupPath) {
    throw prepareError ?? new Error("The deletion RPC returned an untrusted Storage path.");
  }

  const { error: removeError } = await client.storage.from("persona-models").remove([trustedPath]);
  if (removeError) throw removeError;
  cleanupPath = undefined;

  const { error: deletePersonaError } = await client.rpc("delete_persona", { p_persona_id: createdPersonaId });
  if (deletePersonaError) throw deletePersonaError;
  createdPersonaId = undefined;

  console.log("Persona avatar lifecycle: private denied, public allowed, registered model protected, prepared orphan deleted.");
} finally {
  if (cleanupPath) await client.storage.from("persona-models").remove([cleanupPath]);
  if (createdPersonaId) await client.rpc("delete_persona", { p_persona_id: createdPersonaId });
  await client.auth.signOut();
  await viewer.auth.signOut();
}
