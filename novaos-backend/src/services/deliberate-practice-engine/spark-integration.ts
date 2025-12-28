// ═══════════════════════════════════════════════════════════════════════════════
// SPARK INTEGRATION — Bridges Deliberate Practice with SparkEngine
// NovaOS Deliberate Practice Engine — Phase 18: SparkEngine Integration
// Phase 19G: Drill-Aware Reminder Templates
// ═══════════════════════════════════════════════════════════════════════════════
//
// This service bridges the two systems:
//   - Creates Sparks from Drills for reminder scheduling
//   - Converts Spark completions to Drill outcomes
//   - Coordinates escalation between both systems
//   - Syncs mastery tracking
//   - Generates drill-aware reminder messages (Phase 19G)
//
// Flow:
//   1. Drill generated → createSparkFromDrill() → Spark created → reminders scheduled
//   2. User completes Spark → completeSparkWithOutcome() → Drill outcome recorded
//   3. Escalation: retry drills get escalated sparks (reduced/minimal variants)
//
// Phase 19G Enhancements:
//   - Drill-specific reminder message templates
//   - Escalation-aware message content
//   - Skill type and retry context in messages
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

// Phase 19G: Import reminder templates
import {
  generateDrillReminderMessage,
  generateRetryReminderMessage,
  generateCompoundSkillMessage,
  generateSynthesisSkillMessage,
  type DrillReminderContext,
  type DrillReminderMessage,
  type EscalationLevel,
} from './drill-reminder-templates.js';

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

/**
 * Default reminder times by escalation level (hour of day).
 */
const DEFAULT_REMINDER_HOURS: Record<EscalationLevel, number> = {
  0: 9,   // 9 AM - Morning
  1: 12,  // 12 PM - Midday
  2: 15,  // 3 PM - Afternoon
  3: 18,  // 6 PM - Evening
};

// ═══════════════════════════════════════════════════════════════════════════════
// SPARK INTEGRATION SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Configuration for SparkIntegration.
 */
