import type { Database } from "@/lib/supabase/database.types";

export type SkillKind = Database["public"]["Enums"]["skill_kind"];

export type SkillFormValues = {
  allowContact: boolean;
  allowMatching: boolean;
  isPublic: boolean;
  kind: SkillKind;
  name: string;
  note: string;
  selfRating: number | null;
};

export type SkillFieldErrors = Partial<Record<"kind" | "name" | "note" | "selfRating", string>>;

export type SkillActionState = {
  fieldErrors?: SkillFieldErrors;
  message: string;
  status: "idle" | "error" | "success";
  values?: SkillFormValues;
};

export const initialSkillActionState: SkillActionState = {
  message: "",
  status: "idle",
};

export type ProfileSkillItem = SkillFormValues & {
  id: string;
};
