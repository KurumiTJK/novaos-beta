// ═══════════════════════════════════════════════════════════════════════════════
// LESSON RUNNER - MAIN API
// Public interface for the subskill-based learning system
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────────

import { getSupabase, isSupabaseInitialized } from '../../../db/index.js';
import { mapLessonPlan, mapPlanSubskill } from '../types.js';
import type { LessonPlan, LessonPlanRow, PlanSubskill } from '../types.js';

import { SubskillRouter } from './router/index.js';
import { AssessmentHandler } from './router/assess.js';
import { LessonPlanGenerator } from './lesson-plan/generator.js';
import { DailyLessonGenerator } from './daily-lesson/generator.js';
import { KnowledgeCheckHandler } from './knowledge-check/handler.js';
import { ResourcesFetcher } from './resources/fetcher.js';
import { ProgressTracker } from './progress/tracker.js';
import { RefreshHandler } from './refresh/handler.js';

import type {
  TodayState,
  StartSubskillResult,
  AssessmentResult,
  StartSessionResult,
  CompleteSessionResult,
  KnowledgeCheckResult,
  RefreshContent,
  SubmitAssessmentInput,
  SubmitKnowledgeCheckInput,
  SubskillLessonPlan,
  DailyLesson,
  KnowledgeCheck,
  SubskillAssessment,
  SessionSummary,
  RunnerStats,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// USER ID HELPER
// ─────────────────────────────────────────────────────────────────────────────────

async function getInternalUserId(externalId: string): Promise<string | null> {
  if (!isSupabaseInitialized()) return null;

  const supabase = getSupabase();
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('external_id', externalId)
    .single();

  return existing?.id || null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN LESSON RUNNER CLASS
// ─────────────────────────────────────────────────────────────────────────────────

export class LessonRunner {
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // TODAY STATE
  // ═══════════════════════════════════════════════════════════════════════════════
  
  /**
   * Get today's learning state
   * Returns current plan, subskill, session info, and progress
   */
  static async getToday(userId: string): Promise<TodayState | null> {
    return ProgressTracker.getToday(userId);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // STATS
  // ═══════════════════════════════════════════════════════════════════════════════
  
  /**
   * Get learning statistics for a user
   */
  static async getStats(userId: string): Promise<RunnerStats> {
    if (!isSupabaseInitialized()) {
      return getEmptyStats();
    }

    const internalUserId = await getInternalUserId(userId);
    if (!internalUserId) {
      return getEmptyStats();
    }

    const supabase = getSupabase();

    // Get plan counts
    const { count: totalPlans } = await supabase
      .from('lesson_plans')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', internalUserId);

    const { count: activePlans } = await supabase
      .from('lesson_plans')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', internalUserId)
      .eq('status', 'active');

    // Get subskill counts
    const { data: plans } = await supabase
      .from('lesson_plans')
      .select('id')
      .eq('user_id', internalUserId);

    const planIds = (plans || []).map(p => p.id);

    let subskillsCompleted = 0;
    let subskillsTotal = 0;
    let subskillsInProgress = 0;

    if (planIds.length > 0) {
      const { count: total } = await supabase
        .from('plan_subskills')
        .select('*', { count: 'exact', head: true })
        .in('plan_id', planIds);
      subskillsTotal = total || 0;

      const { count: completed } = await supabase
        .from('plan_subskills')
        .select('*', { count: 'exact', head: true })
        .in('plan_id', planIds)
        .in('status', ['mastered', 'skipped']);
      subskillsCompleted = completed || 0;

      const { count: inProgress } = await supabase
        .from('plan_subskills')
        .select('*', { count: 'exact', head: true })
        .in('plan_id', planIds)
        .eq('status', 'active');
      subskillsInProgress = inProgress || 0;
    }

    // Get session counts
    const { count: sessionsTotal } = await supabase
      .from('daily_lessons')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', internalUserId)
      .not('completed_at', 'is', null);

    // Sessions this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { count: sessionsWeek } = await supabase
      .from('daily_lessons')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', internalUserId)
      .not('completed_at', 'is', null)
      .gte('completed_at', weekAgo.toISOString());

    // Knowledge checks
    const { count: kcPassed } = await supabase
      .from('knowledge_checks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', internalUserId)
      .eq('passed', true);

    const { count: kcFailed } = await supabase
      .from('knowledge_checks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', internalUserId)
      .eq('passed', false);

    // Average score
    const { data: scores } = await supabase
      .from('knowledge_checks')
      .select('score')
      .eq('user_id', internalUserId)
      .not('score', 'is', null);

    const avgScore = scores && scores.length > 0
      ? scores.reduce((sum, s) => sum + (s.score || 0), 0) / scores.length
      : 0;

    // Estimate time (30 min per session default)
    const totalMinutes = (sessionsTotal || 0) * 30;
    const avgMinutes = sessionsTotal && sessionsTotal > 0 ? totalMinutes / sessionsTotal : 0;

    // TODO: Calculate streaks properly
    const currentStreak = 0;
    const longestStreak = 0;

    return {
      totalPlans: totalPlans || 0,
      activePlan: (activePlans || 0) > 0,
      subskillsCompleted,
      subskillsTotal,
      subskillsInProgress,
      sessionsCompletedTotal: sessionsTotal || 0,
      sessionsCompletedThisWeek: sessionsWeek || 0,
      currentStreak,
      longestStreak,
      totalMinutesLearned: totalMinutes,
      averageSessionMinutes: avgMinutes,
      knowledgeChecksPassed: kcPassed || 0,
      knowledgeChecksFailed: kcFailed || 0,
      averageScore: Math.round(avgScore),
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // SUBSKILL MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════════
  
  /**
   * Start a subskill - routes to skip/assess/learn flow
   */
  static async startSubskill(
    userId: string,
    subskillId: string
  ): Promise<StartSubskillResult> {
    return SubskillRouter.start(userId, subskillId);
  }
  
  /**
   * Get current subskill for a plan
   */
  static async getCurrentSubskill(planId: string): Promise<PlanSubskill | null> {
    return SubskillRouter.getCurrent(planId);
  }
  
  /**
   * Get subskill by ID
   */
  static async getSubskill(subskillId: string): Promise<PlanSubskill | null> {
    return SubskillRouter.getById(subskillId);
  }
  
  /**
   * Get all subskills for a plan
   */
  static async getAllSubskills(planId: string): Promise<PlanSubskill[]> {
    return SubskillRouter.getAll(planId);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // ASSESSMENT (Diagnostic)
  // ═══════════════════════════════════════════════════════════════════════════════
  
  /**
   * Get diagnostic test for an assess-status subskill
   */
  static async getDiagnostic(
    userId: string,
    subskillId: string
  ): Promise<SubskillAssessment> {
    const result = await SubskillRouter.start(userId, subskillId);
    if (result.routeType !== 'assess' || !result.assessment) {
      throw new Error('Subskill is not in assess status');
    }
    return result.assessment;
  }
  
  /**
   * Submit diagnostic assessment answers
   */
  static async submitDiagnostic(
    userId: string,
    input: SubmitAssessmentInput
  ): Promise<AssessmentResult> {
    return AssessmentHandler.submit(userId, input.assessmentId, input.answers);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // DAILY LESSONS
  // ═══════════════════════════════════════════════════════════════════════════════
  
  /**
   * Start a learning session (generates or retrieves daily lesson)
   */
  static async startSession(
    userId: string,
    subskillId: string
  ): Promise<StartSessionResult> {
    return DailyLessonGenerator.start(userId, subskillId);
  }
  
  /**
   * Get a specific session (cached)
   */
  static async getSession(
    userId: string,
    subskillId: string,
    sessionNumber: number
  ): Promise<DailyLesson | null> {
    return DailyLessonGenerator.get(userId, subskillId, sessionNumber);
  }
  
  /**
   * Regenerate a session (explicit user request)
   */
  static async regenerateSession(
    userId: string,
    subskillId: string,
    sessionNumber: number
  ): Promise<DailyLesson> {
    return DailyLessonGenerator.regenerate(userId, subskillId, sessionNumber);
  }
  
  /**
   * Complete a session
   */
  static async completeSession(
    userId: string,
    dailyLessonId: string
  ): Promise<CompleteSessionResult> {
    const result = await DailyLessonGenerator.complete(userId, dailyLessonId);
    
    let nextSubskill: PlanSubskill | undefined;
    
    if (result.isComplete && !result.isKnowledgeCheckNext) {
      nextSubskill = await SubskillRouter.getNext(
        result.subskill.planId,
        result.subskill.order
      ) || undefined;
    }
    
    const todayState = await ProgressTracker.getToday(userId);
    const isPlanComplete = !todayState;
    
    return {
      subskill: result.subskill,
      sessionCompleted: result.sessionCompleted,
      totalSessions: result.totalSessions,
      isSubskillComplete: result.isComplete,
      isKnowledgeCheckNext: result.isKnowledgeCheckNext,
      isPlanComplete,
      nextSubskill,
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // KNOWLEDGE CHECK (Mastery Gate)
  // ═══════════════════════════════════════════════════════════════════════════════
  
  /**
   * Get knowledge check for a subskill (final session)
   */
  static async getKnowledgeCheck(
    userId: string,
    subskillId: string
  ): Promise<KnowledgeCheck> {
    return KnowledgeCheckHandler.get(userId, subskillId);
  }
  
  /**
   * Submit knowledge check answers
   */
  static async submitKnowledgeCheck(
    userId: string,
    input: SubmitKnowledgeCheckInput
  ): Promise<KnowledgeCheckResult> {
    return KnowledgeCheckHandler.submit(userId, input.checkId, input.answers);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // RESOURCES
  // ═══════════════════════════════════════════════════════════════════════════════
  
  /**
   * Refresh resources for a daily lesson
   */
  static async refreshResources(
    dailyLessonId: string,
    subskill: PlanSubskill,
    plan: LessonPlan
  ): Promise<void> {
    await ResourcesFetcher.refresh(dailyLessonId, subskill, plan);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // REFRESH (Gap Detection)
  // ═══════════════════════════════════════════════════════════════════════════════
  
  /**
   * Check if subskill needs refresh (7+ day gap)
   */
  static async checkNeedsRefresh(
    userId: string,
    subskillId: string
  ): Promise<{ needsRefresh: boolean; gapDays: number }> {
    return RefreshHandler.check(userId, subskillId);
  }
  
  /**
   * Generate refresh content for a subskill
   */
  static async getRefreshContent(
    userId: string,
    subskillId: string
  ): Promise<RefreshContent> {
    return RefreshHandler.generate(userId, subskillId);
  }
  
  /**
   * Skip refresh and continue
   */
  static async skipRefresh(
    userId: string,
    subskillId: string
  ): Promise<void> {
    return RefreshHandler.skip(userId, subskillId);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // PROGRESS
  // ═══════════════════════════════════════════════════════════════════════════════
  
  /**
   * Get subskill progress
   */
  static async getSubskillProgress(
    userId: string,
    subskillId: string
  ): Promise<{
    subskill: PlanSubskill;
    sessionsCompleted: number;
    totalSessions: number;
    progress: number;
    summaries: SessionSummary[];
  }> {
    return ProgressTracker.getSubskill(userId, subskillId);
  }
  
  /**
   * Get overall plan progress
   */
  static async getPlanProgress(
    userId: string,
    planId: string
  ): Promise<{
    plan: LessonPlan;
    subskills: Array<{ subskill: PlanSubskill; progress: number }>;
    overallProgress: number;
    completedCount: number;
    totalCount: number;
  }> {
    return ProgressTracker.getPlan(userId, planId);
  }
  
  /**
   * Get session history for a subskill
   */
  static async getSessionHistory(
    userId: string,
    subskillId: string
  ): Promise<SessionSummary[]> {
    return ProgressTracker.getHistory(userId, subskillId);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // LESSON PLAN (Direct Access)
  // ═══════════════════════════════════════════════════════════════════════════════
  
  /**
   * Get lesson plan for a subskill
   */
  static async getLessonPlan(subskillId: string): Promise<SubskillLessonPlan | null> {
    return LessonPlanGenerator.get(subskillId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

function getEmptyStats(): RunnerStats {
  return {
    totalPlans: 0,
    activePlan: false,
    subskillsCompleted: 0,
    subskillsTotal: 0,
    subskillsInProgress: 0,
    sessionsCompletedTotal: 0,
    sessionsCompletedThisWeek: 0,
    currentStreak: 0,
    longestStreak: 0,
    totalMinutesLearned: 0,
    averageSessionMinutes: 0,
    knowledgeChecksPassed: 0,
    knowledgeChecksFailed: 0,
    averageScore: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export type {
  // Main types
  TodayState,
  StartSubskillResult,
  AssessmentResult,
  StartSessionResult,
  CompleteSessionResult,
  KnowledgeCheckResult,
  RefreshContent,
  RunnerStats,
  
  // Input types
  SubmitAssessmentInput,
  SubmitKnowledgeCheckInput,
  
  // Entity types
  SubskillLessonPlan,
  DailyLesson,
  KnowledgeCheck,
  SubskillAssessment,
  SessionSummary,
  
  // Supporting types
  SubskillRouteType,
  AssessmentRecommendation,
  DiagnosticQuestion,
  KnowledgeCheckQuestion,
  UserAnswer,
  MissedQuestion,
  Gap,
  AreaResult,
  SessionOutline,
  LessonSection,
  Activity,
  DailyLessonResources,
  DailyLessonContext,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// INDIVIDUAL HANDLER EXPORTS (for advanced use)
// ─────────────────────────────────────────────────────────────────────────────────

export {
  SubskillRouter,
  AssessmentHandler,
  LessonPlanGenerator,
  DailyLessonGenerator,
  KnowledgeCheckHandler,
  ResourcesFetcher,
  ProgressTracker,
  RefreshHandler,
};
