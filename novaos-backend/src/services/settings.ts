// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS SERVICE — User Preferences CRUD
// ═══════════════════════════════════════════════════════════════════════════════

import { getSupabase } from '../db/index.js';
import {
  type Settings,
  type User,
  type NotificationSettings,
  DEFAULT_SETTINGS,
  mapUserRow,
  mapSettingsRow,
} from '../db/types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// USER OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Find a user by their external ID (your user_xxx ID).
 */
export async function findUserByExternalId(externalId: string): Promise<User | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('external_id', externalId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    console.error('[SETTINGS] Error finding user:', error);
    throw new Error(`Failed to find user: ${error.message}`);
  }

  return mapUserRow(data as any);
}

/**
 * Create a new user in the database.
 * Called on /auth/register to sync JWT users with Supabase.
 */
export async function createUser(
  externalId: string,
  email: string,
  tier: string = 'free'
): Promise<User> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('users')
    .insert({
      external_id: externalId,
      email,
      tier,
    } as any)
    .select()
    .single();

  if (error) {
    // Handle duplicate key error (user already exists)
    if (error.code === '23505') {
      const existing = await findUserByExternalId(externalId);
      if (existing) {
        return existing;
      }
    }
    console.error('[SETTINGS] Error creating user:', error);
    throw new Error(`Failed to create user: ${error.message}`);
  }

  console.log('[SETTINGS] Created user:', externalId);
  return mapUserRow(data as any);
}

/**
 * Get or create a user by external ID.
 */
export async function getOrCreateUser(
  externalId: string,
  email: string,
  tier: string = 'free'
): Promise<User> {
  const existing = await findUserByExternalId(externalId);
  if (existing) {
    return existing;
  }
  return createUser(externalId, email, tier);
}

// ─────────────────────────────────────────────────────────────────────────────────
// SETTINGS OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get settings for a user by their external ID.
 * Returns defaults if no settings row exists.
 */
export async function getSettings(externalId: string): Promise<Settings & { isDefault: boolean }> {
  const supabase = getSupabase();

  // First, find the user
  const user = await findUserByExternalId(externalId);
  
  if (!user) {
    // User doesn't exist in DB yet - return defaults
    return {
      id: '',
      userId: '',
      ...DEFAULT_SETTINGS,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDefault: true,
    };
  }

  // Look up their settings
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No settings row - return defaults
      return {
        id: '',
        userId: user.id,
        ...DEFAULT_SETTINGS,
        createdAt: new Date(),
        updatedAt: new Date(),
        isDefault: true,
      };
    }
    console.error('[SETTINGS] Error fetching settings:', error);
    throw new Error(`Failed to fetch settings: ${error.message}`);
  }

  return {
    ...mapSettingsRow(data as any),
    isDefault: false,
  };
}

/**
 * Update settings for a user.
 * Creates the settings row if it doesn't exist (upsert).
 */
export async function updateSettings(
  externalId: string,
  email: string,
  updates: Partial<{
    theme: string;
    defaultStance: string;
    hapticFeedback: boolean;
    notifications: Partial<NotificationSettings>;
  }>
): Promise<Settings> {
  const supabase = getSupabase();

  // Ensure user exists
  const user = await getOrCreateUser(externalId, email);

  // Check if settings row exists
  const { data: existing } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', user.id)
    .single();

  // Build the update payload
  const payload: Record<string, unknown> = {};
  
  if (updates.theme !== undefined) {
    payload.theme = updates.theme;
  }
  if (updates.defaultStance !== undefined) {
    payload.default_stance = updates.defaultStance;
  }
  if (updates.hapticFeedback !== undefined) {
    payload.haptic_feedback = updates.hapticFeedback;
  }
  if (updates.notifications !== undefined) {
    // Merge with existing notifications
    const existingData = existing as any;
    const currentNotifications = existingData?.notifications ?? DEFAULT_SETTINGS.notifications;
    payload.notifications = {
      ...currentNotifications,
      ...updates.notifications,
    };
  }

  if (existing) {
    // Update existing row
    const { data, error } = await supabase
      .from('settings')
      .update(payload as any)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('[SETTINGS] Error updating settings:', error);
      throw new Error(`Failed to update settings: ${error.message}`);
    }

    console.log('[SETTINGS] Updated settings for user:', externalId);
    return mapSettingsRow(data as any);
  } else {
    // Insert new row with defaults + updates
    const insertPayload = {
      user_id: user.id,
      theme: updates.theme ?? DEFAULT_SETTINGS.theme,
      default_stance: updates.defaultStance ?? DEFAULT_SETTINGS.defaultStance,
      haptic_feedback: updates.hapticFeedback ?? DEFAULT_SETTINGS.hapticFeedback,
      notifications: updates.notifications
        ? { ...DEFAULT_SETTINGS.notifications, ...updates.notifications }
        : DEFAULT_SETTINGS.notifications,
    };

    const { data, error } = await supabase
      .from('settings')
      .insert(insertPayload as any)
      .select()
      .single();

    if (error) {
      console.error('[SETTINGS] Error creating settings:', error);
      throw new Error(`Failed to create settings: ${error.message}`);
    }

    console.log('[SETTINGS] Created settings for user:', externalId);
    return mapSettingsRow(data as any);
  }
}

/**
 * Delete settings for a user.
 * Typically not needed since settings cascade on user delete.
 */
export async function deleteSettings(externalId: string): Promise<boolean> {
  const supabase = getSupabase();

  const user = await findUserByExternalId(externalId);
  if (!user) {
    return false;
  }

  const { error } = await supabase
    .from('settings')
    .delete()
    .eq('user_id', user.id);

  if (error) {
    console.error('[SETTINGS] Error deleting settings:', error);
    throw new Error(`Failed to delete settings: ${error.message}`);
  }

  return true;
}
