// ═══════════════════════════════════════════════════════════════════════════════
// SPARK INTEGRATION — Bridges Deliberate Practice with SparkEngine
// NovaOS Deliberate Practice Engine — Phase 18: SparkEngine Integration
// ═══════════════════════════════════════════════════════════════════════════════
//
// This service bridges the two systems:
//   - Creates Sparks from Drills for reminder scheduling
//   - Converts Spark completions to Drill outcomes
//   - Coordinates escalation between both systems
//   - Syncs mastery tracking
//
// Flow:
//   1. Drill generated → createSparkFromDrill() → Spark created → reminders scheduled
//   2. User completes Spark → completeSparkWithOutcome() → Drill outcome recorded
//   3. Escalation: retry drills get escalated sparks (reduced/minimal variants)
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { AsyncAppResult } from '../../types/result.js';
import { ok, err, appError, isOk } from '../../types/result.js';
import type {
  UserId,
  GoalId,
  SparkId,
  DrillId,
  StepId,
  ReminderId,
  Timestamp,
} from '../../types/branded.js';
import { createSparkId, createTimestamp } from '../../types/branded.js';
import type { Spark, SparkVariant, SparkStatus, Goal } from '../spark-engine/types.js';
import type { ISparkEngineStore, IReminderService } from '../spark-engine/interfaces.js';
import type { DailyDrill, DrillOutcome, Skill } from './types.js';
import type { IDeliberatePracticeEngine } from './interfaces.js';
import type {
  DrillSpark,
  CreateSparkFromDrillParams,
  DrillSparkCompletionResult,
} from './spark-integration-types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Map retry count to spark variant.
 */
const RETRY_TO_VARIANT: Record<number, SparkVariant> = {
  0: 'full',
  1: 'full',
  2: 'reduced',
  3: 'minimal',
};

/**
 * Default spark variant for high retry counts.
 */
const DEFAULT_HIGH_RETRY_VARIANT: SparkVariant = 'minimal';

// ═══════════════════════════════════════════════════════════════════════════════
// SPARK INTEGRATION SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Configuration for SparkIntegration.
 */
export interface SparkIntegrationConfig {
  /** Default timezone */
  timezone?: string;
}

/**
 * Dependencies for SparkIntegration.
 */
export interface SparkIntegrationDependencies {
  /** SparkEngine store for saving sparks */
  sparkStore: ISparkEngineStore;
  /** Reminder service for scheduling */
  reminderService: IReminderService;
  /** Deliberate Practice Engine */
  practiceEngine: IDeliberatePracticeEngine;
  /** Optional configuration */
  config?: SparkIntegrationConfig;
}

/**
 * Bridges Deliberate Practice Engine with SparkEngine.
 *
 * Responsibilities:
 * - Create Sparks from Drills (for reminder scheduling)
 * - Complete Sparks and record Drill outcomes
 * - Coordinate escalation between systems
 */
export class SparkIntegration {
  private readonly sparkStore: ISparkEngineStore;
  private readonly reminderService: IReminderService;
  private readonly practiceEngine: IDeliberatePracticeEngine;
  private readonly config: Required<SparkIntegrationConfig>;

