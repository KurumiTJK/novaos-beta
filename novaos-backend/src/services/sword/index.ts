// ═══════════════════════════════════════════════════════════════════════════════
// SWORDGATE SERVICE
// Main entry point for the node-based learning system
// ═══════════════════════════════════════════════════════════════════════════════

// Re-export types
export * from './types.js';

// Re-export shared utilities
export { CircuitBreaker } from './shared/circuit-breaker.js';
export { Timezone } from './shared/timezone.js';
export { SessionAssetsGenerator } from './shared/session-assets.js';

// Re-export designer
export { LessonDesigner } from './lesson-designer/index.js';

// Re-export runner
export { LessonRunner } from './lesson-runner/index.js';

// Import for consolidated API
import { LessonDesigner } from './lesson-designer/index.js';
import { LessonRunner } from './lesson-runner/index.js';
import { getSupabase, isSupabaseInitialized } from '../../db/index.js';
import type { LessonPlan, LessonPlanRow, TodayResponse, DesignerSession, PlanSubskill } from './types.js';
import { mapLessonPlan, mapPlanSubskill } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// USER ID HELPER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get internal UUID from external user ID (JWT user ID like "user_xxx")
 * Creates user if not exists
 */
async function getInternalUserId(externalId: string): Promise<string> {
  if (!isSupabaseInitialized()) {
    throw new Error('Database not initialized');
  }

  const supabase = getSupabase();

  // Try to find existing user by external_id
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('external_id', externalId)
    .single();

  if (existing) {
    return existing.id;
  }

  // User doesn't exist - create them with placeholder email
  const placeholderEmail = `${externalId}@novaos.local`;
  
  const { data: newUser, error: createError } = await supabase
    .from('users')
    .insert({
      external_id: externalId,
      email: placeholderEmail,
      tier: 'free',
    } as any)
    .select('id')
    .single();

  if (createError) {
    // Handle race condition
    if (createError.code === '23505') {
      const { data: retryUser } = await supabase
        .from('users')
        .select('id')
        .eq('external_id', externalId)
        .single();
      
      if (retryUser) {
        return retryUser.id;
      }
    }
    throw new Error(`Failed to create user: ${createError.message}`);
  }

  return newUser.id;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONSOLIDATED API
// ─────────────────────────────────────────────────────────────────────────────────

export interface DesignerState {
  hasActiveSession: boolean;
  session?: DesignerSession;
}

/**
 * Get full SwordGate state for a user
 */
export async function getSwordState(userId: string): Promise<{
  hasActivePlan: boolean;
  hasDesignerSession: boolean;
  today?: TodayResponse;
  designerState?: DesignerState;
}> {
  // Check for active plan
  const today = await LessonRunner.getToday(userId);
  
  // Check for designer session - use getActiveSession (not getState which doesn't exist)
  const session = await LessonDesigner.getActiveSession(userId);
  const hasActiveSession = session !== null;

  return {
    hasActivePlan: today !== null,
    hasDesignerSession: hasActiveSession,
    today: today || undefined,
    designerState: hasActiveSession ? { hasActiveSession, session: session! } : undefined,
  };
}

/**
 * Get all plans for a user
 * @param externalUserId - JWT user ID (e.g., "user_xxx")
 */
export async function getUserPlans(externalUserId: string): Promise<LessonPlan[]> {
  if (!isSupabaseInitialized()) {
    return [];
  }

  // Get internal UUID from external ID
  let internalUserId: string;
  try {
    internalUserId = await getInternalUserId(externalUserId);
  } catch {
    return []; // User doesn't exist
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('lesson_plans')
    .select('*')
    .eq('user_id', internalUserId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get plans: ${error.message}`);
  }

  return (data || []).map(row => mapLessonPlan(row as LessonPlanRow));
}

/**
 * Get subskills for a plan
 * @param planId - Plan UUID
 */
export async function getPlanSubskills(planId: string): Promise<PlanSubskill[]> {
  if (!isSupabaseInitialized()) {
    return [];
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('plan_subskills')
    .select('*')
    .eq('plan_id', planId)
    .order('order', { ascending: true });

  if (error) {
    throw new Error(`Failed to get subskills: ${error.message}`);
  }

  return (data || []).map(mapPlanSubskill);
}

/**
 * Activate a plan
 * @param externalUserId - JWT user ID (e.g., "user_xxx")
 */
export async function activatePlan(
  externalUserId: string,
  planId: string
): Promise<LessonPlan> {
  if (!isSupabaseInitialized()) {
    throw new Error('Database not initialized');
  }

  // Get internal UUID from external ID
  const internalUserId = await getInternalUserId(externalUserId);

  const supabase = getSupabase();

  // Deactivate any currently active plan
  await supabase
    .from('lesson_plans')
    .update({ status: 'abandoned', abandoned_at: new Date().toISOString() } as any)
    .eq('user_id', internalUserId)
    .eq('status', 'active');

  // Activate the requested plan
  const { data, error } = await supabase
    .from('lesson_plans')
    .update({ 
      status: 'active', 
      started_at: new Date().toISOString(),
      abandoned_at: null,
    } as any)
    .eq('id', planId)
    .eq('user_id', internalUserId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to activate plan: ${error.message}`);
  }

  // Initialize node progress for the plan
  await supabase.rpc('initialize_node_progress', {
    p_user_id: internalUserId,
    p_plan_id: planId,
  });

  return mapLessonPlan(data as LessonPlanRow);
}

/**
 * Abandon a plan
 * @param externalUserId - JWT user ID (e.g., "user_xxx")
 */
export async function abandonPlan(
  externalUserId: string,
  planId: string
): Promise<void> {
  if (!isSupabaseInitialized()) {
    return;
  }

  // Get internal UUID from external ID
  let internalUserId: string;
  try {
    internalUserId = await getInternalUserId(externalUserId);
  } catch {
    return; // User doesn't exist
  }

  const supabase = getSupabase();
  await supabase
    .from('lesson_plans')
    .update({ 
      status: 'abandoned', 
      abandoned_at: new Date().toISOString() 
    } as any)
    .eq('id', planId)
    .eq('user_id', internalUserId);
}

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────────

export const SwordGate = {
  // State
  getState: getSwordState,
  
  // Plans
  getPlans: getUserPlans,
  getPlanSubskills,
  activatePlan,
  abandonPlan,
  
  // Designer (delegation)
  Designer: LessonDesigner,
  
  // Runner (delegation)
  Runner: LessonRunner,
};

export default SwordGate;
