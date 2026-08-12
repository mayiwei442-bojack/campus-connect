export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          capacity: number | null
          created_at: string
          creator_id: string
          description: string | null
          ended_at: string | null
          ends_at: string | null
          id: string
          join_mode: Database["public"]["Enums"]["activity_join_mode"]
          place_id: string
          starts_at: string | null
          status: Database["public"]["Enums"]["activity_status"]
          title: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          creator_id: string
          description?: string | null
          ended_at?: string | null
          ends_at?: string | null
          id?: string
          join_mode: Database["public"]["Enums"]["activity_join_mode"]
          place_id: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["activity_status"]
          title: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          creator_id?: string
          description?: string | null
          ended_at?: string | null
          ends_at?: string | null
          id?: string
          join_mode?: Database["public"]["Enums"]["activity_join_mode"]
          place_id?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["activity_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_invitations: {
        Row: {
          activity_id: string
          created_at: string
          id: string
          invitee_id: string
          inviter_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["activity_invitation_status"]
        }
        Insert: {
          activity_id: string
          created_at?: string
          id?: string
          invitee_id: string
          inviter_id: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["activity_invitation_status"]
        }
        Update: {
          activity_id?: string
          created_at?: string
          id?: string
          invitee_id?: string
          inviter_id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["activity_invitation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "activity_invitations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_invitations_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_invitations_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_participations: {
        Row: {
          activity_id: string
          id: string
          joined_at: string | null
          left_at: string | null
          profile_id: string
          queue_position: number | null
          requested_at: string
          responded_at: string | null
          status: Database["public"]["Enums"]["activity_participation_status"]
          updated_at: string
        }
        Insert: {
          activity_id: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          profile_id: string
          queue_position?: number | null
          requested_at?: string
          responded_at?: string | null
          status: Database["public"]["Enums"]["activity_participation_status"]
          updated_at?: string
        }
        Update: {
          activity_id?: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          profile_id?: string
          queue_position?: number | null
          requested_at?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["activity_participation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_participations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_participations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_members: {
        Row: {
          conversation_id: string
          joined_at: string
          left_at: string | null
          profile_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          left_at?: string | null
          profile_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          left_at?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          activity_id: string | null
          archived_at: string | null
          created_at: string
          id: string
          is_archived: boolean
          kind: Database["public"]["Enums"]["conversation_kind"]
          title: string | null
          updated_at: string
        }
        Insert: {
          activity_id?: string | null
          archived_at?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean
          kind: Database["public"]["Enums"]["conversation_kind"]
          title?: string | null
          updated_at?: string
        }
        Update: {
          activity_id?: string | null
          archived_at?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean
          kind?: Database["public"]["Enums"]["conversation_kind"]
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: true
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          client_nonce: string
          conversation_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["message_kind"]
          mime_type: string | null
          sender_id: string
          storage_path: string | null
        }
        Insert: {
          body?: string | null
          client_nonce?: string
          conversation_id: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["message_kind"]
          mime_type?: string | null
          sender_id: string
          storage_path?: string | null
        }
        Update: {
          body?: string | null
          client_nonce?: string
          conversation_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["message_kind"]
          mime_type?: string | null
          sender_id?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          category: string
          created_at: string
          description: string | null
          display_name: string
          glb_anchor_name: string
          glb_object_name: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          display_name: string
          glb_anchor_name: string
          glb_object_name: string
          id: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          display_name?: string
          glb_anchor_name?: string
          glb_object_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      profile_skills: {
        Row: {
          allow_contact: boolean
          allow_matching: boolean
          created_at: string
          id: string
          is_public: boolean
          note: string | null
          profile_id: string
          self_rating: number | null
          skill_id: string
          updated_at: string
        }
        Insert: {
          allow_contact?: boolean
          allow_matching?: boolean
          created_at?: string
          id?: string
          is_public?: boolean
          note?: string | null
          profile_id: string
          self_rating?: number | null
          skill_id: string
          updated_at?: string
        }
        Update: {
          allow_contact?: boolean
          allow_matching?: boolean
          created_at?: string
          id?: string
          is_public?: boolean
          note?: string | null
          profile_id?: string
          self_rating?: number | null
          skill_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_skills_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          allow_matching: boolean
          allow_stranger_messages: boolean
          avatar_path: string | null
          bio: string | null
          campus: string | null
          created_at: string
          id: string
          is_public: boolean
          is_seed_user: boolean
          nickname: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          allow_matching?: boolean
          allow_stranger_messages?: boolean
          avatar_path?: string | null
          bio?: string | null
          campus?: string | null
          created_at?: string
          id: string
          is_public?: boolean
          is_seed_user?: boolean
          nickname: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          allow_matching?: boolean
          allow_stranger_messages?: boolean
          avatar_path?: string | null
          bio?: string | null
          campus?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          is_seed_user?: boolean
          nickname?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      skills: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["skill_kind"]
          name: string
          normalized_name: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["skill_kind"]
          name: string
          normalized_name?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["skill_kind"]
          name?: string
          normalized_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "skills_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_read_conversation_message: {
        Args: { p_conversation_id: string; p_message_created_at: string }
        Returns: boolean
      }
      create_activity: {
        Args: {
          p_capacity?: number
          p_description?: string
          p_ends_at?: string
          p_join_mode?: Database["public"]["Enums"]["activity_join_mode"]
          p_place_id: string
          p_starts_at?: string
          p_title: string
        }
        Returns: string
      }
      create_activity_invitation: {
        Args: { p_activity_id: string; p_invitee_id: string }
        Returns: string
      }
      end_activity: { Args: { p_activity_id: string }; Returns: undefined }
      is_conversation_member: {
        Args: { p_conversation_id: string; p_require_active?: boolean }
        Returns: boolean
      }
      join_activity: {
        Args: { p_activity_id: string }
        Returns: Database["public"]["Enums"]["activity_participation_status"]
      }
      leave_activity: { Args: { p_activity_id: string }; Returns: string }
      promote_activity_waitlist: {
        Args: { p_activity_id: string }
        Returns: string
      }
      remove_activity_member: {
        Args: { p_activity_id: string; p_profile_id: string }
        Returns: string
      }
      respond_activity_invitation: {
        Args: { p_accept: boolean; p_invitation_id: string }
        Returns: Database["public"]["Enums"]["activity_participation_status"]
      }
      respond_activity_join_request: {
        Args: {
          p_activity_id: string
          p_approve: boolean
          p_profile_id: string
        }
        Returns: Database["public"]["Enums"]["activity_participation_status"]
      }
      send_message: {
        Args: {
          p_body?: string
          p_client_nonce?: string
          p_conversation_id: string
          p_kind: Database["public"]["Enums"]["message_kind"]
          p_mime_type?: string
          p_storage_path?: string
        }
        Returns: string
      }
    }
    Enums: {
      activity_invitation_status:
        | "pending"
        | "accepted"
        | "declined"
        | "cancelled"
      activity_join_mode: "free" | "approval"
      activity_participation_status:
        | "pending"
        | "joined"
        | "waitlisted"
        | "left"
        | "removed"
        | "rejected"
      activity_status: "scheduled" | "active" | "ended" | "disabled"
      app_role: "user" | "admin"
      conversation_kind: "activity" | "direct"
      message_kind: "text" | "image"
      skill_kind: "ability" | "interest"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_invitation_status: [
        "pending",
        "accepted",
        "declined",
        "cancelled",
      ],
      activity_join_mode: ["free", "approval"],
      activity_participation_status: [
        "pending",
        "joined",
        "waitlisted",
        "left",
        "removed",
        "rejected",
      ],
      activity_status: ["scheduled", "active", "ended", "disabled"],
      app_role: ["user", "admin"],
      conversation_kind: ["activity", "direct"],
      message_kind: ["text", "image"],
      skill_kind: ["ability", "interest"],
    },
  },
} as const
