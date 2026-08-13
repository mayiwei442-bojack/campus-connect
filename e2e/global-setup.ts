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

  const { error: profileError } = await admin
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

  const { data: skill, error: skillError } = await admin
    .from("skills")
    .insert({ created_by: candidateId, kind: "ability", name: "产品设计" })
    .select("id")
    .single();
  if (skillError || !skill) throw new Error(`Unable to seed the Golden path B Skill: ${skillError?.message}`);

  const { error: profileSkillError } = await admin.from("profile_skills").insert({
    allow_contact: true,
    allow_matching: true,
    is_public: true,
    note: "能把校园需求整理成可测试的产品原型",
    profile_id: candidateId,
    self_rating: 5,
    skill_id: skill.id,
  });
  if (profileSkillError) throw new Error(`Unable to seed the Golden path B profile Skill: ${profileSkillError.message}`);

  const { data: persona, error: personaError } = await admin
    .from("personas")
    .insert({
      allow_matching: true,
      is_enabled: true,
      name: "共创搭档",
      owner_id: candidateId,
      slot: 1,
      summary: "只呈现本人确认过的产品共创经验与合作方式。",
      topic: "校园应用产品设计",
      visibility: "public",
    })
    .select("id")
    .single();
  if (personaError || !persona) throw new Error(`Unable to seed the Golden path B Persona: ${personaError?.message}`);

  const { error: entryError } = await admin.from("persona_entries").insert({
    confirmed_at: new Date().toISOString(),
    content: "做过校园应用原型，习惯先对齐目标，再用可点击原型验证核心流程。",
    kind: "experience",
    knowledge_key: "校园应用产品设计经验",
    owner_id: candidateId,
    persona_id: persona.id,
    status: "confirmed",
  });
  if (entryError) throw new Error(`Unable to seed the Golden path B Persona entry: ${entryError.message}`);
}
