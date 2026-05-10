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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      absence_requests: {
        Row: {
          attachment_url: string | null
          created_at: string
          end_date: string
          id: string
          reason: string
          reviewed_by: string | null
          reviewer_note: string | null
          start_date: string
          status: Database["public"]["Enums"]["approval_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          end_date: string
          id?: string
          reason: string
          reviewed_by?: string | null
          reviewer_note?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          end_date?: string
          id?: string
          reason?: string
          reviewed_by?: string | null
          reviewer_note?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          event_id: string
          id: string
          scanned_at: string
          user_id: string
        }
        Insert: {
          event_id: string
          id?: string
          scanned_at?: string
          user_id: string
        }
        Update: {
          event_id?: string
          id?: string
          scanned_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "qr_events"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      impact_metrics: {
        Row: {
          display_order: number
          id: string
          label: string
          metric_key: string
          unit: string | null
          updated_at: string
          value: number
        }
        Insert: {
          display_order?: number
          id?: string
          label: string
          metric_key: string
          unit?: string | null
          updated_at?: string
          value?: number
        }
        Update: {
          display_order?: number
          id?: string
          label?: string
          metric_key?: string
          unit?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      news_articles: {
        Row: {
          author_id: string | null
          body: string
          cover_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_reads: {
        Row: {
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          is_global: boolean
          target_user_id: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_global?: boolean
          target_user_id?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_global?: boolean
          target_user_id?: string | null
          title?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          batch: string | null
          cds_group: string | null
          created_at: string
          device_fingerprint: string | null
          full_name: string
          id: string
          phone: string | null
          state_code: string | null
          stream: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          batch?: string | null
          cds_group?: string | null
          created_at?: string
          device_fingerprint?: string | null
          full_name: string
          id: string
          phone?: string | null
          state_code?: string | null
          stream?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          batch?: string | null
          cds_group?: string | null
          created_at?: string
          device_fingerprint?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          state_code?: string | null
          stream?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      qr_events: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          event_name: string
          expires_at: string
          id: string
          rotates_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          event_name: string
          expires_at?: string
          id?: string
          rotates_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          event_name?: string
          expires_at?: string
          id?: string
          rotates_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["approval_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["approval_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["approval_status"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_lgi: { Args: { _user_id: string }; Returns: boolean }
      is_lgi: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "corps_member" | "admin" | "lgi" | "media_editor"
      approval_status: "pending" | "approved" | "rejected"
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
      app_role: ["corps_member", "admin", "lgi", "media_editor"],
      approval_status: ["pending", "approved", "rejected"],
    },
  },
} as const
