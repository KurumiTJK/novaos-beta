// ═══════════════════════════════════════════════════════════════════════════════
// REFRESH HANDLER — LLM-Powered
// Detects 7+ day gaps and generates personalized mini-review
// ═══════════════════════════════════════════════════════════════════════════════

import { getSupabase } from '../../../../db/index.js';
import { SwordGateLLM } from '../../llm/swordgate-llm.js';
import type { PlanSubskill, LessonPlan } from '../../types.js';
import { mapPlanSubskill, mapLessonPlan } from '../../types.js';
import type { RefreshContent, SessionSummary } from '../types.js';
import { mapSessionSummary } from '../types.js';
import {
  REFRESH_SYSTEM_PROMPT,
  buildRefreshUserMessage,
  parseLLMJson,
} from '../shared/prompts.js';

const REFRESH_GAP_DAYS = 7;

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

interface RefreshLLMResponse {
  summary: string;
  recallQuestions: string[];
  quickTips?: string[];
  estimatedMinutes: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// REFRESH CHECK
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check if subskill needs refresh (7+ day gap)
 */
export async function checkNeedsRefresh(
  userId: string,
  subskillId: string
): Promise<{ needsRefresh: boolean; gapDays: number }> {
  const supabase = getSupabase();
  
  // Get user's internal ID
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('external_id', userId)
    .single();
  
  if (!user) {
    return { needsRefresh: false, gapDays: 0 };
  }
  
  // Get subskill
  const { data: subskillRow } = await supabase
    .from('plan_subskills')
    .select('*')
    .eq('id', subskillId)
    .single();
  
  if (!subskillRow) {
    return { needsRefresh: false, gapDays: 0 };
  }
  
  const subskill = mapPlanSubskill(subskillRow);
  
  // Calculate gap
  if (!subskill.lastSessionDate) {
    return { needsRefresh: false, gapDays: 0 };
  }
  
  const lastDate = new Date(subskill.lastSessionDate);
  const now = new Date();
  const diffMs = now.getTime() - lastDate.getTime();
  const gapDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  return {
    needsRefresh: gapDays >= REFRESH_GAP_DAYS,
    gapDays,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// REFRESH CONTENT GENERATION (LLM-Powered)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generate refresh content for a subskill
 */
export async function generateRefreshContent(
  userId: string,
  subskillId: string
): Promise<RefreshContent> {
  const supabase = getSupabase();
  
  // Get user's internal ID
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('external_id', userId)
    .single();
  
  if (!user) throw new Error('User not found');
  const internalUserId = user.id;
  
  // Get subskill
  const { data: subskillRow } = await supabase
    .from('plan_subskills')
    .select('*')
    .eq('id', subskillId)
    .single();
  
  if (!subskillRow) {
    throw new Error(`Subskill not found: ${subskillId}`);
  }
  
  const subskill = mapPlanSubskill(subskillRow);
  
  // Get plan
  const { data: planRow } = await supabase
    .from('lesson_plans')
    .select('*')
    .eq('id', subskill.planId)
    .single();
  
  if (!planRow) {
    throw new Error(`Plan not found: ${subskill.planId}`);
  }
  
  const plan = mapLessonPlan(planRow);
  
  // Get previous session summaries
  const { data: summaryRows } = await supabase
    .from('session_summaries')
    .select('*')
    .eq('subskill_id', subskillId)
    .eq('user_id', internalUserId)
    .order('session_number', { ascending: false })
    .limit(5);
  
  const summaries = (summaryRows || []).map(mapSessionSummary);
  
  // Calculate gap days
  const { gapDays } = await checkNeedsRefresh(userId, subskillId);
  
  console.log(`[REFRESH] Generating content for ${subskill.title} (${gapDays} day gap)`);
  
  // Generate with LLM
  let refreshData: RefreshLLMResponse;
  
  try {
    const userMessage = buildRefreshUserMessage(subskill, plan, summaries, gapDays);
    
    const response = await SwordGateLLM.generate(
      REFRESH_SYSTEM_PROMPT,
      userMessage,
      { thinkingLevel: 'low' }
    );
    
    refreshData = parseLLMJson<RefreshLLMResponse>(response);
    
    if (!refreshData.summary || !refreshData.recallQuestions?.length) {
      throw new Error('Invalid refresh response');
    }
    
    console.log(`[REFRESH] LLM generated ${refreshData.recallQuestions.length} recall questions`);
    
  } catch (error) {
    console.error('[REFRESH] LLM generation failed, using fallback:', error);
    refreshData = buildFallbackRefreshContent(subskill, summaries, gapDays);
  }
  
  // Build the RefreshContent object
  const content: RefreshContent = {
    summary: refreshData.summary,
    previousSessionsSummary: summaries.map(s => s.summary),
    recallQuestions: refreshData.recallQuestions.slice(0, 5),
    quickTips: refreshData.quickTips,
    estimatedMinutes: refreshData.estimatedMinutes || 5,
  };
  
  console.log(`[REFRESH] Generated content for ${subskill.title}`);
  
  return content;
}

function buildFallbackRefreshContent(
  subskill: PlanSubskill,
  summaries: SessionSummary[],
  gapDays: number
): RefreshLLMResponse {
  // Collect key concepts from summaries
  const keyConcepts = new Set<string>();
  const previousSummaryTexts: string[] = [];
  
  for (const summary of summaries) {
    previousSummaryTexts.push(summary.summary);
    for (const concept of summary.keyConcepts) {
      keyConcepts.add(concept);
    }
  }
  
  // Build recall questions from concepts
  const recallQuestions: string[] = [];
  
  for (const concept of Array.from(keyConcepts).slice(0, 3)) {
    recallQuestions.push(`What do you remember about "${concept}"?`);
  }
  
  // Add general recall questions
  recallQuestions.push(
    `What was the main focus of ${subskill.title}?`,
    `What techniques or methods did you learn?`,
    `How would you apply what you learned to a real situation?`
  );
  
  // Build encouraging summary
  let summary: string;
  if (gapDays >= 14) {
    summary = `Welcome back! It's been ${gapDays} days since you worked on ${subskill.title}. That's okay - let's quickly refresh your memory before continuing. You previously covered: ${previousSummaryTexts.slice(0, 2).join(' ')}`;
  } else {
    summary = `Welcome back to ${subskill.title}! It's been about a week since your last session. Let's do a quick 5-minute refresh to reactivate what you learned. ${previousSummaryTexts[0] || ''}`;
  }
  
  return {
    summary,
    recallQuestions: recallQuestions.slice(0, 5),
    quickTips: [
      'Take a moment to think about each question before moving on',
      'Don\'t worry if you can\'t remember everything - that\'s why we\'re refreshing!',
    ],
    estimatedMinutes: 5,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// SKIP REFRESH
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Skip refresh and continue to lesson
 */
export async function skipRefresh(
  userId: string,
  subskillId: string
): Promise<void> {
  const supabase = getSupabase();
  
  // Get user's internal ID
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('external_id', userId)
    .single();
  
  if (!user) return;
  
  // Log that refresh was skipped (could be used for analytics)
  console.log(`[REFRESH] User ${userId} skipped refresh for subskill ${subskillId}`);
  
  // Optionally track skip behavior for future personalization
  // For now, just continue - the user will proceed to the lesson
}

// ─────────────────────────────────────────────────────────────────────────────────
// COMPLETE REFRESH
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Mark refresh as completed
 */
export async function completeRefresh(
  userId: string,
  subskillId: string
): Promise<void> {
  const supabase = getSupabase();
  
  // Get user's internal ID
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('external_id', userId)
    .single();
  
  if (!user) return;
  
  console.log(`[REFRESH] User ${userId} completed refresh for subskill ${subskillId}`);
  
  // Update last session date to reset the gap counter
  // The actual session start will update this again, but this ensures
  // the refresh counts as engagement
  await supabase
    .from('plan_subskills')
    .update({
      last_session_date: new Date().toISOString(),
    })
    .eq('id', subskillId);
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const RefreshHandler = {
  check: checkNeedsRefresh,
  generate: generateRefreshContent,
  skip: skipRefresh,
  complete: completeRefresh,
  GAP_DAYS: REFRESH_GAP_DAYS,
};
