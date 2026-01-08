// ═══════════════════════════════════════════════════════════════════════════════
// LESSON DESIGNER v3 - SIMPLIFIED
// Flow: Exploration → Define Goal → Review → Create Plan
// No Research, Node Gen, Sequencing, or Method Nodes
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// LOCAL IMPORTS
// ─────────────────────────────────────────────────────────────────────────────────

import type { 
  DesignerSession, 
  LessonPlan, 
  Subskill, 
  Route, 
  RouteStatus,
  ReviewPreview,
  RoutingData,
  SubskillsData,
  PlanSubskill,
} from '../types.js';
import { mapPlanSubskill } from '../types.js';
import { getSupabase, isSupabaseInitialized } from '../../../db/index.js';

// Session imports
import {
  DesignerSessionManager,
  getActiveSession,
  getSessionById,
  startSession,
  updateSessionPhase,
  updatePhaseData,
  linkSessionToPlan,
  completeSession,
  cancelSession,
  isValidPhaseTransition,
  getNextInternalPhase,
  getPhaseRequirements,
  canProceedToPhase,
  getVisiblePhaseInfo,
} from './session.js';

// Phase imports (only what we need)
import { generateCapstone, CapstoneGenerator, refineCapstone, validateCapstoneStatement, validateSuccessCriteria } from './capstone.js';
import { generateSubskills, SubskillsGenerator, validateSubskills, getTypeDistribution } from './subskills.js';
import { assignRoutes, RouteAssigner, getRouteForSubskill, analyzeRouteDistribution, getBalanceRecommendations, getRouteInfo, ROUTE_INFO } from './routing.js';

// LLM imports for session distribution
import { SwordGateLLM } from '../llm/swordgate-llm.js';
import {
  SESSION_DISTRIBUTION_SYSTEM_PROMPT,
  buildSessionDistributionUserMessage,
  parseLLMJson,
  type SessionDistributionOutput,
} from '../llm/prompts/define-goal.js';

// ─────────────────────────────────────────────────────────────────────────────────
// RE-EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

// Session Management
export {
  DesignerSessionManager,
  getActiveSession,
  getSessionById,
  startSession,
  updateSessionPhase,
  updatePhaseData,
  linkSessionToPlan,
  completeSession,
  cancelSession,
  isValidPhaseTransition,
  getNextInternalPhase,
  getPhaseRequirements,
  canProceedToPhase,
  getVisiblePhaseInfo,
};

// Phase 2a: Capstone
export {
  CapstoneGenerator,
  generateCapstone,
  refineCapstone,
  validateCapstoneStatement,
  validateSuccessCriteria,
};

// Phase 2b: Subskills
export {
  SubskillsGenerator,
  generateSubskills,
  validateSubskills,
  getTypeDistribution,
};

// Phase 2c: Routing
export {
  RouteAssigner,
  getRouteForSubskill,
  assignRoutes,
  analyzeRouteDistribution,
  getBalanceRecommendations,
  getRouteInfo,
  ROUTE_INFO,
};

// ─────────────────────────────────────────────────────────────────────────────────
// TIME ESTIMATE PARSING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Parse LLM time estimate string into structured data
 * Examples:
 *   "6 weeks at 1 hour per day" → { weeks: 6, dailyMinutes: 60 }
 *   "4 weeks at 30 minutes per day" → { weeks: 4, dailyMinutes: 30 }
 *   "2 months at 45 minutes per day" → { weeks: 8, dailyMinutes: 45 }
 * 
 * NOTE: Daily minutes are clamped to 90 min max to prevent unrealistic plans
 */
