// ═══════════════════════════════════════════════════════════════════════════════
// PRACTICE ORCHESTRATOR — Unified Daily Practice Coordination
// NovaOS Deliberate Practice Engine — Phase 18: SparkEngine Integration
// ═══════════════════════════════════════════════════════════════════════════════
//
// Coordinates daily practice flow between Deliberate Practice and SparkEngine:
//
// Daily Flow:
//   1. Morning: Generate drill → create spark → schedule reminders
//   2. Reminders: Send at configured intervals with escalation
//   3. Completion: Record outcome → update mastery → trigger next drill
//   4. Evening: Reconcile missed drills → roll-forward for tomorrow
//
// This is the main entry point for daily practice operations.
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { AsyncAppResult } from '../../types/result.js';
import { ok, err, appError, isOk } from '../../types/result.js';
import type {
  UserId,
  GoalId,
  DrillId,
  SparkId,
  Timestamp,
} from '../../types/branded.js';
import { createTimestamp } from '../../types/branded.js';
import type { Goal } from '../spark-engine/types.js';
import type { ISparkEngineStore } from '../spark-engine/interfaces.js';
import type {
  DailyDrill,
  Skill,
  WeekPlan,
  DrillOutcome,
} from './types.js';
import type {
  IDeliberatePracticeEngine,
  TodayPracticeResult,
  GoalProgress,
} from './interfaces.js';
import type { DrillSpark, DrillSparkCompletionResult } from './spark-integration-types.js';
import type { SparkIntegration } from './spark-integration.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Complete today's practice bundle.
 */
export interface TodayPracticeBundle {
  /** Whether there is content for today */
  readonly hasContent: boolean;

  /** Today's date */
  readonly date: string;

  /** The drill for today */
  readonly drill: DailyDrill | null;

  /** The spark for the drill */
  readonly spark: DrillSpark | null;

  /** The skill being practiced */
  readonly skill: Skill | null;

  /** Current week plan */
  readonly weekPlan: WeekPlan | null;

  /** Goal this practice belongs to */
  readonly goal: Goal | null;

  /** Continuation context from previous drill */
  readonly context: string | null;

  /** Whether this is a retry of a previous drill */
  readonly isRetry: boolean;

  /** Number of times this skill has been retried */
  readonly retryCount: number;

  /** Pass signal to achieve */
  readonly passSignal: string | null;

  /** Active constraint */
  readonly constraint: string | null;
}

/**
 * Result of completing today's practice.
 */
export interface PracticeCompletionResult {
  /** Drill ID */
  readonly drillId: DrillId;

  /** Spark ID */
  readonly sparkId: SparkId;

  /** Outcome */
  readonly outcome: DrillOutcome;

  /** Whether pass signal was met */
  readonly passSignalMet: boolean;

  /** User observation */
  readonly observation?: string;

  /** Whether to repeat tomorrow */
  readonly repeatTomorrow: boolean;

  /** Next skill to practice (if advancing) */
  readonly nextSkillId?: string;

  /** Updated mastery level */
  readonly newMastery?: string;

  /** Encouragement message */
  readonly message: string;
}

/**
 * Daily reconciliation result.
 */
export interface ReconciliationResult {
  /** Drills that were missed */
  readonly missedDrills: readonly DrillId[];

  /** Drills carried forward to tomorrow */
  readonly carriedForward: readonly DrillId[];

  /** Total missed count */
  readonly missedCount: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRACTICE ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Configuration for PracticeOrchestrator.
 */
export interface PracticeOrchestratorConfig {
  /** User's timezone */
  timezone?: string;
  /** Daily time budget in minutes */
  dailyMinutes?: number;
}

/**
 * Dependencies for PracticeOrchestrator.
 */
export interface PracticeOrchestratorDependencies {
  /** Deliberate Practice Engine */
  practiceEngine: IDeliberatePracticeEngine;
  /** Spark integration service */
  sparkIntegration: SparkIntegration;
  /** SparkEngine store (for goal lookup) */
  sparkStore: ISparkEngineStore;
  /** Configuration */
  config?: PracticeOrchestratorConfig;
}

/**
 * Unified orchestrator for daily practice.
 */
export class PracticeOrchestrator {
  private readonly practiceEngine: IDeliberatePracticeEngine;
  private readonly sparkIntegration: SparkIntegration;
  private readonly sparkStore: ISparkEngineStore;
  private readonly config: Required<PracticeOrchestratorConfig>;

