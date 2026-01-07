// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE TYPES — Supabase Schema Types
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// SUPABASE GENERATED TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          external_id: string;
          email: string;
          tier: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          external_id: string;
          email: string;
          tier?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          external_id?: string;
          email?: string;
          tier?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      settings: {
        Row: {
          id: string;
          user_id: string;
          theme: string;
          default_stance: string;
          haptic_feedback: boolean;
          notifications: NotificationSettings;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          theme?: string;
          default_stance?: string;
          haptic_feedback?: boolean;
          notifications?: NotificationSettings;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          theme?: string;
          default_stance?: string;
          haptic_feedback?: boolean;
          notifications?: NotificationSettings;
          created_at?: string;
          updated_at?: string;
        };
      };
      // ═══════════════════════════════════════════════════════════════════════════
      // SWORDGATE TABLES (NEW)
      // ═══════════════════════════════════════════════════════════════════════════
      lesson_plans: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          goal: string;
          capstone_statement: string | null;
          status: string;
          total_nodes: number;
          completed_nodes: number;
          total_sessions: number;
          completed_sessions: number;
          progress: number;
          created_at: string;
          updated_at: string;
          activated_at: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          goal: string;
          capstone_statement?: string | null;
          status?: string;
          total_nodes?: number;
          completed_nodes?: number;
          total_sessions?: number;
          completed_sessions?: number;
          progress?: number;
          created_at?: string;
          updated_at?: string;
          activated_at?: string | null;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          goal?: string;
          capstone_statement?: string | null;
          status?: string;
          total_nodes?: number;
          completed_nodes?: number;
          total_sessions?: number;
          completed_sessions?: number;
          progress?: number;
          created_at?: string;
          updated_at?: string;
          activated_at?: string | null;
          completed_at?: string | null;
        };
      };
      nodes: {
        Row: {
          id: string;
          plan_id: string;
          title: string;
          route: string;
          subskill_type: string;
          learning_objectives: string[];
          session_count: number;
          assets_per_session: Record<string, unknown>;
          sequence_order: number;
          is_method_node: boolean;
          method_type: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          title: string;
          route: string;
          subskill_type: string;
          learning_objectives?: string[];
          session_count?: number;
          assets_per_session?: Record<string, unknown>;
          sequence_order: number;
          is_method_node?: boolean;
          method_type?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          plan_id?: string;
          title?: string;
          route?: string;
          subskill_type?: string;
          learning_objectives?: string[];
          session_count?: number;
          assets_per_session?: Record<string, unknown>;
          sequence_order?: number;
          is_method_node?: boolean;
          method_type?: string | null;
          created_at?: string;
        };
      };
      node_prerequisites: {
        Row: {
          id: string;
          node_id: string;
          prerequisite_node_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          node_id: string;
          prerequisite_node_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          node_id?: string;
          prerequisite_node_id?: string;
          created_at?: string;
        };
      };
      node_progress: {
        Row: {
          id: string;
          user_id: string;
          node_id: string;
          status: string;
          current_session: number;
          completed_sessions: number;
          mastery_verified: boolean;
          available_at: string | null;
          started_at: string | null;
          completed_at: string | null;
          last_session_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          node_id: string;
          status?: string;
          current_session?: number;
          completed_sessions?: number;
          mastery_verified?: boolean;
          available_at?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          last_session_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          node_id?: string;
          status?: string;
          current_session?: number;
          completed_sessions?: number;
          mastery_verified?: boolean;
          available_at?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          last_session_at?: string | null;
        };
      };
      daily_plans: {
        Row: {
          id: string;
          user_id: string;
          node_id: string;
          session_number: number;
          route: string;
          content: Record<string, unknown>;
          spark: Record<string, unknown>;
          is_refresh_session: boolean;
          generated_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          node_id: string;
          session_number: number;
          route: string;
          content?: Record<string, unknown>;
          spark?: Record<string, unknown>;
          is_refresh_session?: boolean;
          generated_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          node_id?: string;
          session_number?: number;
          route?: string;
          content?: Record<string, unknown>;
          spark?: Record<string, unknown>;
          is_refresh_session?: boolean;
          generated_at?: string;
          completed_at?: string | null;
        };
      };
      asset_progress: {
        Row: {
          id: string;
          daily_plan_id: string;
          asset_type: string;
          asset_index: number;
          completed: boolean;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          daily_plan_id: string;
          asset_type: string;
          asset_index: number;
          completed?: boolean;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          daily_plan_id?: string;
          asset_type?: string;
          asset_index?: number;
          completed?: boolean;
          completed_at?: string | null;
        };
      };
      designer_sessions: {
        Row: {
          id: string;
          user_id: string;
          phase: string;
          internal_phase: string;
          topic: string | null;
          exploration_messages: Record<string, unknown>[];
          goal: string | null;
          capstone: string | null;
          subskills: Record<string, unknown>[];
          research_results: Record<string, unknown>[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          phase?: string;
          internal_phase?: string;
          topic?: string | null;
          exploration_messages?: Record<string, unknown>[];
          goal?: string | null;
          capstone?: string | null;
          subskills?: Record<string, unknown>[];
          research_results?: Record<string, unknown>[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          phase?: string;
          internal_phase?: string;
          topic?: string | null;
          exploration_messages?: Record<string, unknown>[];
          goal?: string | null;
          capstone?: string | null;
          subskills?: Record<string, unknown>[];
          research_results?: Record<string, unknown>[];
          created_at?: string;
          updated_at?: string;
        };
      };
      canonical_sources: {
        Row: {
          id: string;
          plan_id: string;
          subskill: string;
          source_type: string;
          url: string | null;
          title: string;
          summary: string | null;
          fetched_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          subskill: string;
          source_type: string;
          url?: string | null;
          title: string;
          summary?: string | null;
          fetched_at?: string;
        };
        Update: {
          id?: string;
          plan_id?: string;
          subskill?: string;
          source_type?: string;
          url?: string | null;
          title?: string;
          summary?: string | null;
          fetched_at?: string;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// APPLICATION TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type UserTier = 'free' | 'pro' | 'enterprise';
export type Theme = 'dark' | 'light' | 'system';
export type DefaultStance = 'lens' | 'sword' | 'shield' | 'control';

export interface NotificationSettings {
  sparkReminders: boolean;
  dailySummary: boolean;
}

export interface User {
  id: string;
  externalId: string;
  email: string;
  tier: UserTier;
  createdAt: Date;
  updatedAt: Date;
}

export interface Settings {
  id: string;
  userId: string;
  theme: Theme;
  defaultStance: DefaultStance;
  hapticFeedback: boolean;
  notifications: NotificationSettings;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────────
// DEFAULTS
// ─────────────────────────────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS: Omit<Settings, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
  theme: 'dark',
  defaultStance: 'lens',
  hapticFeedback: true,
  notifications: {
    sparkReminders: true,
    dailySummary: false,
  },
};

// ─────────────────────────────────────────────────────────────────────────────────
// MAPPERS (DB Row → App Type)
// ─────────────────────────────────────────────────────────────────────────────────

export function mapUserRow(row: Database['public']['Tables']['users']['Row']): User {
  return {
    id: row.id,
    externalId: row.external_id,
    email: row.email,
    tier: row.tier as UserTier,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapSettingsRow(row: Database['public']['Tables']['settings']['Row']): Settings {
  return {
    id: row.id,
    userId: row.user_id,
    theme: row.theme as Theme,
    defaultStance: row.default_stance as DefaultStance,
    hapticFeedback: row.haptic_feedback,
    notifications: row.notifications as NotificationSettings,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