export function parseTimeEstimate(estimatedTime: string): { 
  weeks: number; 
  dailyMinutes: number;
  totalSessions: number;
  daysPerWeek: number;
} {
  const lower = estimatedTime.toLowerCase();
  
  // Default values
  let weeks = 4;
  let dailyMinutes = 30;
  const daysPerWeek = 5; // Assume 5 days/week
  const MAX_DAILY_MINUTES = 90; // Hard cap at 1.5 hours
  
  // Parse weeks/months
  const weeksMatch = lower.match(/(\d+)\s*weeks?/);
  const monthsMatch = lower.match(/(\d+)\s*months?/);
  
  if (weeksMatch) {
    weeks = parseInt(weeksMatch[1] ?? '0', 10);
  } else if (monthsMatch) {
    weeks = parseInt(monthsMatch[1] ?? '0', 10) * 4; // 4 weeks per month
  }
  
  // Parse daily time
  const hourMatch = lower.match(/(\d+)\s*hours?/);
  const minuteMatch = lower.match(/(\d+)\s*minutes?/);
  
  if (hourMatch) {
    dailyMinutes = parseInt(hourMatch[1] ?? '0', 10) * 60;
  }
  if (minuteMatch) {
    // If both hour and minute, add them
    if (hourMatch) {
      dailyMinutes += parseInt(minuteMatch[1] ?? '0', 10);
    } else {
      dailyMinutes = parseInt(minuteMatch[1] ?? '0', 10);
    }
  }
  
  // Clamp daily minutes to max 90 (1.5 hours)
  if (dailyMinutes > MAX_DAILY_MINUTES) {
    console.warn(`[SESSION_DIST] Daily minutes ${dailyMinutes} exceeds max ${MAX_DAILY_MINUTES}, clamping`);
    dailyMinutes = MAX_DAILY_MINUTES;
  }
  
  // Ensure minimum of 15 minutes
  if (dailyMinutes < 15) {
    console.warn(`[SESSION_DIST] Daily minutes ${dailyMinutes} below minimum 15, setting to 15`);
    dailyMinutes = 15;
  }
  
  // Calculate total sessions
  const totalSessions = weeks * daysPerWeek;
  
  console.log(`[SESSION_DIST] Parsed "${estimatedTime}" → ${weeks} weeks, ${dailyMinutes} min/day, ${totalSessions} sessions`);
  
  return { weeks, dailyMinutes, totalSessions, daysPerWeek };
}

// ─────────────────────────────────────────────────────────────────────────────────
// SESSION DISTRIBUTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Distribute sessions across subskills using LLM
 */
export async function distributeSessionsWithLLM(
  totalSessions: number,
  capstoneTitle: string,
  estimatedTime: string,
  subskills: Array<{
    id: string;
    title: string;
    route: Route;
    complexity: 1 | 2 | 3;
    status: RouteStatus;
  }>
): Promise<Map<string, number>> {
  console.log(`[SESSION_DIST] Distributing ${totalSessions} sessions across ${subskills.length} subskills`);
  
  // Filter out skipped for LLM - only distribute among active subskills
  const activeSubskills = subskills.filter(s => s.status !== 'skip');
  const skippedSubskills = subskills.filter(s => s.status === 'skip');
  
  console.log(`[SESSION_DIST] Active: ${activeSubskills.length}, Skipped: ${skippedSubskills.length}`);
  
  const userMessage = buildSessionDistributionUserMessage({
    totalSessions,
    capstoneTitle,
    estimatedTime,
    subskills: activeSubskills,  // Only send active subskills to LLM
  });
  
  const result = new Map<string, number>();
  
  // Set skipped to 0 first
  for (const s of skippedSubskills) {
    result.set(s.id, 0);
  }
  
  try {
    const response = await SwordGateLLM.generate(
      SESSION_DISTRIBUTION_SYSTEM_PROMPT,
      userMessage,
      { thinkingLevel: 'high' }
    );
    
    const parsed = parseLLMJson<SessionDistributionOutput>(response);
    
    // Validate total matches
    const sum = parsed.distributions.reduce((acc, d) => acc + d.sessions, 0);
    if (sum !== totalSessions) {
      console.warn(`[SESSION_DIST] LLM total ${sum} doesn't match expected ${totalSessions}, adjusting...`);
      // Adjust proportionally
      const factor = totalSessions / sum;
      let adjusted = 0;
      parsed.distributions.forEach((d, i) => {
        if (i === parsed.distributions.length - 1) {
          // Last one gets the remainder
          d.sessions = totalSessions - adjusted;
        } else {
          d.sessions = Math.max(1, Math.round(d.sessions * factor));
          adjusted += d.sessions;
        }
      });
    }
    
    // Add LLM distributions to result
    for (const d of parsed.distributions) {
      result.set(d.subskillId, d.sessions);
    }
    
    console.log(`[SESSION_DIST] Distributed: ${[...result.entries()].map(([id, s]) => `${id}:${s}`).join(', ')}`);
    
    return result;
  } catch (error) {
    console.error('[SESSION_DIST] LLM failed, using fallback distribution:', error);
    return distributeSessionsFallback(totalSessions, subskills);
  }
}

/**
 * Fallback session distribution when LLM fails
 */
