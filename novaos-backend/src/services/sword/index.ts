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
import type { LessonPlan, LessonPlanRow, TodayResponse, DesignerSession } from './types.js';
import { mapLessonPlan } from './types.js';

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
 */
export async function getUserPlans(userId: string): Promise<LessonPlan[]> {
  if (!isSupabaseInitialized()) {
    return [];
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('lesson_plans')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get plans: ${error.message}`);
  }

  return (data || []).map(row => mapLessonPlan(row as LessonPlanRow));
}

/**
 * Activate a plan
 */
export async function activatePlan(
  userId: string,
  planId: string
): Promise<LessonPlan> {
  if (!isSupabaseInitialized()) {
    throw new Error('Database not initialized');
  }

  const supabase = getSupabase();

  // Deactivate any currently active plan
  await supabase
    .from('lesson_plans')
    .update({ status: 'abandoned', abandoned_at: new Date().toISOString() } as any)
    .eq('user_id', userId)
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
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to activate plan: ${error.message}`);
  }

  // Initialize node progress for the plan
  await supabase.rpc('initialize_node_progress', {
    p_user_id: userId,
    p_plan_id: planId,
  });

  return mapLessonPlan(data as LessonPlanRow);
}

/**
 * Abandon a plan
 */
export async function abandonPlan(
  userId: string,
  planId: string
): Promise<void> {
  if (!isSupabaseInitialized()) {
    return;
  }

  const supabase = getSupabase();
  await supabase
    .from('lesson_plans')
    .update({ 
      status: 'abandoned', 
      abandoned_at: new Date().toISOString() 
    } as any)
    .eq('id', planId)
    .eq('user_id', userId);
}

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────────

export const SwordGate = {
  // State
  getState: getSwordState,
  
  // Plans
  getPlans: getUserPlans,
  activatePlan,
  abandonPlan,
  
  // Designer (delegation)
  Designer: LessonDesigner,
  
  // Runner (delegation)
  Runner: LessonRunner,
};

export default SwordGate;
