// ═══════════════════════════════════════════════════════════════════════════════
// LESSON PLAN GENERATOR — LLM-Powered
// Generates comprehensive lesson plans using Gemini 3 Pro
// ═══════════════════════════════════════════════════════════════════════════════

import { getSupabase } from '../../../../db/index.js';
import { SwordGateLLM } from '../../llm/swordgate-llm.js';
import type { PlanSubskill, LessonPlan } from '../../types.js';
import { mapPlanSubskill, mapLessonPlan } from '../../types.js';
import type {
  SubskillLessonPlan,
  SessionOutline,
  Gap,
  SessionSummary,
} from '../types.js';
import { mapSubskillLessonPlan, mapSessionSummary } from '../types.js';
import {
  LESSON_PLAN_SYSTEM_PROMPT,
  buildLessonPlanUserMessage,
  buildFullContext,
  parseLLMJson,
  getRouteGuidance,
} from '../shared/prompts.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

interface LessonPlanLLMResponse {
  learningObjectives: string[];
  prerequisites: string[];
  sessionOutline: SessionOutline[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generate a lesson plan for a subskill using LLM
 * 
 * @param userId - External user ID
 * @param subskill - The subskill object (or subskill ID for backwards compat)
 * @param plan - The lesson plan object (optional if subskill ID passed)
 * @param isRemediation - Whether this is a remediation plan
 * @param assessmentId - Assessment ID if remediation
 * @param gaps - Identified gaps if remediation
 */
export async function generateLessonPlan(
  userId: string,
  subskillOrId: PlanSubskill | string,
  planOrRemediation?: LessonPlan | boolean,
  isRemediationOrAssessmentId?: boolean | string,
  assessmentIdOrGaps?: string | Gap[],
  gaps?: Gap[]
): Promise<SubskillLessonPlan> {
  const supabase = getSupabase();
  
  // Get user's internal ID
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('external_id', userId)
    .single();
  
  if (!user) {
    throw new Error('User not found');
  }
  
  // Handle both calling conventions:
  // 1. generateLessonPlan(userId, subskill, plan, isRemediation?, assessmentId?, gaps?)
  // 2. generateLessonPlan(userId, subskillId, isRemediation?, assessmentId?, gaps?)
  
  let subskill: PlanSubskill;
  let plan: LessonPlan;
  let isRemediation: boolean = false;
  let assessmentId: string | undefined;
  let actualGaps: Gap[] | undefined;
  
  if (typeof subskillOrId === 'string') {
    // Called with subskillId string
    const { data: subskillRow } = await supabase
      .from('plan_subskills')
      .select('*')
      .eq('id', subskillOrId)
      .single();
    
    if (!subskillRow) {
      throw new Error(`Subskill not found: ${subskillOrId}`);
    }
    
    subskill = mapPlanSubskill(subskillRow);
    
    const { data: planRow } = await supabase
      .from('lesson_plans')
      .select('*')
      .eq('id', subskill.planId)
      .single();
    
    if (!planRow) {
      throw new Error(`Plan not found: ${subskill.planId}`);
    }
    
    plan = mapLessonPlan(planRow);
    isRemediation = (planOrRemediation as boolean) || false;
    assessmentId = isRemediationOrAssessmentId as string | undefined;
    actualGaps = assessmentIdOrGaps as Gap[] | undefined;
  } else {
    // Called with subskill object
    subskill = subskillOrId;
    plan = planOrRemediation as LessonPlan;
    isRemediation = (isRemediationOrAssessmentId as boolean) || false;
    assessmentId = assessmentIdOrGaps as string | undefined;
    actualGaps = gaps;
  }
  
  const subskillId = subskill.id;
  
  // Get previous summaries for context
  const { data: summaryRows } = await supabase
    .from('session_summaries')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5);
  
  const previousSummaries = (summaryRows || []).map(mapSessionSummary);
  
  // Get previous scores for weak area detection
  const { data: checkRows } = await supabase
    .from('knowledge_checks')
    .select('score, missed_questions')
    .eq('user_id', user.id)
    .not('score', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(5);
  
  const previousScores = (checkRows || []).map(r => r.score).filter(Boolean) as number[];
  
  // Extract weak areas from missed questions
  const weakAreas: string[] = [];
  for (const check of checkRows || []) {
    if (check.missed_questions) {
      for (const mq of check.missed_questions as any[]) {
        if (mq.relatedConcept && !weakAreas.includes(mq.relatedConcept)) {
          weakAreas.push(mq.relatedConcept);
        }
      }
    }
  }
  
  // Build full context
  const context = buildFullContext(
    subskill,
    plan,
    1, // Starting session
    subskill.estimatedSessions || 5,
    previousSummaries,
    previousScores,
    weakAreas.slice(0, 5)
  );
  
  console.log(`[LESSON_PLAN] Generating for: ${subskill.title} (${subskill.route})`);
  
  // Generate with LLM
  let lessonPlanData: LessonPlanLLMResponse;
  
  try {
    const userMessage = buildLessonPlanUserMessage(subskill, plan, context, isRemediation, actualGaps);
    
    const response = await SwordGateLLM.generate(
      LESSON_PLAN_SYSTEM_PROMPT,
      userMessage,
      { thinkingLevel: 'high' }
    );
    
    lessonPlanData = parseLLMJson<LessonPlanLLMResponse>(response);
    
    // Validate response
    if (!lessonPlanData.learningObjectives?.length) {
      throw new Error('Missing learning objectives');
    }
    if (!lessonPlanData.sessionOutline?.length) {
      throw new Error('Missing session outline');
    }
    
    console.log(`[LESSON_PLAN] LLM generated ${lessonPlanData.sessionOutline.length} sessions`);
    
  } catch (error) {
    console.error('[LESSON_PLAN] LLM generation failed, using fallback:', error);
    lessonPlanData = generateFallbackLessonPlan(subskill, plan, actualGaps);
  }
  
  // Ensure session outline has proper structure
  const sessionOutline = lessonPlanData.sessionOutline.map((session, index) => ({
    sessionNumber: session.sessionNumber || index + 1,
    title: session.title || `Session ${index + 1}`,
    focus: session.focus || `Focus on ${subskill.title}`,
    objectives: session.objectives || [],
    estimatedMinutes: session.estimatedMinutes || plan.dailyMinutes || 30,
  }));
  
  // Save to database
  const { data: row, error } = await supabase
    .from('subskill_lesson_plans')
    .insert({
      subskill_id: subskillId,
      plan_id: subskill.planId,
      learning_objectives: lessonPlanData.learningObjectives,
      prerequisites: lessonPlanData.prerequisites || [],
      session_outline: sessionOutline,
      is_remediation_plan: isRemediation,
      assessment_id: assessmentId || null,
      gaps: actualGaps || null,
      generated_at: new Date().toISOString(),
      generation_source: 'llm',
    })
    .select()
    .single();
  
  if (error || !row) {
    throw new Error(`Failed to save lesson plan: ${error?.message}`);
  }
  
  // Update subskill with estimated sessions
  await supabase
    .from('plan_subskills')
    .update({
      estimated_sessions: sessionOutline.length,
      status: 'active',
    })
    .eq('id', subskillId);
  
  console.log(`[LESSON_PLAN] Saved plan with ${sessionOutline.length} sessions`);
  
  return mapSubskillLessonPlan(row);
}

/**
 * Get existing lesson plan for a subskill
 */
export async function getLessonPlan(subskillId: string): Promise<SubskillLessonPlan | null> {
  const supabase = getSupabase();
  
  const { data: row, error } = await supabase
    .from('subskill_lesson_plans')
    .select('*')
    .eq('subskill_id', subskillId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error?.code === 'PGRST116' || !row) {
    return null;
  }
  
  return mapSubskillLessonPlan(row);
}

/**
 * Regenerate lesson plan (delete existing and create new)
 */
export async function regenerateLessonPlan(
  userId: string,
  subskillId: string
): Promise<SubskillLessonPlan> {
  const supabase = getSupabase();
  
  // Delete existing
  await supabase
    .from('subskill_lesson_plans')
    .delete()
    .eq('subskill_id', subskillId);
  
  console.log(`[LESSON_PLAN] Regenerating for subskill: ${subskillId}`);
  
  return generateLessonPlan(userId, subskillId);
}

// ─────────────────────────────────────────────────────────────────────────────────
// FALLBACK GENERATION
// ─────────────────────────────────────────────────────────────────────────────────

function generateFallbackLessonPlan(
  subskill: PlanSubskill,
  plan: LessonPlan,
  gaps?: Gap[]
): LessonPlanLLMResponse {
  const route = subskill.route;
  const complexity = subskill.complexity;
  const dailyMinutes = plan.dailyMinutes || 30;
  
  // Base sessions by complexity
  const baseSessions = complexity === 1 ? 3 : complexity === 2 ? 4 : 5;
  
  // Generate objectives
  const learningObjectives = [
    `Understand the core concepts of ${subskill.title}`,
    `Apply ${subskill.title} in practical scenarios`,
    `Demonstrate mastery through knowledge check`,
  ];
  
  if (complexity >= 2) {
    learningObjectives.splice(2, 0, `Analyze common patterns and variations in ${subskill.title}`);
  }
  if (complexity >= 3) {
    learningObjectives.splice(3, 0, `Handle edge cases and complex scenarios in ${subskill.title}`);
  }
  
  // Generate session outline based on route
  const sessionOutline: SessionOutline[] = [];
  
  switch (route) {
    case 'recall':
      sessionOutline.push(
        { sessionNumber: 1, title: 'Introduction & Exposure', focus: `First exposure to ${subskill.title} concepts`, objectives: ['Identify key terminology', 'Understand basic structure'], estimatedMinutes: dailyMinutes },
        { sessionNumber: 2, title: 'Encoding & Connection', focus: 'Connect new concepts to existing knowledge', objectives: ['Create mental associations', 'Build concept maps'], estimatedMinutes: dailyMinutes },
        { sessionNumber: 3, title: 'Active Retrieval', focus: 'Practice recalling without prompts', objectives: ['Retrieve from memory', 'Identify gaps'], estimatedMinutes: dailyMinutes },
      );
      break;
      
    case 'practice':
      sessionOutline.push(
        { sessionNumber: 1, title: 'Demonstration', focus: `Watch and understand ${subskill.title} in action`, objectives: ['Observe procedure', 'Note key steps'], estimatedMinutes: dailyMinutes },
        { sessionNumber: 2, title: 'Guided Practice', focus: 'Practice with scaffolding and hints', objectives: ['Execute with guidance', 'Build muscle memory'], estimatedMinutes: dailyMinutes },
        { sessionNumber: 3, title: 'Independent Practice', focus: 'Practice without assistance', objectives: ['Execute independently', 'Self-correct errors'], estimatedMinutes: dailyMinutes },
      );
      break;
      
    case 'build':
      sessionOutline.push(
        { sessionNumber: 1, title: 'Planning & Design', focus: `Plan your ${subskill.title} project`, objectives: ['Define requirements', 'Create outline'], estimatedMinutes: dailyMinutes },
        { sessionNumber: 2, title: 'Foundation Building', focus: 'Build the core structure', objectives: ['Implement basics', 'Test foundation'], estimatedMinutes: dailyMinutes },
        { sessionNumber: 3, title: 'Development', focus: 'Add features and functionality', objectives: ['Extend functionality', 'Handle edge cases'], estimatedMinutes: dailyMinutes },
        { sessionNumber: 4, title: 'Polish & Review', focus: 'Refine and complete', objectives: ['Fix issues', 'Improve quality'], estimatedMinutes: dailyMinutes },
      );
      break;
      
    default:
      sessionOutline.push(
        { sessionNumber: 1, title: 'Introduction', focus: `Introduction to ${subskill.title}`, objectives: ['Understand basics', 'See examples'], estimatedMinutes: dailyMinutes },
        { sessionNumber: 2, title: 'Deep Dive', focus: `Explore ${subskill.title} in depth`, objectives: ['Understand details', 'Practice application'], estimatedMinutes: dailyMinutes },
        { sessionNumber: 3, title: 'Application', focus: `Apply ${subskill.title} to scenarios`, objectives: ['Solve problems', 'Build confidence'], estimatedMinutes: dailyMinutes },
      );
  }
  
  // Add knowledge check session
  sessionOutline.push({
    sessionNumber: sessionOutline.length + 1,
    title: 'Knowledge Check',
    focus: `Verify mastery of ${subskill.title}`,
    objectives: ['Demonstrate understanding', 'Pass mastery test'],
    estimatedMinutes: dailyMinutes,
  });
  
  // Handle remediation gaps
  if (gaps && gaps.length > 0) {
    const highPriorityGaps = gaps.filter(g => g.priority === 'high');
    for (const gap of highPriorityGaps) {
      learningObjectives.push(`Address gap: ${gap.area}`);
    }
  }
  
  return {
    learningObjectives,
    prerequisites: [],
    sessionOutline,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const LessonPlanGenerator = {
  generate: generateLessonPlan,
  get: getLessonPlan,
  regenerate: regenerateLessonPlan,
};
