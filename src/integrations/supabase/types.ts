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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          calc_triggers: Json
          cloak_url: string | null
          created_at: string
          id: boolean
          lock_image_url: string | null
          max_coins_per_question: number
          notifications_off: boolean
          quiet_hours: Json
          screen_locked: boolean
          updated_at: string
        }
        Insert: {
          calc_triggers?: Json
          cloak_url?: string | null
          created_at?: string
          id?: boolean
          lock_image_url?: string | null
          max_coins_per_question?: number
          notifications_off?: boolean
          quiet_hours?: Json
          screen_locked?: boolean
          updated_at?: string
        }
        Update: {
          calc_triggers?: Json
          cloak_url?: string | null
          created_at?: string
          id?: boolean
          lock_image_url?: string | null
          max_coins_per_question?: number
          notifications_off?: boolean
          quiet_hours?: Json
          screen_locked?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      birthday_cards: {
        Row: {
          created_at: string
          id: string
          message: string | null
          recipient_id: string
          sender_id: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          recipient_id: string
          sender_id: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          recipient_id?: string
          sender_id?: string
          year?: number
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          calendar_id: string
          created_at: string
          creator_id: string
          day: string
          id: string
          time_text: string | null
          title: string
        }
        Insert: {
          calendar_id: string
          created_at?: string
          creator_id: string
          day: string
          id?: string
          time_text?: string | null
          title: string
        }
        Update: {
          calendar_id?: string
          created_at?: string
          creator_id?: string
          day?: string
          id?: string
          time_text?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_members: {
        Row: {
          calendar_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          calendar_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          calendar_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_members_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      calendars: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          answered_at: string | null
          caller_id: string
          conversation_id: string
          created_at: string
          duration_sec: number
          ended_at: string | null
          id: string
          mode: string
          status: string
        }
        Insert: {
          answered_at?: string | null
          caller_id: string
          conversation_id: string
          created_at?: string
          duration_sec?: number
          ended_at?: string | null
          id?: string
          mode?: string
          status?: string
        }
        Update: {
          answered_at?: string | null
          caller_id?: string
          conversation_id?: string
          created_at?: string
          duration_sec?: number
          ended_at?: string | null
          id?: string
          mode?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_transcripts: {
        Row: {
          consent: boolean
          created_at: string
          id: string
          owner_id: string
          summary: string
          title: string
          transcript: string
        }
        Insert: {
          consent?: boolean
          created_at?: string
          id?: string
          owner_id: string
          summary?: string
          title?: string
          transcript?: string
        }
        Update: {
          consent?: boolean
          created_at?: string
          id?: string
          owner_id?: string
          summary?: string
          title?: string
          transcript?: string
        }
        Relationships: []
      }
      conversation_members: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          cover_url: string | null
          created_at: string
          created_by: string
          description: string | null
          icon_url: string | null
          id: string
          is_group: boolean
          name: string | null
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          icon_url?: string | null
          id?: string
          is_group?: boolean
          name?: string | null
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          is_group?: boolean
          name?: string | null
        }
        Relationships: []
      }
      custom_themes: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          shared: boolean
          vars: Json
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          shared?: boolean
          vars?: Json
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          shared?: boolean
          vars?: Json
        }
        Relationships: []
      }
      friendships: {
        Row: {
          blocked: boolean
          created_at: string
          favorite: boolean
          friend_id: string
          hidden: boolean
          id: string
          nickname: string | null
          removed: boolean
          user_id: string
        }
        Insert: {
          blocked?: boolean
          created_at?: string
          favorite?: boolean
          friend_id: string
          hidden?: boolean
          id?: string
          nickname?: string | null
          removed?: boolean
          user_id: string
        }
        Update: {
          blocked?: boolean
          created_at?: string
          favorite?: boolean
          friend_id?: string
          hidden?: boolean
          id?: string
          nickname?: string | null
          removed?: boolean
          user_id?: string
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          expires_at: string | null
          id: string
          kind: string
          media_url: string | null
          reply_to: string | null
          sender_id: string
        }
        Insert: {
          body?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          kind?: string
          media_url?: string | null
          reply_to?: string | null
          sender_id: string
        }
        Update: {
          body?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          kind?: string
          media_url?: string | null
          reply_to?: string | null
          sender_id?: string
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
            foreignKeyName: "messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          body: string
          created_at: string
          expires_at: string
          mood: string | null
          music_url: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          expires_at?: string
          mood?: string | null
          music_url?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          expires_at?: string
          mood?: string | null
          music_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          desktop: boolean
          enabled: boolean
          quiet_hours: Json
          sound: string
          sound_url: string | null
          tones: Json
          updated_at: string
          user_id: string
          volume: number
        }
        Insert: {
          desktop?: boolean
          enabled?: boolean
          quiet_hours?: Json
          sound?: string
          sound_url?: string | null
          tones?: Json
          updated_at?: string
          user_id: string
          volume?: number
        }
        Update: {
          desktop?: boolean
          enabled?: boolean
          quiet_hours?: Json
          sound?: string
          sound_url?: string | null
          tones?: Json
          updated_at?: string
          user_id?: string
          volume?: number
        }
        Relationships: []
      }
      park_sites: {
        Row: {
          code: string | null
          created_at: string
          created_by: string
          description: string | null
          height: number
          icon_size: number
          icon_url: string | null
          id: string
          kind: string
          name: string
          url: string | null
          width: number
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          height?: number
          icon_size?: number
          icon_url?: string | null
          id?: string
          kind?: string
          name: string
          url?: string | null
          width?: number
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          height?: number
          icon_size?: number
          icon_url?: string | null
          id?: string
          kind?: string
          name?: string
          url?: string | null
          width?: number
        }
        Relationships: []
      }
      poll_votes: {
        Row: {
          created_at: string
          message_id: string
          option_index: number
          user_id: string
        }
        Insert: {
          created_at?: string
          message_id: string
          option_index: number
          user_id: string
        }
        Update: {
          created_at?: string
          message_id?: string
          option_index?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          caption: string | null
          created_at: string
          hidden: boolean
          id: string
          kind: string
          media_type: string | null
          media_url: string | null
          pinned: boolean
        }
        Insert: {
          author_id: string
          caption?: string | null
          created_at?: string
          hidden?: boolean
          id?: string
          kind?: string
          media_type?: string | null
          media_url?: string | null
          pinned?: boolean
        }
        Update: {
          author_id?: string
          caption?: string | null
          created_at?: string
          hidden?: boolean
          id?: string
          kind?: string
          media_type?: string | null
          media_url?: string | null
          pinned?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          avatar_url: string | null
          banned: boolean
          birthday: string | null
          cover_url: string | null
          created_at: string
          deleted: boolean
          display_name: string
          id: string
          status_message: string | null
          theme: string
          updated_at: string
          username: string
        }
        Insert: {
          age?: number | null
          avatar_url?: string | null
          banned?: boolean
          birthday?: string | null
          cover_url?: string | null
          created_at?: string
          deleted?: boolean
          display_name: string
          id: string
          status_message?: string | null
          theme?: string
          updated_at?: string
          username: string
        }
        Update: {
          age?: number | null
          avatar_url?: string | null
          banned?: boolean
          birthday?: string | null
          cover_url?: string | null
          created_at?: string
          deleted?: boolean
          display_name?: string
          id?: string
          status_message?: string | null
          theme?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      stickers: {
        Row: {
          created_at: string
          id: string
          media_url: string
          name: string
          owner_id: string
          pack: string
          shared: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          media_url: string
          name?: string
          owner_id: string
          pack?: string
          shared?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          media_url?: string
          name?: string
          owner_id?: string
          pack?: string
          shared?: boolean
        }
        Relationships: []
      }
      study_attempts: {
        Row: {
          coins: number
          correct: boolean
          created_at: string
          id: string
          question_id: string
          seconds: number
          user_id: string
        }
        Insert: {
          coins?: number
          correct: boolean
          created_at?: string
          id?: string
          question_id: string
          seconds: number
          user_id: string
        }
        Update: {
          coins?: number
          correct?: boolean
          created_at?: string
          id?: string
          question_id?: string
          seconds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "study_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      study_questions: {
        Row: {
          choices: Json
          coins: number
          correct_index: number
          created_at: string
          creator_id: string
          fast_seconds: number
          id: string
          question: string
          slow_coins: number
          subject: string
        }
        Insert: {
          choices?: Json
          coins?: number
          correct_index?: number
          created_at?: string
          creator_id: string
          fast_seconds?: number
          id?: string
          question: string
          slow_coins?: number
          subject?: string
        }
        Update: {
          choices?: Json
          coins?: number
          correct_index?: number
          created_at?: string
          creator_id?: string
          fast_seconds?: number
          id?: string
          question?: string
          slow_coins?: number
          subject?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      answer_question: {
        Args: { _choice: number; _question_id: string; _seconds: number }
        Returns: {
          coins: number
          correct: boolean
          correct_index: number
        }[]
      }
      are_friends: { Args: { _a: string; _b: string }; Returns: boolean }
      calendar_owner: { Args: { _cal: string }; Returns: string }
      can_see_calendar: {
        Args: { _cal: string; _user: string }
        Returns: boolean
      }
      can_see_message: {
        Args: { _message_id: string; _user_id: string }
        Returns: boolean
      }
      coin_ranking: {
        Args: { _period: string }
        Returns: {
          avatar_url: string
          coins: number
          display_name: string
          user_id: string
        }[]
      }
      conversation_owner: {
        Args: { _conversation_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_member: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user"],
    },
  },
} as const