  constructor(deps: SparkIntegrationDependencies) {
    this.sparkStore = deps.sparkStore;
    this.reminderService = deps.reminderService;
    this.practiceEngine = deps.practiceEngine;
    this.config = {
      timezone: deps.config?.timezone ?? 'UTC',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SPARK CREATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a Spark from a Drill.
   *
   * This is called after drill generation to create the corresponding
   * spark for reminder scheduling.
   */
  async createSparkFromDrill(
    drill: DailyDrill,
    skill: Skill,
    goal: Goal
  ): AsyncAppResult<DrillSpark> {
    const now = createTimestamp();

    // Determine variant based on retry count
    const variant = this.getVariantForRetryCount(drill.retryCount);
    const escalationLevel = Math.min(drill.retryCount, 3);

    // Create the spark
    const spark: DrillSpark = {
      id: createSparkId(),
      stepId: this.getDummyStepId(drill), // Drills don't have steps, use placeholder
      action: this.formatAction(drill, skill, variant),
      status: 'pending' as SparkStatus,
      createdAt: now,
      updatedAt: now,
      variant,
      escalationLevel,
      estimatedMinutes: drill.estimatedMinutes,
      scheduledTime: this.formatScheduledTime(drill.scheduledDate),
      // Drill-specific fields
      drillId: drill.id,
      passSignal: drill.passSignal,
      lockedVariables: drill.lockedVariables,
      constraint: drill.constraint,
      isDrillBased: true,
    };

    // Save spark
    const saveResult = await this.sparkStore.saveSpark(spark);
    if (!isOk(saveResult)) {
      return err(saveResult.error);
    }

    // Schedule reminders
    const reminderResult = await this.reminderService.scheduleReminders(spark, goal);
    if (isOk(reminderResult)) {
      // Update spark with reminder IDs
      const reminderIds = reminderResult.value.map(r => r.id);
      const updatedSpark: DrillSpark = {
        ...spark,
        reminderIds,
      };
      await this.sparkStore.saveSpark(updatedSpark);
      return ok(updatedSpark);
    }

    return ok(spark);
  }

  /**
   * Create spark directly from params (for manual creation).
   */
  async createSparkFromParams(
    params: CreateSparkFromDrillParams,
    stepId: StepId,
    goal: Goal
  ): AsyncAppResult<DrillSpark> {
    const now = createTimestamp();

    const spark: DrillSpark = {
      id: createSparkId(),
      stepId,
      action: params.action,
      status: 'pending' as SparkStatus,
      createdAt: now,
      updatedAt: now,
      variant: params.variant,
      escalationLevel: params.escalationLevel,
      estimatedMinutes: params.estimatedMinutes,
      drillId: params.drillId,
      passSignal: params.passSignal,
      lockedVariables: params.lockedVariables,
      constraint: params.constraint,
      isDrillBased: true,
    };

    const saveResult = await this.sparkStore.saveSpark(spark);
    if (!isOk(saveResult)) {
      return err(saveResult.error);
    }

    // Schedule reminders
    await this.reminderService.scheduleReminders(spark, goal);

    return ok(spark);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SPARK COMPLETION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Complete a drill-based spark with outcome.
   *
   * This is called when the user completes a spark that's linked to a drill.
   * It records the outcome in the Deliberate Practice Engine.
   */
  async completeSparkWithOutcome(
    sparkId: SparkId,
    passSignalMet: boolean,
    observation?: string
  ): AsyncAppResult<DrillSparkCompletionResult> {
    // Get the spark
    const sparkResult = await this.sparkStore.getSpark(sparkId);
    if (!isOk(sparkResult)) {
      return err(sparkResult.error);
    }
    if (!sparkResult.value) {
      return err(appError('NOT_FOUND', `Spark not found: ${sparkId}`));
    }

    const spark = sparkResult.value as DrillSpark;

    // Verify this is a drill-based spark
    if (!spark.drillId) {
      return err(appError('INVALID_INPUT', 'Spark is not drill-based'));
    }

    // Mark spark as completed
    const now = createTimestamp();
    const completedSpark: DrillSpark = {
      ...spark,
      status: 'completed' as SparkStatus,
      updatedAt: now,
    };

    await this.sparkStore.saveSpark(completedSpark);

    // Cancel pending reminders
    await this.reminderService.cancelReminders(sparkId);

    // Record drill outcome
    const drillResult = await this.practiceEngine.recordOutcome(spark.drillId, {
      passSignalMet,
      observation,
    });

    if (!isOk(drillResult)) {
      return err(drillResult.error);
    }

    const updatedDrill = drillResult.value;

    return ok({
      sparkId,
      drillId: spark.drillId,
      outcome: updatedDrill.outcome ?? (passSignalMet ? 'pass' : 'fail'),
      observation,
      passSignalMet,
      carryForward: updatedDrill.carryForward,
    });
  }

  /**
   * Skip a drill-based spark.
   */
  async skipSparkWithReason(
    sparkId: SparkId,
    reason?: string
  ): AsyncAppResult<void> {
    // Get the spark
    const sparkResult = await this.sparkStore.getSpark(sparkId);
    if (!isOk(sparkResult)) {
      return err(sparkResult.error);
    }
    if (!sparkResult.value) {
      return err(appError('NOT_FOUND', `Spark not found: ${sparkId}`));
    }

    const spark = sparkResult.value as DrillSpark;

    // Mark spark as skipped
    const now = createTimestamp();
    const skippedSpark: Spark = {
      ...spark,
      status: 'skipped' as SparkStatus,
      updatedAt: now,
    };

    await this.sparkStore.saveSpark(skippedSpark);

    // Cancel pending reminders
    await this.reminderService.cancelReminders(sparkId);

    // If drill-based, skip the drill too
    if (spark.drillId) {
      await this.practiceEngine.skipDrill(spark.drillId, reason);
    }

    return ok(undefined);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ESCALATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Escalate a spark to a smaller variant.
   *
   * Called by the reminder service when reminders escalate.
   */
  async escalateSpark(
    sparkId: SparkId,
    newEscalationLevel: number
  ): AsyncAppResult<DrillSpark> {
    const sparkResult = await this.sparkStore.getSpark(sparkId);
    if (!isOk(sparkResult)) {
      return err(sparkResult.error);
    }
    if (!sparkResult.value) {
      return err(appError('NOT_FOUND', `Spark not found: ${sparkId}`));
    }

    const spark = sparkResult.value as DrillSpark;
    const now = createTimestamp();

    // Determine new variant
    const newVariant = this.getVariantForEscalationLevel(newEscalationLevel);

    // Update action text for reduced/minimal variants
    const newAction = this.shrinkAction(spark.action, newVariant);

    const escalatedSpark: DrillSpark = {
      ...spark,
      action: newAction,
      variant: newVariant,
      escalationLevel: newEscalationLevel,
      updatedAt: now,
    };

    const saveResult = await this.sparkStore.saveSpark(escalatedSpark);
    if (!isOk(saveResult)) {
      return err(saveResult.error);
    }

    return ok(escalatedSpark);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RETRIEVAL
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get the active spark for a drill.
   */
  async getSparkForDrill(drillId: DrillId): AsyncAppResult<DrillSpark | null> {
    // This would require an index of drill → spark
    // For now, use a scan approach (can be optimized with Redis index)
    const drill = await this.practiceEngine.getDrill(drillId);
    if (!isOk(drill) || !drill.value) {
      return ok(null);
    }

    // Get spark by step (if we have a mapping)
    // In practice, we'd store drillId → sparkId mapping in Redis
    return ok(null); // Placeholder - would need drill-spark index
  }

  /**
   * Get today's drill spark for a user/goal.
   */
  async getTodayDrillSpark(
    userId: UserId,
    goalId: GoalId
  ): AsyncAppResult<DrillSpark | null> {
    // Get today's practice
    const practiceResult = await this.practiceEngine.getTodayPractice(userId, goalId);
    if (!isOk(practiceResult)) {
      return err(practiceResult.error);
    }

    const practice = practiceResult.value;
    if (!practice.hasContent || !practice.drill) {
      return ok(null);
    }

    // Check if spark exists for this drill
    const sparkResult = await this.getSparkForDrill(practice.drill.id);
    return sparkResult;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get spark variant for retry count.
   */
  private getVariantForRetryCount(retryCount: number): SparkVariant {
    return RETRY_TO_VARIANT[retryCount] ?? DEFAULT_HIGH_RETRY_VARIANT;
  }

  /**
   * Get spark variant for escalation level.
   */
  private getVariantForEscalationLevel(level: number): SparkVariant {
    if (level >= 3) return 'minimal';
    if (level >= 2) return 'reduced';
    return 'full';
  }

  /**
   * Format action text based on variant.
   */
  private formatAction(
    drill: DailyDrill,
    skill: Skill,
    variant: SparkVariant
  ): string {
    const baseAction = drill.action;

    switch (variant) {
      case 'full':
        return baseAction;
      case 'reduced':
        // Take first sentence or first 100 chars
        const firstSentence = baseAction.split(/[.!?]/)[0] ?? baseAction;
        return firstSentence.slice(0, 100).trim();
      case 'minimal':
        // Take first clause or first 50 chars
        const firstClause = baseAction.split(/[,;]/)[0] ?? baseAction;
        return `Just: ${firstClause.slice(0, 50).trim()}`;
      default:
        return baseAction;
    }
  }

  /**
   * Shrink action text for escalation.
   */
  private shrinkAction(action: string, variant: SparkVariant): string {
    // Remove existing shrink prefixes
    const cleaned = action
      .replace(/^\[Retry\]\s*/i, '')
      .replace(/^\[Simplified\]\s*/i, '')
      .replace(/^\[Foundation\]\s*/i, '')
      .replace(/^Just:\s*/i, '');

    switch (variant) {
      case 'reduced':
        const firstPart = cleaned.split(/[,;.]/)[0] ?? cleaned;
        return `[Simplified] ${firstPart.slice(0, 80).trim()}`;
      case 'minimal':
        return `Just: ${cleaned.slice(0, 40).trim()}...`;
      default:
        return action;
    }
  }

  /**
   * Create a placeholder step ID for drill-based sparks.
   *
   * Drills don't have traditional steps, so we create a synthetic ID
   * that encodes the drill relationship.
   */
  private getDummyStepId(drill: DailyDrill): StepId {
    // Return the drill ID cast as StepId for compatibility
    // In a full implementation, we'd create a mapping
    return `step-drill-${drill.id}` as unknown as StepId;
  }

  /**
   * Format scheduled date to ISO time string.
   */
  private formatScheduledTime(date: string): string {
    // Add default time (9 AM in configured timezone)
    return `${date}T09:00:00`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a SparkIntegration instance.
 */
export function createSparkIntegration(
  deps: SparkIntegrationDependencies
): SparkIntegration {
  return new SparkIntegration(deps);
}