export interface SparkIntegrationConfig {
  /** Default timezone */
  timezone?: string;
  /** First reminder hour (default: 9) */
  firstReminderHour?: number;
  /** Last reminder hour (default: 18) */
  lastReminderHour?: number;
  /** Enable drill-aware reminder messages (Phase 19G) */
  useDrillAwareReminders?: boolean;
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
 * - Generate drill-aware reminder messages (Phase 19G)
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
      firstReminderHour: deps.config?.firstReminderHour ?? 9,
      lastReminderHour: deps.config?.lastReminderHour ?? 18,
      useDrillAwareReminders: deps.config?.useDrillAwareReminders ?? true,
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
   *
   * Phase 19G: Now uses drill-aware reminder templates.
   */
  async createSparkFromDrill(
    drill: DailyDrill,
    skill: Skill,
    goal: Goal
  ): AsyncAppResult<DrillSpark> {
    const now = createTimestamp();

    // Determine variant based on retry count
    const variant = this.getVariantForRetryCount(drill.retryCount);
    const escalationLevel = Math.min(drill.retryCount, 3) as EscalationLevel;

    // Phase 19G: Generate drill-aware action text
    const action = this.config.useDrillAwareReminders
      ? this.generateDrillAwareAction(drill, skill, variant, goal.title)
      : this.formatAction(drill, skill, variant);

    // Create the spark
    const spark: DrillSpark = {
      id: createSparkId(),
      stepId: this.getDummyStepId(drill), // Drills don't have steps, use placeholder
      action,
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

    // Schedule reminders with drill context
    const reminderResult = await this.scheduleRemindersWithDrillContext(
      spark,
      drill,
      skill,
      goal
    );

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
   * Schedule reminders with drill-aware context.
   * Phase 19G: Uses drill reminder templates for message content.
   */
  private async scheduleRemindersWithDrillContext(
    spark: DrillSpark,
    drill: DailyDrill,
    skill: Skill,
    goal: Goal
  ): AsyncAppResult<readonly { id: ReminderId }[]> {
    // If not using drill-aware reminders, delegate to standard scheduling
    if (!this.config.useDrillAwareReminders) {
      return this.reminderService.scheduleReminders(spark, goal);
    }

    // Generate drill-aware reminder messages for each escalation level
    const reminderContexts = this.buildReminderContexts(drill, skill, goal);

    // Store messages in spark metadata for reminder service to use
    // The reminder service will pull these when sending
    const sparkWithMessages: DrillSpark = {
      ...spark,
      // Store reminder messages as metadata
      // @ts-expect-error - extending spark with drill-specific fields
      drillReminderMessages: reminderContexts.map(ctx => {
        const message = this.generateReminderMessage(ctx, drill, skill);
        return {
          escalationLevel: ctx.escalationLevel,
          text: message.text,
          subject: message.subject,
          shortText: message.shortText,
        };
      }),
    };

    // Save spark with reminder messages
    await this.sparkStore.saveSpark(sparkWithMessages);

    // Delegate to standard reminder scheduling
    return this.reminderService.scheduleReminders(sparkWithMessages, goal);
  }

  /**
   * Build reminder contexts for all escalation levels.
   */
  private buildReminderContexts(
    drill: DailyDrill,
    skill: Skill,
    goal: Goal
  ): DrillReminderContext[] {
    const variants: SparkVariant[] = ['full', 'full', 'reduced', 'minimal'];

    return ([0, 1, 2, 3] as EscalationLevel[]).map((level) => ({
      drill,
      skill,
      goalTitle: goal.title,
      escalationLevel: level,
      variant: variants[level]!,
    }));
  }

  /**
   * Generate appropriate reminder message based on context.
   */
  private generateReminderMessage(
    context: DrillReminderContext,
    drill: DailyDrill,
    skill: Skill
  ): DrillReminderMessage {
    // Check for special cases
    if (drill.isRetry || drill.retryCount > 0) {
      return generateRetryReminderMessage(context);
    }

    if (skill.skillType === 'compound' && skill.componentSkillIds) {
      // In production, we'd look up component skill titles
      return generateCompoundSkillMessage(context, []);
    }

    if (skill.skillType === 'synthesis') {
      // In production, we'd look up milestone title
      return generateSynthesisSkillMessage(context, 'Quest Milestone');
    }

    // Standard drill reminder
    return generateDrillReminderMessage(context);
  }

  /**
   * Generate drill-aware action text.
   * Phase 19G: Creates more informative action text for sparks.
   */
  private generateDrillAwareAction(
    drill: DailyDrill,
    skill: Skill,
    variant: SparkVariant,
    goalTitle: string
  ): string {
    const skillType = skill.skillType ?? 'foundation';
    const skillEmoji = this.getSkillTypeEmoji(skillType);

    switch (variant) {
      case 'full':
        return `${skillEmoji} ${skill.action}\n\n${drill.action}`;

      case 'reduced':
        // Take first sentence
        const firstSentence = drill.action.split(/[.!?]/)[0] ?? drill.action;
        return `${skillEmoji} ${firstSentence.slice(0, 100).trim()}`;

      case 'minimal':
        // Just the skill name and a hint
        const firstClause = drill.action.split(/[,;]/)[0] ?? drill.action;
        return `Just: ${firstClause.slice(0, 50).trim()}`;

      default:
        return drill.action;
    }
  }

  /**
   * Get emoji for skill type.
   */
  private getSkillTypeEmoji(skillType: string): string {
    const emojiMap: Record<string, string> = {
      foundation: '🧱',
      building: '🔨',
      compound: '🔗',
      synthesis: '⭐',
    };
    return emojiMap[skillType] ?? '📚';
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
   * Phase 19G: Updates message content based on new escalation level.
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
  // REMINDER MESSAGE ACCESS (Phase 19G)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get drill-aware reminder message for a spark at a specific escalation level.
   * Phase 19G: Used by reminder service to get appropriate message.
   */
  async getDrillReminderMessage(
    sparkId: SparkId,
    escalationLevel: EscalationLevel
  ): AsyncAppResult<DrillReminderMessage | null> {
    const sparkResult = await this.sparkStore.getSpark(sparkId);
    if (!isOk(sparkResult) || !sparkResult.value) {
      return ok(null);
    }

    const spark = sparkResult.value as DrillSpark & {
      drillReminderMessages?: Array<{
        escalationLevel: number;
        text: string;
        subject: string;
        shortText: string;
      }>;
    };

    // Check for pre-generated messages
    if (spark.drillReminderMessages) {
      const message = spark.drillReminderMessages.find(
        m => m.escalationLevel === escalationLevel
      );
      if (message) {
        return ok({
          text: message.text,
          subject: message.subject,
          shortText: message.shortText,
          escalationLevel,
          variant: this.getVariantForEscalationLevel(escalationLevel),
        });
      }
    }

    // Generate message on-demand if drill context available
    if (spark.drillId) {
      const drillResult = await this.practiceEngine.getDrill(spark.drillId);
      if (isOk(drillResult) && drillResult.value) {
        const drill = drillResult.value;
        let skill: Skill | null = null;

        if (drill.skillId) {
          const skillResult = await this.practiceEngine.getSkill(drill.skillId);
          if (isOk(skillResult)) {
            skill = skillResult.value;
          }
        }

        if (skill) {
          const context: DrillReminderContext = {
            drill,
            skill,
            goalTitle: 'Your Learning Goal', // Would need goal lookup
            escalationLevel,
            variant: this.getVariantForEscalationLevel(escalationLevel),
          };

          return ok(generateDrillReminderMessage(context));
        }
      }
    }

    return ok(null);
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
   * Format action text based on variant (legacy method).
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
      .replace(/^Just:\s*/i, '')
      .replace(/^🧱\s*/g, '')
      .replace(/^🔨\s*/g, '')
      .replace(/^🔗\s*/g, '')
      .replace(/^⭐\s*/g, '')
      .replace(/^📚\s*/g, '');

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
    // Add default time (first reminder hour in configured timezone)
    const hour = this.config.firstReminderHour.toString().padStart(2, '0');
    return `${date}T${hour}:00:00`;
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
