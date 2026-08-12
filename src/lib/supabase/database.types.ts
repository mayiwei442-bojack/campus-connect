export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profile_skills: {
        Row: {
          allow_contact: boolean;
          allow_matching: boolean;
          created_at: string;
          id: string;
          is_public: boolean;
          note: string | null;
          profile_id: string;
          self_rating: number | null;
          skill_id: string;
          updated_at: string;
        };
        Insert: {
          allow_contact?: boolean;
          allow_matching?: boolean;
          created_at?: string;
          id?: string;
          is_public?: boolean;
          note?: string | null;
          profile_id: string;
          self_rating?: number | null;
          skill_id: string;
          updated_at?: string;
        };
        Update: {
          allow_contact?: boolean;
          allow_matching?: boolean;
          created_at?: string;
          id?: string;
          is_public?: boolean;
          note?: string | null;
          profile_id?: string;
          self_rating?: number | null;
          skill_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_skills_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_skills_skill_id_fkey";
            columns: ["skill_id"];
            isOneToOne: false;
            referencedRelation: "skills";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          allow_matching: boolean;
          allow_stranger_messages: boolean;
          avatar_path: string | null;
          bio: string | null;
          campus: string | null;
          created_at: string;
          id: string;
          is_public: boolean;
          is_seed_user: boolean;
          nickname: string;
          role: Database["public"]["Enums"]["app_role"];
          updated_at: string;
        };
        Insert: {
          allow_matching?: boolean;
          allow_stranger_messages?: boolean;
          avatar_path?: string | null;
          bio?: string | null;
          campus?: string | null;
          created_at?: string;
          id: string;
          is_public?: boolean;
          is_seed_user?: boolean;
          nickname: string;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
        };
        Update: {
          allow_matching?: boolean;
          allow_stranger_messages?: boolean;
          avatar_path?: string | null;
          bio?: string | null;
          campus?: string | null;
          created_at?: string;
          id?: string;
          is_public?: boolean;
          is_seed_user?: boolean;
          nickname?: string;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
        };
        Relationships: [];
      };
      skills: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          kind: Database["public"]["Enums"]["skill_kind"];
          name: string;
          normalized_name: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["skill_kind"];
          name: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["skill_kind"];
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "skills_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      app_role: "user" | "admin";
      skill_kind: "ability" | "interest";
    };
    CompositeTypes: Record<string, never>;
  };
};
