export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      app_role: "user" | "admin";
    };
    CompositeTypes: Record<string, never>;
  };
};
