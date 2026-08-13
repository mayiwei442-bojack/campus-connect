export const PERSONA_SHOWCASE_EMAIL = "3022387588@qq.com";

export function isPersonaShowcaseEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() === PERSONA_SHOWCASE_EMAIL;
}
