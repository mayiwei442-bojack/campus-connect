import type {
  SkillActionState,
  SkillFieldErrors,
  SkillFormValues,
  SkillKind,
} from "@/lib/skill/action-state";

const SKILL_KINDS = new Set<SkillKind>(["ability", "interest"]);
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readCheckbox(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

export function normalizeSkillName(value: string) {
  return value.trim().replace(/\s+/gu, " ");
}

export function normalizeSkillNameForLookup(value: string) {
  return normalizeSkillName(value).toLowerCase();
}

export function validateSkillForm(formData: FormData) {
  const rawKind = readText(formData, "kind");
  const rawSelfRating = readText(formData, "selfRating");
  const kind = (SKILL_KINDS.has(rawKind as SkillKind) ? rawKind : "ability") as SkillKind;
  const parsedRating = rawSelfRating === "" ? null : Number(rawSelfRating);
  const ratingIsValid = parsedRating !== null && Number.isInteger(parsedRating) && parsedRating >= 1 && parsedRating <= 5;
  const values: SkillFormValues = {
    allowContact: readCheckbox(formData, "allowContact"),
    allowMatching: readCheckbox(formData, "allowMatching"),
    isPublic: readCheckbox(formData, "isPublic"),
    kind,
    name: normalizeSkillName(readText(formData, "name")),
    note: readText(formData, "note"),
    selfRating: ratingIsValid ? parsedRating : null,
  };
  const fieldErrors: SkillFieldErrors = {};
  const nameLength = Array.from(values.name).length;

  if (!SKILL_KINDS.has(rawKind as SkillKind)) {
    fieldErrors.kind = "请选择能力或兴趣。";
  }
  if (nameLength < 2 || nameLength > 40) {
    fieldErrors.name = "Skill 名称需要 2–40 个字符。";
  }
  if (rawSelfRating !== "" && !ratingIsValid) {
    fieldErrors.selfRating = "自评需要是 1–5 之间的整数。";
  }
  if (Array.from(values.note).length > 160) {
    fieldErrors.note = "说明不能超过 160 个字符。";
  }

  return { fieldErrors, values };
}

export function skillValidationErrorState(
  fieldErrors: SkillFieldErrors,
  values: SkillFormValues,
): SkillActionState | null {
  if (Object.keys(fieldErrors).length === 0) {
    return null;
  }

  return {
    fieldErrors,
    message: "请检查标记的 Skill 信息。",
    status: "error",
    values,
  };
}
