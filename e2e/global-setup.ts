import { createClient } from "@supabase/supabase-js";

import { E2E_USERS } from "./support/users";

export default async function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !publishableKey || !serviceRoleKey) {
    throw new Error("Playwright requires the local Supabase URL, publishable key, and service-role key.");
  }

  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
    throw new Error("Golden-path E2E setup may only create test users in a local Supabase instance.");
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const userIds = new Map<keyof typeof E2E_USERS, string>();

  for (const key of Object.keys(E2E_USERS) as Array<keyof typeof E2E_USERS>) {
    const user = E2E_USERS[key];
    const { data, error } = await admin.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { nickname: user.nickname },
    });

    if (error || !data.user) {
      throw new Error(`Unable to create local E2E user ${user.email}: ${error?.message ?? "missing user"}`);
    }
    userIds.set(key, data.user.id);
  }

  const candidateId = userIds.get("candidate");
  if (!candidateId) throw new Error("Unable to resolve the Golden path B candidate fixture.");

  const candidate = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await candidate.auth.signInWithPassword({
    email: E2E_USERS.candidate.email,
    password: E2E_USERS.candidate.password,
  });
  if (signInError) throw new Error(`Unable to authenticate the Golden path B candidate: ${signInError.message}`);

  // Local Auth and API containers can briefly disagree at a whole-second boundary.
  await new Promise((resolve) => setTimeout(resolve, 1_100));

  const { error: profileError } = await candidate
    .from("profiles")
    .update({
      allow_matching: true,
      allow_stranger_messages: true,
      bio: "擅长产品设计与校园应用原型，喜欢用清晰分工推进共创。",
      campus: "Campus Connect Test Campus",
      is_public: true,
    })
    .eq("id", candidateId);
  if (profileError) throw new Error(`Unable to seed the Golden path B profile: ${profileError.message}`);

  const { data: skill, error: skillError } = await candidate
    .from("skills")
    .insert({ created_by: candidateId, kind: "ability", name: "产品设计" })
    .select("id")
    .single();
  if (skillError || !skill) throw new Error(`Unable to seed the Golden path B Skill: ${skillError?.message}`);

  const { error: profileSkillError } = await candidate.from("profile_skills").insert({
    allow_contact: true,
    allow_matching: true,
    is_public: true,
    note: "能把校园需求整理成可测试的产品原型",
    profile_id: candidateId,
    self_rating: 5,
    skill_id: skill.id,
  });
  if (profileSkillError) throw new Error(`Unable to seed the Golden path B profile Skill: ${profileSkillError.message}`);

  const { data: personaId, error: personaError } = await candidate.rpc("create_persona", {
    p_name: "共创搭档",
    p_summary: "只呈现本人确认过的产品共创经验与合作方式。",
    p_topic: "校园应用产品设计",
    p_visibility: "public",
  });
  if (personaError || !personaId) throw new Error(`Unable to seed the Golden path B Persona: ${personaError?.message}`);

  const { error: personaSettingsError } = await candidate
    .from("personas")
    .update({ allow_matching: true, is_enabled: true })
    .eq("id", personaId);
  if (personaSettingsError) throw new Error(`Unable to enable the Golden path B Persona: ${personaSettingsError.message}`);

  const { data: entry, error: entryError } = await candidate
    .from("persona_entries")
    .insert({
      content: "做过校园应用原型，习惯先对齐目标，再用可点击原型验证核心流程。",
      kind: "experience",
      knowledge_key: "校园应用产品设计经验",
      owner_id: candidateId,
      persona_id: personaId,
    })
    .select("id")
    .single();
  if (entryError || !entry) throw new Error(`Unable to seed the Golden path B Persona entry: ${entryError?.message}`);

  const { error: confirmError } = await candidate.rpc("confirm_persona_entry", { p_entry_id: entry.id });
  if (confirmError) throw new Error(`Unable to confirm the Golden path B Persona entry: ${confirmError.message}`);
}
