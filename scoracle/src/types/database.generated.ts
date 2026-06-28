export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      app_activity_logs: {
        Row: {
          created_at: string
          event_type: string
          id: number
          metadata: Json
          target_user_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: never
          metadata?: Json
          target_user_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: never
          metadata?: Json
          target_user_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      fixtures: {
        Row: {
          assists: Json
          away_score: number | null
          away_team_id: string
          created_at: string
          home_score: number | null
          home_team_id: string
          id: string
          kickoff_utc: string
          matchweek: number
          provider: string
          provider_fixture_id: string
          raw_payload: Json
          scorers: Json
          season: string
          status: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          assists?: Json
          away_score?: number | null
          away_team_id: string
          created_at?: string
          home_score?: number | null
          home_team_id: string
          id?: string
          kickoff_utc: string
          matchweek: number
          provider: string
          provider_fixture_id: string
          raw_payload?: Json
          scorers?: Json
          season: string
          status: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          assists?: Json
          away_score?: number | null
          away_team_id?: string
          created_at?: string
          home_score?: number | null
          home_team_id?: string
          id?: string
          kickoff_utc?: string
          matchweek?: number
          provider?: string
          provider_fixture_id?: string
          raw_payload?: Json
          scorers?: Json
          season?: string
          status?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fixtures_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      home_data_cache: {
        Row: {
          expires_at: string
          payload: Json
          request_key: string
          updated_at: string
        }
        Insert: {
          expires_at: string
          payload: Json
          request_key: string
          updated_at?: string
        }
        Update: {
          expires_at?: string
          payload?: Json
          request_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      player_leaders: {
        Row: {
          captured_at: string
          category: string
          id: string
          player_id: string | null
          provider: string
          rank: number | null
          season: string
          source: string
          team_id: string | null
          value: number
          verified: boolean
        }
        Insert: {
          captured_at?: string
          category: string
          id?: string
          player_id?: string | null
          provider: string
          rank?: number | null
          season: string
          source: string
          team_id?: string | null
          value?: number
          verified?: boolean
        }
        Update: {
          captured_at?: string
          category?: string
          id?: string
          player_id?: string | null
          provider?: string
          rank?: number | null
          season?: string
          source?: string
          team_id?: string | null
          value?: number
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "player_leaders_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_leaders_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          api_football_player_id: string | null
          canonical_name: string
          created_at: string
          current_team_id: string | null
          id: string
          photo_url: string | null
          photo_verified: boolean
          pulse_player_id: string | null
          thesportsdb_player_id: string | null
          updated_at: string
        }
        Insert: {
          api_football_player_id?: string | null
          canonical_name: string
          created_at?: string
          current_team_id?: string | null
          id?: string
          photo_url?: string | null
          photo_verified?: boolean
          pulse_player_id?: string | null
          thesportsdb_player_id?: string | null
          updated_at?: string
        }
        Update: {
          api_football_player_id?: string | null
          canonical_name?: string
          created_at?: string
          current_team_id?: string | null
          id?: string
          photo_url?: string | null
          photo_verified?: boolean
          pulse_player_id?: string | null
          thesportsdb_player_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_current_team_id_fkey"
            columns: ["current_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          closeness: string | null
          created_at: string
          fixture_id: string
          id: string
          is_locked: boolean
          match_week: number
          points: number
          predicted_away_score: number
          predicted_home_score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          closeness?: string | null
          created_at?: string
          fixture_id: string
          id?: string
          is_locked?: boolean
          match_week: number
          points?: number
          predicted_away_score: number
          predicted_home_score: number
          updated_at?: string
          user_id: string
        }
        Update: {
          closeness?: string | null
          created_at?: string
          fixture_id?: string
          id?: string
          is_locked?: boolean
          match_week?: number
          points?: number
          predicted_away_score?: number
          predicted_home_score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          avatar_url: string | null
          created_at: string
          email: string
          favorite_club: string | null
          first_name: string | null
          id: string
          is_disabled: boolean
          last_name: string | null
          onboarding_completed_at: string | null
          onboarding_required: boolean
          role: string
          username: string
        }
        Insert: {
          avatar_path?: string | null
          avatar_url?: string | null
          created_at?: string
          email: string
          favorite_club?: string | null
          first_name?: string | null
          id: string
          is_disabled?: boolean
          last_name?: string | null
          onboarding_completed_at?: string | null
          onboarding_required?: boolean
          role?: string
          username: string
        }
        Update: {
          avatar_path?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          favorite_club?: string | null
          first_name?: string | null
          id?: string
          is_disabled?: boolean
          last_name?: string | null
          onboarding_completed_at?: string | null
          onboarding_required?: boolean
          role?: string
          username?: string
        }
        Relationships: []
      }
      provider_sync_leases: {
        Row: {
          expires_at: string
          lease_key: string
          updated_at: string
        }
        Insert: {
          expires_at: string
          lease_key: string
          updated_at?: string
        }
        Update: {
          expires_at?: string
          lease_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      provider_sync_runs: {
        Row: {
          completed_at: string | null
          error_text: string | null
          id: string
          metadata: Json
          provider: string
          started_at: string
          status: string
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          error_text?: string | null
          id?: string
          metadata?: Json
          provider: string
          started_at?: string
          status: string
          sync_type: string
        }
        Update: {
          completed_at?: string | null
          error_text?: string | null
          id?: string
          metadata?: Json
          provider?: string
          started_at?: string
          status?: string
          sync_type?: string
        }
        Relationships: []
      }
      source_mappings: {
        Row: {
          confidence: number
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          provider: string
          provider_entity_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          provider: string
          provider_entity_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          provider?: string
          provider_entity_id?: string
        }
        Relationships: []
      }
      standings_snapshots: {
        Row: {
          captured_at: string
          drawn: number
          form: string | null
          goal_difference: number
          goals_against: number
          goals_for: number
          id: string
          lost: number
          played: number
          points: number
          position: number
          provider: string
          provider_sync_run_id: string | null
          season: string
          team_id: string
          won: number
        }
        Insert: {
          captured_at?: string
          drawn?: number
          form?: string | null
          goal_difference?: number
          goals_against?: number
          goals_for?: number
          id?: string
          lost?: number
          played?: number
          points?: number
          position: number
          provider: string
          provider_sync_run_id?: string | null
          season: string
          team_id: string
          won?: number
        }
        Update: {
          captured_at?: string
          drawn?: number
          form?: string | null
          goal_difference?: number
          goals_against?: number
          goals_for?: number
          id?: string
          lost?: number
          played?: number
          points?: number
          position?: number
          provider?: string
          provider_sync_run_id?: string | null
          season?: string
          team_id?: string
          won?: number
        }
        Relationships: [
          {
            foreignKeyName: "standings_snapshots_provider_sync_run_id_fkey"
            columns: ["provider_sync_run_id"]
            isOneToOne: false
            referencedRelation: "provider_sync_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standings_snapshots_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          api_football_team_id: string | null
          canonical_name: string
          created_at: string
          crest_url: string | null
          id: string
          logo_url: string | null
          pulse_team_id: string | null
          short_name: string
          team_code: string | null
          thesportsdb_team_id: string | null
          updated_at: string
        }
        Insert: {
          api_football_team_id?: string | null
          canonical_name: string
          created_at?: string
          crest_url?: string | null
          id?: string
          logo_url?: string | null
          pulse_team_id?: string | null
          short_name: string
          team_code?: string | null
          thesportsdb_team_id?: string | null
          updated_at?: string
        }
        Update: {
          api_football_team_id?: string | null
          canonical_name?: string
          created_at?: string
          crest_url?: string | null
          id?: string
          logo_url?: string | null
          pulse_team_id?: string | null
          short_name?: string
          team_code?: string | null
          thesportsdb_team_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_set_user_disabled: {
        Args: { disabled: boolean; target_user_id: string }
        Returns: {
          created_at: string
          id: string
          is_disabled: boolean
          role: string
          username: string
        }[]
      }
      auth_email_exists: { Args: { candidate_email: string }; Returns: boolean }
      get_fixture_match_week_lock_at: {
        Args: { target_fixture_id: string }
        Returns: string
      }
      get_match_result: {
        Args: { away_score: number; home_score: number }
        Returns: string
      }
      get_match_week_leaderboard: {
        Args: { selected_match_week: number }
        Returns: {
          avatar_url: string
          close_count: number
          exact_count: number
          favorite_club: string
          great_count: number
          match_week: number
          miss_count: number
          near_miss_count: number
          scored_predictions: number
          total_points: number
          user_id: string
          username: string
        }[]
      }
      get_match_week_rank_movement: {
        Args: { selected_match_week: number }
        Returns: {
          avatar_url: string
          close_count: number
          current_rank: number
          exact_count: number
          favorite_club: string
          great_count: number
          match_week: number
          overall_points_after_week: number
          previous_rank: number
          rank_change: number
          user_id: string
          username: string
          weekly_points: number
        }[]
      }
      get_my_prediction_history: {
        Args: never
        Returns: {
          away_score: number
          away_team_code: string
          away_team_crest_url: string
          away_team_name: string
          closeness: string
          fixture_id: string
          home_score: number
          home_team_code: string
          home_team_crest_url: string
          home_team_name: string
          is_locked: boolean
          kickoff_utc: string
          match_week: number
          matchweek_lock_at: string
          points: number
          predicted_away_score: number
          predicted_home_score: number
          prediction_created_at: string
          prediction_id: string
          prediction_updated_at: string
        }[]
      }
      get_overall_leaderboard: {
        Args: never
        Returns: {
          avatar_url: string
          close_count: number
          exact_count: number
          favorite_club: string
          great_count: number
          miss_count: number
          near_miss_count: number
          scored_predictions: number
          total_points: number
          user_id: string
          username: string
        }[]
      }
      get_prediction_closeness: {
        Args: {
          actual_away: number
          actual_home: number
          predicted_away: number
          predicted_home: number
        }
        Returns: string
      }
      get_prediction_points: { Args: { closeness: string }; Returns: number }
      get_rank_timeline: {
        Args: never
        Returns: {
          avatar_url: string
          close_count: number
          current_rank: number
          exact_count: number
          favorite_club: string
          great_count: number
          match_week: number
          overall_points_after_week: number
          previous_rank: number
          rank_change: number
          user_id: string
          username: string
          weekly_points: number
        }[]
      }
      get_scored_match_weeks: {
        Args: never
        Returns: {
          match_week: number
        }[]
      }
      is_active_user: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_fixture_match_week_locked: {
        Args: { target_fixture_id: string }
        Returns: boolean
      }
      is_username_available: {
        Args: { candidate_username: string }
        Returns: boolean
      }
      log_my_activity: {
        Args: { activity_metadata?: Json; activity_type: string }
        Returns: undefined
      }
      prune_activity_logs: {
        Args: { retention_days?: number }
        Returns: number
      }
      prune_operational_data: {
        Args: { retention_days?: number }
        Returns: number
      }
      release_sync_lease: {
        Args: { requested_lease_key: string }
        Returns: undefined
      }
      score_all_completed_predictions: { Args: never; Returns: number }
      score_my_predictions_for_completed_fixtures: {
        Args: never
        Returns: undefined
      }
      slugify_username: { Args: { value: string }; Returns: string }
      try_acquire_sync_lease: {
        Args: { lease_seconds?: number; requested_lease_key: string }
        Returns: boolean
      }
      unique_profile_username: {
        Args: { base_username: string }
        Returns: string
      }
      username_match_key: { Args: { value: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

