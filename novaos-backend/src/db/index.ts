// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE MODULE — Supabase PostgreSQL
// ═══════════════════════════════════════════════════════════════════════════════

export {
  initSupabase,
  getSupabase,
  isSupabaseInitialized,
  testConnection,
  type SupabaseConfig,
} from './client.js';

export {
  type Database,
  type User,
  type Settings,
  type UserTier,
  type Theme,
  type DefaultStance,
  type NotificationSettings,
  DEFAULT_SETTINGS,
  mapUserRow,
  mapSettingsRow,
} from './types.js';
