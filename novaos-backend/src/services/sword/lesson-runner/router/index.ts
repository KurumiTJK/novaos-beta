// ═══════════════════════════════════════════════════════════════════════════════
// SUBSKILL ROUTER
// Determines which flow to use: skip, assess, or learn
// ═══════════════════════════════════════════════════════════════════════════════

import { getSupabase } from '../../../../db/index.js';
import type { PlanSubskill, LessonPlan } from '../../types.js';
import { mapPlanSubskill, mapLessonPlan } from '../../types.js';
import type {
  SubskillRouteType,
  StartSubskillResult,
} from '../types.js';
import { handleSkipFlow } from './skip.js';
import { handleAssessFlow } from './assess.js';
import { handleLearnFlow } from './learn.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN ROUTER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Start a subskill - routes to appropriate flow based on status
 */
export async function startSubskill(
  userId: string,
  subskillId: string
): Promise<StartSubskillResult> {
  const supabase = getSupabase();
  
  // Get subskill
  const { data: subskillRow, error: subskillError } = await supabase
    .from('plan_subskills')
    .select('*')
    .eq('id', subskillId)
    .single();
  
  if (subskillError || !subskillRow) {
    throw new Error(`Subskill not found: ${subskillId}`);
  }
  
  const subskill = mapPlanSubskill(subskillRow);
  
  // Get plan for context
  const { data: planRow, error: planError } = await supabase
    .from('lesson_plans')
    .select('*')
    .eq('id', subskill.planId)
    .single();
  
  if (planError || !planRow) {
    throw new Error(`Plan not found: ${subskill.planId}`);
  }
  
  const plan = mapLessonPlan(planRow);
  
  // Determine route type based on status
  const routeType = getRouteType(subskill);
  
  console.log(`[ROUTER] Starting subskill ${subskill.title} with route: ${routeType}`);
  
  // Route to appropriate handler
  switch (routeType) {
    case 'skip':
      return handleSkipFlow(userId, subskill, plan);
    
    case 'assess':
      return handleAssessFlow(userId, subskill, plan);
    
    case 'learn':
      return handleLearnFlow(userId, subskill, plan);
    
    default:
      throw new Error(`Unknown route type: ${routeType}`);
  }
}

/**
 * Determine route type from subskill status
 */
function getRouteType(subskill: PlanSubskill): SubskillRouteType {
  switch (subskill.status) {
    case 'skipped':
      return 'skip';
    
    case 'assess':
      return 'assess';
    
    case 'pending':
    case 'active':
      return 'learn';
    
    case 'mastered':
      // Already complete, but allow re-entry for review
      return 'learn';
    
    default:
      return 'learn';
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SUBSKILL QUERIES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get current active subskill for a plan
 */
export async function getCurrentSubskill(
  planId: string
): Promise<PlanSubskill | null> {
  const supabase = getSupabase();
  
  // First check for 'active' status
  const { data: activeRow } = await supabase
    .from('plan_subskills')
    .select('*')
    .eq('plan_id', planId)
    .eq('status', 'active')
    .order('order', { ascending: true })
    .limit(1)
    .single();
  
  if (activeRow) {
    return mapPlanSubskill(activeRow);
  }
  
  // Then check for first 'pending' or 'assess'
  const { data: nextRow } = await supabase
    .from('plan_subskills')
    .select('*')
    .eq('plan_id', planId)
    .in('status', ['pending', 'assess'])
    .order('order', { ascending: true })
    .limit(1)
    .single();
  
  if (nextRow) {
    return mapPlanSubskill(nextRow);
  }
  
  return null;
}

/**
 * Get next subskill after current one
 */
export async function getNextSubskill(
  planId: string,
  currentOrder: number
): Promise<PlanSubskill | null> {
  const supabase = getSupabase();
  
  const { data: nextRow } = await supabase
    .from('plan_subskills')
    .select('*')
    .eq('plan_id', planId)
    .in('status', ['pending', 'assess'])
    .gt('order', currentOrder)
    .order('order', { ascending: true })
    .limit(1)
    .single();
  
  if (nextRow) {
    return mapPlanSubskill(nextRow);
  }
  
  return null;
}

/**
 * Get all subskills for a plan
 */
export async function getAllSubskills(
  planId: string
): Promise<PlanSubskill[]> {
  const supabase = getSupabase();
  
  const { data: rows, error } = await supabase
    .from('plan_subskills')
    .select('*')
    .eq('plan_id', planId)
    .order('order', { ascending: true });
  
  if (error) {
    throw new Error(`Failed to get subskills: ${error.message}`);
  }
  
  return (rows || []).map(mapPlanSubskill);
}

/**
 * Get subskill by ID
 */
export async function getSubskillById(
  subskillId: string
): Promise<PlanSubskill | null> {
  const supabase = getSupabase();
  
  const { data: row, error } = await supabase
    .from('plan_subskills')
    .select('*')
    .eq('id', subskillId)
    .single();
  
  if (error?.code === 'PGRST116' || !row) {
    return null;
  }
  
  if (error) {
    throw new Error(`Failed to get subskill: ${error.message}`);
  }
  
  return mapPlanSubskill(row);
}

/**
 * Update subskill status
 */
export async function updateSubskillStatus(
  subskillId: string,
  status: PlanSubskill['status'],
  additionalUpdates?: Partial<{
    sessionsCompleted: number;
    lastSessionDate: Date;
    masteredAt: Date;
    lessonPlanId: string;
    currentSession: number;
  }>
): Promise<PlanSubskill> {
  const supabase = getSupabase();
  
  const updates: Record<string, any> = { status };
  
  if (additionalUpdates?.sessionsCompleted !== undefined) {
    updates.sessions_completed = additionalUpdates.sessionsCompleted;
  }
  if (additionalUpdates?.lastSessionDate) {
    updates.last_session_date = additionalUpdates.lastSessionDate.toISOString();
  }
  if (additionalUpdates?.masteredAt) {
    updates.mastered_at = additionalUpdates.masteredAt.toISOString();
  }
  if (additionalUpdates?.lessonPlanId) {
    updates.lesson_plan_id = additionalUpdates.lessonPlanId;
  }
  if (additionalUpdates?.currentSession !== undefined) {
    updates.current_session = additionalUpdates.currentSession;
  }
  
  const { data: row, error } = await supabase
    .from('plan_subskills')
    .update(updates)
    .eq('id', subskillId)
    .select()
    .single();
  
  if (error || !row) {
    throw new Error(`Failed to update subskill: ${error?.message}`);
  }
  
  return mapPlanSubskill(row);
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const SubskillRouter = {
  start: startSubskill,
  getCurrent: getCurrentSubskill,
  getNext: getNextSubskill,
  getAll: getAllSubskills,
  getById: getSubskillById,
  updateStatus: updateSubskillStatus,
};
