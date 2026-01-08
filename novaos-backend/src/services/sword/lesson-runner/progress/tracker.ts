// ═══════════════════════════════════════════════════════════════════════════════
// PROGRESS TRACKER
// Tracks multi-level progress: session, subskill, plan
// ═══════════════════════════════════════════════════════════════════════════════

import { getSupabase } from '../../../../db/index.js';
import type { PlanSubskill, LessonPlan } from '../../types.js';
import { mapPlanSubskill, mapLessonPlan } from '../../types.js';
import type { TodayState, SessionSummary } from '../types.js';
import { mapSessionSummary } from '../types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TODAY STATE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get today's learning state for a user
 */
export async function getToday(userId: string): Promise<TodayState | null> {
  const supabase = getSupabase();
  
  // Get user's internal ID
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('external_id', userId)
    .single();
  
  if (!user) return null;
  const internalUserId = user.id;
  
  // Get active plan
  const { data: planRow } = await supabase
    .from('lesson_plans')
    .select('*')
    .eq('user_id', internalUserId)
    .eq('status', 'active')
    .single();
  
  if (!planRow) return null;
  
  const plan = mapLessonPlan(planRow);
  
  // Get current subskill
  let currentSubskill: PlanSubskill | null = null;
  
  // First try currentSubskillIndex - query by order field
  if (plan.currentSubskillIndex !== undefined && plan.currentSubskillIndex >= 0) {
    const { data: subskillRow } = await supabase
      .from('plan_subskills')
      .select('*')
      .eq('plan_id', plan.id)
      .eq('order', plan.currentSubskillIndex)
      .single();
    
    if (subskillRow) {
      currentSubskill = mapPlanSubskill(subskillRow);
    }
  }
  
  // If not found, get first non-completed subskill
  if (!currentSubskill) {
    const { data: subskillRow } = await supabase
      .from('plan_subskills')
      .select('*')
      .eq('plan_id', plan.id)
      .in('status', ['pending', 'active', 'assess'])
      .order('order', { ascending: true })
      .limit(1)
      .single();
    
    if (subskillRow) {
      currentSubskill = mapPlanSubskill(subskillRow);
    }
  }
  
  // No current subskill means plan is complete
  if (!currentSubskill) return null;
  
  // Get subskill counts
  const { count: totalSubskills } = await supabase
    .from('plan_subskills')
    .select('*', { count: 'exact', head: true })
    .eq('plan_id', plan.id);
  
  const { count: completedSubskills } = await supabase
    .from('plan_subskills')
    .select('*', { count: 'exact', head: true })
    .eq('plan_id', plan.id)
    .in('status', ['mastered', 'skipped']);
  
  // Calculate session info - use sessionsCompleted (correct property name)
  const sessionNumber = (currentSubskill.sessionsCompleted || 0) + 1;
  const totalSessions = currentSubskill.estimatedSessions || 3;
  const isKnowledgeCheckDay = sessionNumber === totalSessions;
  
  // Check for refresh need (7+ day gap)
  const needsRefresh = checkNeedsRefresh(currentSubskill);
  const refreshGapDays = calculateGapDays(currentSubskill);
  
  // Calculate overall progress
  const overallProgress = totalSubskills && totalSubskills > 0
    ? (completedSubskills || 0) / totalSubskills
    : 0;
  
  return {
    plan,
    currentSubskill,
    sessionNumber,
    totalSessions,
    isKnowledgeCheckDay,
    subskillsCompleted: completedSubskills || 0,
    totalSubskills: totalSubskills || 0,
    overallProgress,
    needsRefresh,
    refreshGapDays: needsRefresh ? refreshGapDays : undefined,
  };
}

function checkNeedsRefresh(subskill: PlanSubskill): boolean {
  if (!subskill.lastSessionDate) return false;
  const gapDays = calculateGapDays(subskill);
  return gapDays >= 7;
}

