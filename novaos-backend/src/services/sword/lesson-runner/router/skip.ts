// ═══════════════════════════════════════════════════════════════════════════════
// SKIP FLOW HANDLER
// Auto-completes skipped subskills and advances to next
// ═══════════════════════════════════════════════════════════════════════════════

import { getSupabase } from '../../../../db/index.js';
import type { PlanSubskill, LessonPlan } from '../../types.js';
import { mapPlanSubskill } from '../../types.js';
import type { StartSubskillResult } from '../types.js';

/**
 * Handle skip flow - mark complete and advance
 */
export async function handleSkipFlow(
  userId: string,
  subskill: PlanSubskill,
  plan: LessonPlan
): Promise<StartSubskillResult> {
  const supabase = getSupabase();
  
  console.log(`[SKIP] Skipping subskill: ${subskill.title}`);
  
  // Already skipped, just find next
  if (subskill.status === 'skipped') {
    const nextSubskill = await getNextSubskill(plan.id, subskill.order);
    
    // If there's a next subskill, make it active
    if (nextSubskill) {
      await supabase
        .from('plan_subskills')
        .update({ status: 'active' })
        .eq('id', nextSubskill.id);
      
      // Update plan's current subskill
      await supabase
        .from('lesson_plans')
        .update({ current_subskill_id: nextSubskill.id })
        .eq('id', plan.id);
    }
    
    return {
      routeType: 'skip',
      subskill,
      nextSubskill: nextSubskill || undefined,
    };
  }
  
  // Mark as skipped (shouldn't normally happen, but handle it)
  await supabase
    .from('plan_subskills')
    .update({
      status: 'skipped',
      mastered_at: new Date().toISOString(),
    })
    .eq('id', subskill.id);
  
  // Get next subskill
  const nextSubskill = await getNextSubskill(plan.id, subskill.order);
  
  // If there's a next subskill, make it active
  if (nextSubskill) {
    await supabase
      .from('plan_subskills')
      .update({ status: 'active' })
      .eq('id', nextSubskill.id);
    
    // Update plan's current subskill
    await supabase
      .from('lesson_plans')
      .update({ current_subskill_id: nextSubskill.id })
      .eq('id', plan.id);
  } else {
    // No more subskills - check if plan is complete
    await checkPlanCompletion(plan.id);
  }
  
  // Update plan progress
  await updatePlanProgress(plan.id);
  
  return {
    routeType: 'skip',
    subskill: { ...subskill, status: 'skipped' },
    nextSubskill: nextSubskill || undefined,
  };
}

/**
 * Get next non-skipped subskill
 */
async function getNextSubskill(
  planId: string,
  currentOrder: number
): Promise<PlanSubskill | null> {
  const supabase = getSupabase();
  
  const { data: row } = await supabase
    .from('plan_subskills')
    .select('*')
    .eq('plan_id', planId)
    .in('status', ['pending', 'assess'])
    .gt('order', currentOrder)
    .order('order', { ascending: true })
    .limit(1)
    .single();
  
  return row ? mapPlanSubskill(row) : null;
}

/**
 * Check if all subskills are complete and mark plan accordingly
 */
async function checkPlanCompletion(planId: string): Promise<void> {
  const supabase = getSupabase();
  
  // Count incomplete subskills
  const { count } = await supabase
    .from('plan_subskills')
    .select('*', { count: 'exact', head: true })
    .eq('plan_id', planId)
    .in('status', ['pending', 'active', 'assess']);
  
  if (count === 0) {
    // All complete - mark plan as completed
    await supabase
      .from('lesson_plans')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        progress: 1.0,
      })
      .eq('id', planId);
    
    console.log(`[SKIP] Plan ${planId} completed!`);
  }
}

/**
 * Update plan progress based on subskill completion
 */
async function updatePlanProgress(planId: string): Promise<void> {
  const supabase = getSupabase();
  
  // Count total and completed subskills
  const { count: total } = await supabase
    .from('plan_subskills')
    .select('*', { count: 'exact', head: true })
    .eq('plan_id', planId);
  
  const { count: completed } = await supabase
    .from('plan_subskills')
    .select('*', { count: 'exact', head: true })
    .eq('plan_id', planId)
    .in('status', ['mastered', 'skipped']);
  
  const progress = total && total > 0 ? (completed || 0) / total : 0;
  
  await supabase
    .from('lesson_plans')
    .update({ progress })
    .eq('id', planId);
}