  constructor(deps: PracticeOrchestratorDependencies) {
    this.practiceEngine = deps.practiceEngine;
    this.sparkIntegration = deps.sparkIntegration;
    this.sparkStore = deps.sparkStore;
    this.config = {
      timezone: deps.config?.timezone ?? 'UTC',
      dailyMinutes: deps.config?.dailyMinutes ?? 30,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DAILY PRACTICE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get today's practice bundle.
   *
   * Returns complete information about what the user should practice today,
   * including the drill, spark, skill context, and pass signal.
   */
  async getTodayPractice(
    userId: UserId,
    goalId: GoalId
  ): AsyncAppResult<TodayPracticeBundle> {
    // Get today's practice from the engine
    const practiceResult = await this.practiceEngine.getTodayPractice(userId, goalId);
    if (!isOk(practiceResult)) {
      return err(practiceResult.error);
    }

    const practice = practiceResult.value;

    // No content available
    if (!practice.hasContent || !practice.drill) {
      return ok({
        hasContent: false,
        date: practice.date,
        drill: null,
        spark: null,
        skill: null,
        weekPlan: null,
        goal: null,
        context: null,
        isRetry: false,
        retryCount: 0,
        passSignal: null,
        constraint: null,
      });
    }

    const drill = practice.drill;
    const skill = practice.skill;
    const weekPlan = practice.weekPlan;

    // Get or create spark for the drill
    let spark: DrillSpark | null = null;

    // First try to get existing spark
    const existingSparkResult = await this.sparkIntegration.getSparkForDrill(drill.id);
    if (isOk(existingSparkResult) && existingSparkResult.value) {
      spark = existingSparkResult.value;
    } else if (skill) {
      // Create new spark for the drill
      const goalResult = await this.sparkStore.getGoal(goalId);
      if (isOk(goalResult) && goalResult.value) {
        const sparkResult = await this.sparkIntegration.createSparkFromDrill(
          drill,
          skill,
          goalResult.value
        );
        if (isOk(sparkResult)) {
          spark = sparkResult.value;
        }
      }
    }

    // Get goal for context
    const goalResult = await this.sparkStore.getGoal(goalId);
    const goal = isOk(goalResult) ? goalResult.value : null;

    return ok({
      hasContent: true,
      date: practice.date,
      drill,
      spark,
      skill,
      weekPlan,
      goal,
      context: practice.context,
      isRetry: drill.isRetry,
      retryCount: drill.retryCount,
      passSignal: drill.passSignal,
      constraint: drill.constraint,
    });
  }

  /**
   * Complete today's practice with outcome.
   */
  async completePractice(
    userId: UserId,
    goalId: GoalId,
    passSignalMet: boolean,
    observation?: string
  ): AsyncAppResult<PracticeCompletionResult> {
    // Get today's practice
    const practiceResult = await this.getTodayPractice(userId, goalId);
    if (!isOk(practiceResult)) {
      return err(practiceResult.error);
    }

    const practice = practiceResult.value;
    if (!practice.hasContent || !practice.drill) {
      return err(appError('NOT_FOUND', 'No practice available for today'));
    }

    const drill = practice.drill;

    // If we have a spark, complete it (which will record the drill outcome)
    if (practice.spark) {
      const sparkResult = await this.sparkIntegration.completeSparkWithOutcome(
        practice.spark.id,
        passSignalMet,
        observation
      );

      if (isOk(sparkResult)) {
        const result = sparkResult.value;
        const outcome = result.outcome;

        return ok({
          drillId: drill.id,
          sparkId: practice.spark.id,
          outcome,
          passSignalMet,
          observation,
          repeatTomorrow: outcome === 'fail' || outcome === 'partial',
          message: this.generateCompletionMessage(outcome, practice.retryCount),
        });
      }
    }

    // No spark, directly record drill outcome
    const drillResult = await this.practiceEngine.recordOutcome(drill.id, {
      passSignalMet,
      observation,
    });

    if (!isOk(drillResult)) {
      return err(drillResult.error);
    }

    const updatedDrill = drillResult.value;
    const outcome = updatedDrill.outcome ?? (passSignalMet ? 'pass' : 'fail');

    return ok({
      drillId: drill.id,
      sparkId: practice.spark?.id ?? ('' as SparkId),
      outcome,
      passSignalMet,
      observation,
      repeatTomorrow: outcome === 'fail' || outcome === 'partial',
      message: this.generateCompletionMessage(outcome, practice.retryCount),
    });
  }

  /**
   * Skip today's practice.
   */
  async skipPractice(
    userId: UserId,
    goalId: GoalId,
    reason?: string
  ): AsyncAppResult<void> {
    // Get today's practice
    const practiceResult = await this.getTodayPractice(userId, goalId);
    if (!isOk(practiceResult)) {
      return err(practiceResult.error);
    }

    const practice = practiceResult.value;
    if (!practice.hasContent || !practice.drill) {
      return ok(undefined);
    }

    // Skip the spark if exists
    if (practice.spark) {
      await this.sparkIntegration.skipSparkWithReason(practice.spark.id, reason);
    } else {
      // Directly skip the drill
      await this.practiceEngine.skipDrill(practice.drill.id, reason);
    }

    return ok(undefined);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PROGRESS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get progress for a goal.
   */
  async getProgress(goalId: GoalId): AsyncAppResult<GoalProgress> {
    return this.practiceEngine.getProgress(goalId);
  }

  /**
   * Get current week plan.
   */
  async getCurrentWeek(goalId: GoalId): AsyncAppResult<WeekPlan | null> {
    return this.practiceEngine.getCurrentWeek(goalId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RECONCILIATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Reconcile missed drills at end of day.
   *
   * Called by scheduler at 11 PM (or configured time).
   */
  async reconcileMissedDrills(
    userId: UserId,
    goalId: GoalId
  ): AsyncAppResult<ReconciliationResult> {
    const today = this.getToday();

    // Get today's drill
    const drillResult = await this.practiceEngine.getDrillByDate(userId, goalId, today);
    if (!isOk(drillResult)) {
      return err(drillResult.error);
    }

    const drill = drillResult.value;
    const missedDrills: DrillId[] = [];
    const carriedForward: DrillId[] = [];

    // Check if drill was completed
    if (drill && drill.status !== 'completed') {
      // Mark as missed
      await this.practiceEngine.markMissed(drill.id);
      missedDrills.push(drill.id);
      carriedForward.push(drill.id);
    }

    return ok({
      missedDrills,
      carriedForward,
      missedCount: missedDrills.length,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get today's date in YYYY-MM-DD format.
   */
  private getToday(): string {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.config.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(now);
  }

  /**
   * Generate completion message based on outcome.
   */
  private generateCompletionMessage(
    outcome: DrillOutcome,
    retryCount: number
  ): string {
    switch (outcome) {
      case 'pass':
        if (retryCount > 0) {
          return '🎉 Persistence pays off! You got it this time.';
        }
        return '✅ Great work! Ready for the next skill.';

      case 'fail':
        if (retryCount >= 2) {
          return "💪 Don't give up. Tomorrow's version will be simpler.";
        }
        return "📝 No worries. We'll try a different approach tomorrow.";

      case 'partial':
        return '⏳ Good progress! Pick up where you left off tomorrow.';

      case 'skipped':
        return '⏭️ Skipped for today. It will be waiting tomorrow.';

      default:
        return 'Practice recorded.';
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a PracticeOrchestrator instance.
 */
export function createPracticeOrchestrator(
  deps: PracticeOrchestratorDependencies
): PracticeOrchestrator {
  return new PracticeOrchestrator(deps);
}
