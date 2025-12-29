// ═══════════════════════════════════════════════════════════════════════════════
// DAILY DRILL ENGINE — Phase 19D: Structured Practice Sessions
// NovaOS Deliberate Practice Engine
// ═══════════════════════════════════════════════════════════════════════════════
//
// Generates structured daily drills with:
//   - Warmup section (review from previous quest)
//   - Main practice section (today's skill)
//   - Stretch challenge (optional extension)
//   - Retry adaptation for failed attempts
//
// KEY FEATURES:
//   - Cross-quest warmups using review skills
//   - Skill-type-aware drill generation
//   - Progressive difficulty within sections
//   - Failure-aware retry adaptation
//   - Time-boxed sections within daily budget
//
// DRILL STRUCTURE:
//   ┌─────────────────────────────────────────┐
//   │ WARMUP (5 min) — Review previous quest  │
//   ├─────────────────────────────────────────┤
//   │ MAIN (20-25 min) — Today's skill        │
//   ├─────────────────────────────────────────┤
//   │ STRETCH (5 min) — Optional challenge    │
//   └─────────────────────────────────────────┘
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { AsyncAppResult } from '../../types/result.js';
import { ok, err, appError, isOk } from '../../types/result.js';
import type {
  DrillId,
  SkillId,
  QuestId,
  GoalId,
  UserId,
  Timestamp,
} from '../../types/branded.js';
import { createDrillId, createTimestamp } from '../../types/branded.js';
import type {
  Skill,
  DailyDrill,
  DrillSection,
  DrillSectionType,
  DrillStatus,
  SkillType,
  DayPlan,
} from './types.js';
import type {
  IDailyDrillEngine,
  DailyDrillGenerationContext,
  DailyDrillGenerationResult,
} from './interfaces.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Default time allocation for sections.
 */
const DEFAULT_WARMUP_MINUTES = 5;
const DEFAULT_MAIN_MINUTES = 20;
const DEFAULT_STRETCH_MINUTES = 5;

/**
 * Minimum time for main section.
 */
const MIN_MAIN_MINUTES = 10;

/**
 * Maximum retry attempts before suggesting skip.
 */
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Retry time multipliers by attempt number.
 */
const RETRY_TIME_MULTIPLIERS: Record<number, number> = {
  1: 1.0,   // First attempt: normal time
  2: 1.25,  // Second attempt: 25% more time
  3: 1.5,   // Third attempt: 50% more time
};

/**
 * Difficulty progression for stretch challenges.
 */
const STRETCH_DIFFICULTY_BOOST = 1;

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Configuration for DailyDrillEngine.
 */
export interface DailyDrillEngineConfig {
  /** Default warmup duration in minutes */
  warmupMinutes?: number;
  /** Default stretch duration in minutes */
  stretchMinutes?: number;
  /** Whether to include stretch section by default */
  includeStretch?: boolean;
  /** Maximum retry attempts */
  maxRetryAttempts?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DAILY DRILL ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generates structured daily practice drills.
 *
 * The engine creates drills with three sections:
 *   - Warmup: Review skill from previous quest (cross-quest context)
 *   - Main: Today's skill practice (the core learning)
 *   - Stretch: Optional challenge to push boundaries
 */
export class DailyDrillEngine implements IDailyDrillEngine {
  private readonly config: Required<DailyDrillEngineConfig>;

