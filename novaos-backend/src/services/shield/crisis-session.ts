// ═══════════════════════════════════════════════════════════════════════════════
// SHIELD CRISIS SESSION MANAGER
// Manages persistent crisis sessions for high safety signals
// ═══════════════════════════════════════════════════════════════════════════════

import { isSupabaseInitialized, getSupabase } from '../../db/index.js';
import type { CrisisSession } from './types.js';

/**
 * Get active crisis session for user (if any)
 * Used to block all messages until resolved
 */
export async function getActiveCrisisSession(
  userId: string
): Promise<CrisisSession | null> {
  if (!isSupabaseInitialized()) {
    console.warn('[SHIELD] Supabase not initialized, skipping crisis check');
    return null;
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('shield_crisis_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error) {
      // PGRST116 = no rows found (not an error for us)
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('[SHIELD] Failed to fetch crisis session:', error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      activationId: data.activation_id,
      status: data.status,
      createdAt: new Date(data.created_at),
      resolvedAt: data.resolved_at ? new Date(data.resolved_at) : undefined,
    };
  } catch (error) {
    console.error('[SHIELD] Error fetching crisis session:', error);
    return null;
  }
}

/**
 * Create a new crisis session
 * Called when safety_signal is 'high'
 */
export async function createCrisisSession(
  userId: string,
  activationId: string
): Promise<CrisisSession | null> {
  if (!isSupabaseInitialized()) {
    console.warn('[SHIELD] Supabase not initialized, cannot create crisis session');
    return null;
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('shield_crisis_sessions')
      .insert({
        user_id: userId,
        activation_id: activationId,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      console.error('[SHIELD] Failed to create crisis session:', error);
      return null;
    }

    console.log(`[SHIELD] Created crisis session: ${data.id} for user: ${userId}`);

    return {
      id: data.id,
      userId: data.user_id,
      activationId: data.activation_id,
      status: 'active',
      createdAt: new Date(data.created_at),
    };
  } catch (error) {
    console.error('[SHIELD] Error creating crisis session:', error);
    return null;
  }
}

/**
 * Resolve (end) a crisis session
 * Called when user confirms they are safe
 */
export async function resolveCrisisSession(
  sessionId: string
): Promise<boolean> {
  if (!isSupabaseInitialized()) {
    console.warn('[SHIELD] Supabase not initialized, cannot resolve crisis session');
    return false;
  }

  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('shield_crisis_sessions')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) {
      console.error('[SHIELD] Failed to resolve crisis session:', error);
      return false;
    }

    console.log(`[SHIELD] Resolved crisis session: ${sessionId}`);
    return true;
  } catch (error) {
    console.error('[SHIELD] Error resolving crisis session:', error);
    return false;
  }
}

/**
 * Get crisis session by ID
 */
export async function getCrisisSession(
  sessionId: string
): Promise<CrisisSession | null> {
  if (!isSupabaseInitialized()) {
    return null;
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('shield_crisis_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      activationId: data.activation_id,
      status: data.status,
      createdAt: new Date(data.created_at),
      resolvedAt: data.resolved_at ? new Date(data.resolved_at) : undefined,
    };
  } catch (error) {
    console.error('[SHIELD] Error fetching crisis session by ID:', error);
    return null;
  }
}
