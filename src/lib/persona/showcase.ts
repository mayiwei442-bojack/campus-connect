export const PERSONA_SHOWCASE_EMAIL = "3022387588@qq.com";

const LOCAL_ROADSHOW_MODEL_FILES = {
  einstein: "einstein.glb",
  ironman: "ironman.glb",
  spider: "spider.glb",
} as const;

export function isPersonaShowcaseEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() === PERSONA_SHOWCASE_EMAIL;
}

export function shouldShowLocalPersonaRoadshow(
  email: string | null | undefined,
  vercelEnvironment = process.env.VERCEL,
) {
  return !vercelEnvironment && isPersonaShowcaseEmail(email);
}

export function getLocalRoadshowModelFilename(
  model: string,
  vercelEnvironment = process.env.VERCEL,
) {
  if (vercelEnvironment) return null;
  return LOCAL_ROADSHOW_MODEL_FILES[model as keyof typeof LOCAL_ROADSHOW_MODEL_FILES] ?? null;
}