  constructor(config: DailyDrillEngineConfig = {}) {
    this.config = {
      warmupMinutes: config.warmupMinutes ?? DEFAULT_WARMUP_MINUTES,
      stretchMinutes: config.stretchMinutes ?? DEFAULT_STRETCH_MINUTES,
      includeStretch: config.includeStretch ?? true,
      maxRetryAttempts: config.maxRetryAttempts ?? MAX_RETRY_ATTEMPTS,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate a complete daily drill.
   */
  async generate(context: DailyDrillGenerationContext): AsyncAppResult<DailyDrillGenerationResult> {
    const {
      skill,
      dayPlan,
      weekPlan,
      previousQuestSkills,
      componentSkills,
      dailyMinutes,
      previousDrill,
    } = context;

    // Determine retry count from previous drill
    const retryCount = previousDrill?.outcome && ['fail', 'partial'].includes(previousDrill.outcome)
      ? (previousDrill.retryCount ?? 0) + 1
      : 0;

    console.log(`[DRILL_ENGINE] Generating drill for "${skill.title}" (retry count: ${retryCount})`);

    const now = createTimestamp();

    // Calculate time budget
    const timeMultiplier = RETRY_TIME_MULTIPLIERS[retryCount] ?? 1.0;
    const adjustedDailyMinutes = Math.round(dailyMinutes * timeMultiplier);

    // Determine if this is a retry
    const isRetry = retryCount > 0;

    // Generate sections using interface-compliant signatures
    const warmupResult = await this.generateWarmup(skill, dayPlan, previousQuestSkills);
    const warmup = isOk(warmupResult) ? warmupResult.value : null;

    const mainResult = await this.generateMain(skill, componentSkills, adjustedDailyMinutes);
    if (!isOk(mainResult)) {
      return mainResult;
    }
    const main = mainResult.value;

    // Only include stretch if time permits and not a retry
    const stretchBudget = adjustedDailyMinutes
      - (warmup?.estimatedMinutes ?? 0)
      - main.estimatedMinutes;

    let stretch: DrillSection | null = null;
    if (!isRetry && this.config.includeStretch && stretchBudget >= this.config.stretchMinutes) {
      const stretchResult = await this.generateStretch(skill);
      stretch = isOk(stretchResult) ? stretchResult.value : null;
    }

    // Calculate total time
    const totalMinutes =
      (warmup?.estimatedMinutes ?? 0) +
      main.estimatedMinutes +
      (stretch?.estimatedMinutes ?? 0);

    // Identify cross-quest dependencies
    const reviewSkill = dayPlan.reviewSkillId
      ? previousQuestSkills.find(s => s.id === dayPlan.reviewSkillId)
      : undefined;
    const buildsOnQuestIds = this.identifyBuildsOnQuests(skill, reviewSkill);

    // Determine component skills for compound drills
    const componentSkillIds = skill.isCompound ? skill.componentSkillIds : undefined;

    const drill: DailyDrill = {
      id: createDrillId(),
      weekPlanId: weekPlan.id,
      skillId: skill.id,
      questId: skill.questId,
      goalId: skill.goalId,
      userId: skill.userId,

      // Scheduling
      scheduledDate: dayPlan.scheduledDate ?? new Date().toISOString().split('T')[0]!,
      dayNumber: dayPlan.dayNumber,
      weekNumber: weekPlan.weekNumber,
      dayInWeek: dayPlan.dayNumber,
      dayInQuest: dayPlan.dayInQuest,
      status: 'scheduled' as DrillStatus,

      // Skill context
      skillType: skill.skillType,
      skillTitle: skill.title,
      isCompoundDrill: skill.isCompound,
      componentSkillIds,

      // Cross-quest context
      buildsOnQuestIds,
      reviewSkillId: reviewSkill?.id,
      reviewQuestId: reviewSkill?.questId,

      // Structured sections
      warmup: warmup ?? undefined,
      main,
      stretch: stretch ?? undefined,

      // Legacy fields for backward compatibility
      action: main.action,
      passSignal: main.passSignal ?? skill.successSignal,
      lockedVariables: skill.lockedVariables,
      constraint: main.constraint ?? skill.lockedVariables[0] ?? 'Focus on the main task',

      // Timing
      estimatedMinutes: totalMinutes,

      // Outcome tracking (not yet completed)
      repeatTomorrow: false,

      // Retry context
      isRetry,
      retryCount,

      // Timestamps
      createdAt: now,
      updatedAt: now,
    };

    // Build context explanation
    const contextExplanation = this.buildContextExplanation(skill, reviewSkill, isRetry, retryCount);

    return ok({
      drill,
      warmup,
      main,
      stretch,
      context: contextExplanation,
    });
  }

  /**
   * Build context explanation for drill generation.
   */
  private buildContextExplanation(
    skill: Skill,
    reviewSkill: Skill | undefined,
    isRetry: boolean,
    retryCount: number
  ): string {
    const parts: string[] = [];

    if (isRetry) {
      parts.push(`Retry attempt ${retryCount} for "${skill.title}".`);
    } else {
      parts.push(`New practice of "${skill.title}".`);
    }

    if (reviewSkill) {
      parts.push(`Warmup reviews "${reviewSkill.title}" from a previous quest.`);
    }

    if (skill.isCompound) {
      parts.push(`This is a compound skill combining multiple concepts.`);
    }

    return parts.join(' ');
  }

  /**
   * Generate warmup section from review skill.
   */
  async generateWarmup(
    skill: Skill,
    dayPlan: DayPlan,
    previousQuestSkills: readonly Skill[]
  ): AsyncAppResult<DrillSection | null> {
    // Find review skill from dayPlan
    if (!dayPlan.reviewSkillId) {
      return ok(null);
    }

    const reviewSkill = previousQuestSkills.find(s => s.id === dayPlan.reviewSkillId);
    if (!reviewSkill) {
      return ok(null);
    }

    // Create a lighter version of the review skill's action
    const action = this.createWarmupAction(reviewSkill, skill);
    const passSignal = this.createWarmupPassSignal(reviewSkill);

    return ok({
      type: 'warmup' as DrillSectionType,
      title: `Review: ${reviewSkill.title}`,
      action,
      passSignal,
      constraint: 'Complete quickly without looking up references',
      estimatedMinutes: this.config.warmupMinutes,
      isOptional: false,
      isFromPreviousQuest: reviewSkill.questId !== skill.questId,
      sourceQuestId: reviewSkill.questId,
      sourceSkillId: reviewSkill.id,
    });
  }

  /**
   * Generate main practice section.
   */
  async generateMain(
    skill: Skill,
    componentSkills: readonly Skill[] | undefined,
    dailyMinutes: number
  ): AsyncAppResult<DrillSection> {
    // Calculate main section time (reserve time for warmup/stretch)
    const warmupTime = this.config.warmupMinutes;
    const stretchTime = this.config.includeStretch ? this.config.stretchMinutes : 0;
    const availableTime = dailyMinutes - warmupTime - stretchTime;
    const mainTime = Math.max(MIN_MAIN_MINUTES, Math.min(availableTime, skill.estimatedMinutes));

    // Build action - for compound skills, mention component integration
    let action = skill.action;
    if (skill.isCompound && componentSkills && componentSkills.length > 0) {
      const componentNames = componentSkills.map(s => s.title).join(', ');
      action = `${skill.action} (integrating: ${componentNames})`;
    }

    // Build constraint from locked variables
    const constraint = skill.lockedVariables?.length > 0
      ? skill.lockedVariables.join('; ')
      : "Complete the task as specified";

    return ok({
      type: 'main' as DrillSectionType,
      title: skill.title,
      action,
      passSignal: skill.successSignal,
      constraint,
      estimatedMinutes: mainTime,
      isOptional: false,
      isFromPreviousQuest: false,
      sourceSkillId: skill.id,
    });
  }

  /**
   * Generate stretch challenge section.
   */
  async generateStretch(skill: Skill): AsyncAppResult<DrillSection | null> {
    // Create a harder version of the skill
    const action = this.createStretchAction(skill);
    const passSignal = this.createStretchPassSignal(skill);

    return ok({
      type: 'stretch' as DrillSectionType,
      title: `Challenge: ${skill.title}`,
      action,
      passSignal,
      constraint: skill.transferScenario ?? 'Apply in a new context without guidance',
      estimatedMinutes: this.config.stretchMinutes,
      isOptional: true,
      isFromPreviousQuest: false,
      sourceSkillId: skill.id,
    });
  }

  /**
   * Adapt a drill for retry after failure.
   */
  async adaptForRetry(
    skill: Skill,
    previousDrill: DailyDrill,
    retryCount: number
  ): AsyncAppResult<{ main: DrillSection; warmup?: DrillSection }> {
    if (retryCount > this.config.maxRetryAttempts) {
      return err(appError(
        'MAX_RETRIES_EXCEEDED',
        `Maximum retry attempts (${this.config.maxRetryAttempts}) exceeded. Consider skipping this skill.`
      ));
    }

    console.log(`[DRILL_ENGINE] Adapting drill for retry ${retryCount}: "${skill.title}"`);

    const timeMultiplier = RETRY_TIME_MULTIPLIERS[retryCount] ?? 1.5;
    const previousFailureReason = previousDrill.observation ?? 'Not specified';

    // Adapt main section
    const adaptedMain: DrillSection = {
      type: 'main' as DrillSectionType,
      title: `${skill.title} (Retry ${retryCount})`,
      action: this.adaptActionForRetry(skill.action, retryCount, previousFailureReason),
      passSignal: skill.successSignal,
      constraint: skill.lockedVariables?.[0] ?? 'Focus on the basics',
      estimatedMinutes: Math.round(skill.estimatedMinutes * timeMultiplier),
      isOptional: false,
      isFromPreviousQuest: false,
      sourceSkillId: skill.id,
    };

    return ok({
      main: adaptedMain,
      warmup: undefined, // No warmup on retry - focus on main skill
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE: SECTION GENERATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create warmup action from review skill.
   */
  private createWarmupAction(reviewSkill: Skill, todaySkill: Skill): string {
    // Create a quick refresher version
    const baseAction = reviewSkill.action;

    // If review skill relates to today's skill, make it relevant
    if (this.skillsRelated(reviewSkill, todaySkill)) {
      return `Quick review: ${baseAction.toLowerCase()}. This prepares you for today's "${todaySkill.title}" skill.`;
    }

    return `Quick review: ${baseAction.toLowerCase()}. Aim for speed over perfection.`;
  }

  /**
   * Create warmup pass signal.
   */
  private createWarmupPassSignal(reviewSkill: Skill): string {
    return `Completed within ${this.config.warmupMinutes} minutes: ${reviewSkill.successSignal.toLowerCase()}`;
  }

  /**
   * Create stretch action (harder version).
   */
  private createStretchAction(skill: Skill): string {
    // Use transfer scenario if available
    if (skill.transferScenario) {
      return `Transfer challenge: ${skill.transferScenario}`;
    }

    // Otherwise, create a variation
    const variations = [
      `Apply "${skill.title}" to a different context without any guidance or references`,
      `Combine "${skill.title}" with a previous skill to solve a more complex problem`,
      `Teach "${skill.title}" by explaining it as if to a complete beginner`,
      `Speed challenge: Complete "${skill.action.toLowerCase()}" in half the time`,
    ];

    // Pick based on skill type
    switch (skill.skillType) {
      case 'foundation':
        return variations[0]!;
      case 'building':
        return variations[1]!;
      case 'compound':
        return variations[2]!;
      case 'synthesis':
        return variations[3]!;
      default:
        return variations[0]!;
    }
  }

  /**
   * Create stretch pass signal.
   */
  private createStretchPassSignal(skill: Skill): string {
    return `Successfully applied skill in new context with no errors`;
  }

  /**
   * Adapt action for retry with progressive scaffolding.
   */
  private adaptActionForRetry(
    originalAction: string,
    attemptNumber: number,
    failureReason?: string
  ): string {
    const scaffolding = this.getRetryScaffolding(attemptNumber);
    const failureContext = failureReason
      ? `Previous attempt failed: "${failureReason}". `
      : '';

    return `${failureContext}${scaffolding} ${originalAction}`;
  }

  /**
   * Get scaffolding hint for retry attempt.
   */
  private getRetryScaffolding(attemptNumber: number): string {
    switch (attemptNumber) {
      case 2:
        return 'Take more time and break into smaller steps.';
      case 3:
        return 'Review the fundamentals first, then attempt step-by-step.';
      default:
        return 'Focus on the core concepts and simplify where possible.';
    }
  }

  /**
   * Generate recovery guidance based on failure.
   */
  private generateRecoveryGuidance(failureReason: string, attemptNumber: number): string {
    const baseGuidance = [
      `Failure reason: ${failureReason}`,
      '',
      'Recovery steps:',
    ];

    // Add attempt-specific guidance
    switch (attemptNumber) {
      case 2:
        baseGuidance.push(
          '1. Re-read the success signal carefully',
          '2. Identify exactly where you got stuck',
          '3. Break the task into smaller sub-tasks',
          '4. Complete one sub-task at a time'
        );
        break;
      case 3:
        baseGuidance.push(
          '1. Review prerequisite skills first',
          '2. Look at similar examples or references',
          '3. Focus on the minimum viable solution',
          '4. Ask for help if still stuck after 10 minutes'
        );
        break;
      default:
        baseGuidance.push(
          '1. Consider simplifying the approach',
          '2. Review foundational concepts',
          '3. Take a break and return with fresh perspective'
        );
    }

    return baseGuidance.join('\n');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE: UTILITIES
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Identify quests that this drill builds on.
   */
  private identifyBuildsOnQuests(skill: Skill, reviewSkill?: Skill): QuestId[] {
    const questIds = new Set<QuestId>();

    // Add prerequisite quests
    for (const questId of skill.prerequisiteQuestIds) {
      questIds.add(questId);
    }

    // Add component quests for compound skills
    if (skill.componentQuestIds) {
      for (const questId of skill.componentQuestIds) {
        if (questId !== skill.questId) {
          questIds.add(questId);
        }
      }
    }

    // Add review skill's quest
    if (reviewSkill && reviewSkill.questId !== skill.questId) {
      questIds.add(reviewSkill.questId);
    }

    return [...questIds];
  }

  /**
   * Check if two skills are related (for warmup relevance).
   */
  private skillsRelated(skill1: Skill, skill2: Skill): boolean {
    // Check topic overlap
    const topics1 = new Set(skill1.topics ?? [skill1.topic]);
    const topics2 = skill2.topics ?? [skill2.topic];

    for (const topic of topics2) {
      if (topics1.has(topic)) {
        return true;
      }
    }

    // Check if skill2 lists skill1 as prerequisite
    if (skill2.prerequisiteSkillIds.includes(skill1.id)) {
      return true;
    }

    // Check if skill2 includes skill1 as component
    if (skill2.componentSkillIds?.includes(skill1.id)) {
      return true;
    }

    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a DailyDrillEngine instance.
 */
export function createDailyDrillEngine(config?: DailyDrillEngineConfig): DailyDrillEngine {
  return new DailyDrillEngine(config);
}