function calculateGapDays(subskill: PlanSubskill): number {
  if (!subskill.lastSessionDate) return 0;
  const lastDate = new Date(subskill.lastSessionDate);
  const now = new Date();
  const diffMs = now.getTime() - lastDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// ─────────────────────────────────────────────────────────────────────────────────
// SUBSKILL PROGRESS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get progress for a specific subskill
 */
export async function getSubskillProgress(
  userId: string,
  subskillId: string
): Promise<{
  subskill: PlanSubskill;
  sessionsCompleted: number;
  totalSessions: number;
  progress: number;
  summaries: SessionSummary[];
}> {
  const supabase = getSupabase();
  
  // Get user's internal ID
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('external_id', userId)
    .single();
  
  if (!user) throw new Error('User not found');
  
  // Get subskill
  const { data: subskillRow, error } = await supabase
    .from('plan_subskills')
    .select('*')
    .eq('id', subskillId)
    .single();
  
  if (error || !subskillRow) {
    throw new Error(`Subskill not found: ${subskillId}`);
  }
  
  const subskill = mapPlanSubskill(subskillRow);
  
  // Get session summaries
  const { data: summaryRows } = await supabase
    .from('session_summaries')
    .select('*')
    .eq('subskill_id', subskillId)
    .eq('user_id', user.id)
    .order('session_number', { ascending: true });
  
  const summaries = (summaryRows || []).map(mapSessionSummary);
  
  const sessionsCompleted = subskill.sessionsCompleted || summaries.length;
  const totalSessions = subskill.estimatedSessions || 3;
  const progress = totalSessions > 0 ? sessionsCompleted / totalSessions : 0;
  
  return {
    subskill,
    sessionsCompleted,
    totalSessions,
    progress,
    summaries,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// PLAN PROGRESS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get overall plan progress
 */
export async function getPlanProgress(
  userId: string,
  planId: string
): Promise<{
  plan: LessonPlan;
  subskills: Array<{ subskill: PlanSubskill; progress: number }>;
  overallProgress: number;
  completedCount: number;
  totalCount: number;
}> {
  const supabase = getSupabase();
  
  // Get user's internal ID
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('external_id', userId)
    .single();
  
  if (!user) throw new Error('User not found');
  
  // Get plan
  const { data: planRow, error: planError } = await supabase
    .from('lesson_plans')
    .select('*')
    .eq('id', planId)
    .eq('user_id', user.id)
    .single();
  
  if (planError || !planRow) {
    throw new Error(`Plan not found: ${planId}`);
  }
  
  const plan = mapLessonPlan(planRow);
  
  // Get all subskills
  const { data: subskillRows } = await supabase
    .from('plan_subskills')
    .select('*')
    .eq('plan_id', planId)
    .order('order', { ascending: true });
  
  const subskills = (subskillRows || []).map(row => {
    const subskill = mapPlanSubskill(row);
    const sessionsCompleted = subskill.sessionsCompleted || 0;
    const totalSessions = subskill.estimatedSessions || 3;
    const progress = subskill.status === 'mastered' || subskill.status === 'skipped'
      ? 1.0
      : totalSessions > 0 ? sessionsCompleted / totalSessions : 0;
    
    return { subskill, progress };
  });
  
  // Count completed
  const completedCount = subskills.filter(s => 
    s.subskill.status === 'mastered' || s.subskill.status === 'skipped'
  ).length;
  
  const totalCount = subskills.length;
  const overallProgress = totalCount > 0 ? completedCount / totalCount : 0;
  
  return {
    plan,
    subskills,
    overallProgress,
    completedCount,
    totalCount,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// SESSION HISTORY
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get session history for a subskill
 */
export async function getSessionHistory(
  userId: string,
  subskillId: string
): Promise<SessionSummary[]> {
  const supabase = getSupabase();
  
  // Get user's internal ID
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('external_id', userId)
    .single();
  
  if (!user) return [];
  
  const { data: rows, error } = await supabase
    .from('session_summaries')
    .select('*')
    .eq('subskill_id', subskillId)
    .eq('user_id', user.id)
    .order('session_number', { ascending: true });
  
  if (error) {
    console.error(`Failed to get session history: ${error.message}`);
    return [];
  }
  
  return (rows || []).map(mapSessionSummary);
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const ProgressTracker = {
  getToday,
  getSubskill: getSubskillProgress,
  getPlan: getPlanProgress,
  getHistory: getSessionHistory,
};
