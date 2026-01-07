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
