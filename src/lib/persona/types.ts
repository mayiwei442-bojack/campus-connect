import type { Database } from "@/lib/supabase/database.types";

export type PersonaAssetItem = Pick<
  Database["public"]["Tables"]["persona_assets"]["Row"],
  "id" | "storage_path" | "mime_type" | "byte_size" | "user_description" | "is_visible" | "analysis_status" | "analysis_error" | "model_name"
> & { imageUrl: string | null };

export type PersonaEntryItem = Pick<
  Database["public"]["Tables"]["persona_entries"]["Row"],
  "id" | "source_asset_id" | "kind" | "knowledge_key" | "content" | "status" | "confirmed_at"
>;

export type PersonaTopicItem = Pick<
  Database["public"]["Tables"]["persona_question_topics"]["Row"],
  "id" | "topic_key" | "topic_label" | "question_count"
>;

export type PersonaItem = Pick<
  Database["public"]["Tables"]["personas"]["Row"],
  "id" | "slot" | "name" | "topic" | "summary" | "visibility" | "is_enabled" | "allow_matching"
> & {
  assets: PersonaAssetItem[];
  entries: PersonaEntryItem[];
  questionTopics: PersonaTopicItem[];
};