function distributeSessionsFallback(
  totalSessions: number,
  subskills: Array<{
    id: string;
    route: Route;
    complexity: 1 | 2 | 3;
    status: RouteStatus;
  }>
): Map<string, number> {
  const result = new Map<string, number>();
  
  // Filter out skipped
  const active = subskills.filter(s => s.status !== 'skip');
  
  if (active.length === 0) {
    return result;
  }
  
  // Simple even distribution with complexity weighting
  const totalWeight = active.reduce((acc, s) => acc + s.complexity, 0);
  let remaining = totalSessions;
  
  active.forEach((s, i) => {
    if (i === active.length - 1) {
      // Last one gets remainder
      result.set(s.id, Math.max(1, remaining));
    } else {
      const sessions = Math.max(1, Math.round((s.complexity / totalWeight) * totalSessions));
      result.set(s.id, sessions);
      remaining -= sessions;
    }
  });
  
  // Set skipped to 0
  subskills.filter(s => s.status === 'skip').forEach(s => {
    result.set(s.id, 0);
  });
  
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────────
// DEFINE GOAL PHASE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Run the "Define Goal" phase (user phase 2)
 * Covers internal phases: capstone, subskills, routing
 */
async function runDefineGoalPhase(
  sessionId: string,
  _explorationData?: {
    topic?: string;
    goal?: string;
    context?: string;
  }
): Promise<DesignerSession> {
  // Fetch the session first
  let session = await getSessionById(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  // 1. Generate capstone from exploration
  await generateCapstone(session);
  
  // Refresh session after update
  session = await getSessionById(sessionId);
  if (!session) {
    throw new Error('Session not found after capstone');
  }

  // 2. Decompose into subskills
  await generateSubskills(session);
  
  // Refresh session after update
  session = await getSessionById(sessionId);
  if (!session) {
    throw new Error('Session not found after subskills');
  }

  // 3. Assign routes
  await assignRoutes(session);
  
  // Return final session state
  const finalSession = await getSessionById(sessionId);
  if (!finalSession) {
    throw new Error('Session not found after routing');
  }

  return finalSession;
}

// ─────────────────────────────────────────────────────────────────────────────────
// REVIEW PHASE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get review preview - shows what will be created
 * Now includes LLM-distributed sessions per subskill
 * Caches distribution in session for reuse during plan creation
 */
async function getReviewPreview(sessionId: string): Promise<ReviewPreview> {
  const session = await getSessionById(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  if (!session.capstoneData) {
    throw new Error('Capstone data required');
  }

  if (!session.subskillsData || session.subskillsData.subskills.length === 0) {
    throw new Error('Subskills required');
  }

  if (!session.routingData || session.routingData.assignments.length === 0) {
    throw new Error('Routing required');
  }

  const { capstoneData, subskillsData, routingData } = session;

  // Parse time estimate to get total sessions
  const timeEstimate = parseTimeEstimate(capstoneData.estimatedTime || '4 weeks at 30 minutes per day');
  
  // Check if we already have cached distribution in subskills
  const hasCachedDistribution = subskillsData.subskills.some(s => s.estimatedSessions !== undefined);
  
  let sessionDistribution: Map<string, number>;
  
  if (hasCachedDistribution) {
    // Use cached distribution
    console.log('[SESSION_DIST] Using cached distribution from session');
    sessionDistribution = new Map(
      subskillsData.subskills.map(s => [s.id, s.estimatedSessions || 1])
    );
  } else {
    // Generate new distribution
    const subskillsForDistribution = subskillsData.subskills.map(s => {
      const assignment = routingData.assignments.find(a => a.subskillId === s.id);
      return {
        id: s.id,
        title: s.title,
        route: (assignment?.route || 'practice') as Route,
        complexity: s.estimatedComplexity as 1 | 2 | 3,
        status: (assignment?.status || 'learn') as RouteStatus,
      };
    });
    
    sessionDistribution = await distributeSessionsWithLLM(
      timeEstimate.totalSessions,
      capstoneData.title,
      capstoneData.estimatedTime || '4 weeks at 30 minutes per day',
      subskillsForDistribution
    );
    
    // Cache distribution in session by updating subskills with estimatedSessions
    const updatedSubskills = subskillsData.subskills.map(s => ({
      ...s,
      estimatedSessions: sessionDistribution.get(s.id) || 1,
    }));
    
    // Save back to session
    await updatePhaseData(sessionId, 'subskills', {
      ...subskillsData,
      subskills: updatedSubskills,
    });
    
    console.log('[SESSION_DIST] Cached distribution in session');
  }

  // Merge subskills with routing AND session distribution
  const subskillsWithRouting = subskillsData.subskills.map(s => {
    const assignment = routingData.assignments.find(a => a.subskillId === s.id);
    const sessions = sessionDistribution.get(s.id) || 1;
    return {
      id: s.id,
      title: s.title,
      description: s.description,
      subskillType: s.subskillType,
      complexity: s.estimatedComplexity,
      order: s.order,
      route: assignment?.route || 'practice' as Route,
      status: assignment?.status || 'learn' as RouteStatus,
      reason: assignment?.reason,
      estimatedSessions: sessions,  // NEW: sessions per subskill
    };
  });

  // Calculate stats
  let toLearn = 0, toSkip = 0, toAssess = 0;
  for (const a of routingData.assignments) {
    if (a.status === 'learn') toLearn++;
    else if (a.status === 'skip') toSkip++;
    else if (a.status === 'assess') toAssess++;
  }

  return {
    capstone: {
      title: capstoneData.title,
      statement: capstoneData.capstoneStatement,
      successCriteria: capstoneData.successCriteria,
      estimatedTime: capstoneData.estimatedTime,
    },
    subskills: subskillsWithRouting,
    stats: {
      totalSubskills: subskillsData.subskills.length,
      toLearn,
      toSkip,
      toAssess,
      estimatedSessions: timeEstimate.totalSessions,
      estimatedWeeks: timeEstimate.weeks,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// CREATE PLAN (Simplified - uses subskills directly)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a lesson plan from completed session
 * Saves subskills directly to plan_subskills table with session distribution
 * Uses cached distribution from Review phase (no duplicate LLM call)
 */
async function createPlanFromSession(sessionId: string): Promise<LessonPlan> {
  if (!isSupabaseInitialized()) {
    throw new Error('Database not initialized');
  }

  const session = await getSessionById(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  // Verify required data
  if (!session.capstoneData) {
    throw new Error('Capstone data required');
  }

  if (!session.subskillsData || session.subskillsData.subskills.length === 0) {
    throw new Error('Subskills required');
  }

  if (!session.routingData || session.routingData.assignments.length === 0) {
    throw new Error('Routing required');
  }

  const supabase = getSupabase();
  const { capstoneData, subskillsData, routingData } = session;
  
  // Parse time estimate
  const timeEstimate = parseTimeEstimate(capstoneData.estimatedTime || '4 weeks at 30 minutes per day');
  
  // Check if distribution is cached in session (from Review phase)
  const hasCachedDistribution = subskillsData.subskills.some(s => s.estimatedSessions !== undefined);
  
  let sessionDistribution: Map<string, number>;
  
  if (hasCachedDistribution) {
    // Use cached distribution from Review phase
    console.log('[DESIGNER] Using cached session distribution from Review');
    sessionDistribution = new Map(
      subskillsData.subskills.map(s => [s.id, s.estimatedSessions || 1])
    );
  } else {
    // Fallback: generate distribution (shouldn't happen if Review was called first)
    console.log('[DESIGNER] No cached distribution, generating new one');
    const subskillsForDistribution = subskillsData.subskills.map(s => {
      const assignment = routingData.assignments.find(a => a.subskillId === s.id);
      return {
        id: s.id,
        title: s.title,
        route: (assignment?.route || 'practice') as Route,
        complexity: s.estimatedComplexity as 1 | 2 | 3,
        status: (assignment?.status || 'learn') as RouteStatus,
      };
    });
    
    sessionDistribution = await distributeSessionsWithLLM(
      timeEstimate.totalSessions,
      capstoneData.title,
      capstoneData.estimatedTime || '4 weeks at 30 minutes per day',
      subskillsForDistribution
    );
  }

  // Count non-skipped subskills
  const nonSkipped = routingData.assignments.filter(a => a.status !== 'skip').length;

  // Create plan with new fields
  const { data: plan, error: planError } = await supabase
    .from('lesson_plans')
    .insert({
      user_id: session.userId,
      title: capstoneData.title,
      capstone_statement: capstoneData.capstoneStatement,
      success_criteria: capstoneData.successCriteria || [],
      difficulty: 'intermediate',
      daily_minutes: timeEstimate.dailyMinutes,
      weekly_cadence: timeEstimate.daysPerWeek,
      total_subskills: nonSkipped,
      estimated_sessions: timeEstimate.totalSessions,
      estimated_weeks: timeEstimate.weeks,
      estimated_time_display: capstoneData.estimatedTime,  // NEW: Store LLM's human-readable string
      status: 'active',
      progress: 0,
      sessions_completed: 0,
      current_subskill_index: 0,
    } as any)
    .select()
    .single();

  if (planError) {
    console.error('[DESIGNER] Failed to create plan:', planError);
    throw new Error(`Failed to create plan: ${planError.message}`);
  }

  console.log('[DESIGNER] Created plan:', plan.id);

  // Create plan_subskills records with session distribution
  const subskillInserts = subskillsData.subskills.map(s => {
    const assignment = routingData.assignments.find(a => a.subskillId === s.id);
    const routeStatus = assignment?.status || 'learn';
    const estimatedSessions = sessionDistribution.get(s.id) || 1;
    
    // Map RouteStatus to SubskillStatus
    let status: string;
    if (routeStatus === 'skip') {
      status = 'skipped';
    } else if (routeStatus === 'assess') {
      status = 'assess';
    } else {
      status = 'pending';
    }

    return {
      plan_id: plan.id,
      title: s.title,
      description: s.description,
      subskill_type: s.subskillType,
      route: assignment?.route || 'practice',
      complexity: s.estimatedComplexity,
      order: s.order,
      status,
      estimated_sessions: estimatedSessions,  // NEW: Sessions per subskill
      sessions_completed: 0,
    };
  });

  if (subskillInserts.length > 0) {
    const { error: subskillsError } = await supabase
      .from('plan_subskills')
      .insert(subskillInserts as any);

    if (subskillsError) {
      console.error('[DESIGNER] Failed to create subskills:', subskillsError);
      throw new Error(`Failed to create subskills: ${subskillsError.message}`);
    }

    console.log('[DESIGNER] Created', subskillInserts.length, 'subskills with session distribution');

    // Mark first non-skipped subskill as 'active'
    const { data: firstSubskill } = await supabase
      .from('plan_subskills')
      .select('id')
      .eq('plan_id', plan.id)
      .neq('status', 'skipped')
      .order('order', { ascending: true })
      .limit(1)
      .single();

    if (firstSubskill) {
      await supabase
        .from('plan_subskills')
        .update({ status: 'active' })
        .eq('id', firstSubskill.id);
      
      console.log('[DESIGNER] Marked first subskill as active:', firstSubskill.id);
    }
  }

  // Link session to plan and complete it
  await linkSessionToPlan(sessionId, plan.id);
  await completeSession(sessionId);

  console.log('[DESIGNER] Plan creation complete');

  return {
    id: plan.id,
    userId: session.userId,
    title: plan.title,
    description: plan.description || undefined,
    capstoneStatement: plan.capstone_statement || undefined,
    successCriteria: plan.success_criteria || [],
    difficulty: plan.difficulty || 'intermediate',
    dailyMinutes: plan.daily_minutes || 30,
    weeklyCadence: plan.weekly_cadence || 5,
    totalSubskills: nonSkipped,
    estimatedSessions: timeEstimate.totalSessions,
    estimatedWeeks: timeEstimate.weeks,
    estimatedTimeDisplay: capstoneData.estimatedTime,  // NEW
    status: 'active',
    progress: 0,
    sessionsCompleted: 0,
    currentSubskillIndex: 0,
    createdAt: new Date(plan.created_at),
    // Required by LessonPlan type
    totalNodes: nonSkipped,
    totalSessions: timeEstimate.totalSessions,
    sessionsSinceMethodNode: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get subskills for a plan
 */
async function getPlanSubskills(planId: string): Promise<PlanSubskill[]> {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('plan_subskills')
    .select('*')
    .eq('plan_id', planId)
    .order('order', { ascending: true });
  
  if (error) throw new Error(`Failed to get subskills: ${error.message}`);
  
  return (data || []).map(mapPlanSubskill);
}

export const LessonDesigner = {
  // Session
  getActiveSession,
  startSession,
  cancelSession,
  
  // Define Goal
  runDefineGoal: runDefineGoalPhase,
  
  // Review
  getReviewPreview,
  
  // Create
  createPlan: createPlanFromSession,
  
  // Plans
  getPlanSubskills,
  
  // Utilities (NEW)
  parseTimeEstimate,
  distributeSessionsWithLLM,
};
