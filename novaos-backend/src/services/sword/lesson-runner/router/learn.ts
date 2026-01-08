// ═══════════════════════════════════════════════════════════════════════════════
// LEARN FLOW HANDLER
// Main learning path - generates lesson plan and daily lessons
// ═══════════════════════════════════════════════════════════════════════════════

import { getSupabase } from '../../../../db/index.js';
import type { PlanSubskill, LessonPlan } from '../../types.js';
import type { StartSubskillResult, SubskillLessonPlan } from '../types.js';
import { generateLessonPlan } from '../lesson-plan/generator.js';

/**
 * Handle learn flow - generate lesson plan if needed
 */
export async function handleLearnFlow(
  userId: string,
  subskill: PlanSubskill,
  plan: LessonPlan
): Promise<StartSubskillResult> {
  const supabase = getSupabase();
  
  console.log(`[LEARN] Starting learn flow for: ${subskill.title}`);
  
  // Check if lesson plan already exists
  let lessonPlan: SubskillLessonPlan | null = null;
  
  if (subskill.lessonPlanId) {
    // Fetch existing lesson plan
    const { data: existingRow } = await supabase
      .from('subskill_lesson_plans')
      .select('*')
      .eq('id', subskill.lessonPlanId)
      .single();
    
    if (existingRow) {
      const { mapSubskillLessonPlan } = await import('../types.js');
      lessonPlan = mapSubskillLessonPlan(existingRow);
      console.log(`[LEARN] Using existing lesson plan`);
    }
  }
  
  // Generate new lesson plan if needed
  if (!lessonPlan) {
    console.log(`[LEARN] Generating new lesson plan`);
    lessonPlan = await generateLessonPlan(userId, subskill, plan);
    
    // Update subskill with lesson plan ID
    await supabase
      .from('plan_subskills')
      .update({
        lesson_plan_id: lessonPlan.id,
        status: 'active',
      })
      .eq('id', subskill.id);
    
    // Update plan's current subskill
    await supabase
      .from('lesson_plans')
      .update({ current_subskill_id: subskill.id })
      .eq('id', plan.id);
  }
  
  // Ensure subskill is active
  if (subskill.status === 'pending') {
    await supabase
      .from('plan_subskills')
      .update({ status: 'active' })
      .eq('id', subskill.id);
  }
  
  return {
    routeType: 'learn',
    subskill: { ...subskill, status: 'active' },
    lessonPlan,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const LearnHandler = {
  handle: handleLearnFlow,
};
