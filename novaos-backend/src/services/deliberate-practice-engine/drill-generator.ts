// ═══════════════════════════════════════════════════════════════════════════════
// DRILL GENERATOR — Daily Drill Generation with Roll-Forward Logic
// NovaOS Deliberate Practice Engine — Phase 18: Core Engine
// ═══════════════════════════════════════════════════════════════════════════════
//
// Generates daily drills by:
//   - Selecting the optimal skill for today (priority-based)
//   - Analyzing previous drill for roll-forward context
//   - Adapting skills for retry after failure
//   - Creating coherent drill sequences
//
// Roll-Forward Logic:
//   - PASS → Move to next skill
//   - FAIL → Retry same skill with adaptation
//   - PARTIAL → Continue with carry-forward context
//   - SKIPPED → Retry tomorrow (no adaptation)
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { AsyncAppResult } from '../../types/result.js';
import { ok, err, appError } from '../../types/result.js';
import type { SkillId, DrillId, Timestamp, WeekPlanId, QuestId, GoalId, UserId } from '../../types/branded.js';
import { createDrillId, createTimestamp } from '../../types/branded.js';
import type {
  Skill,
  DailyDrill,
  DrillOutcome,
  DrillStatus,
  WeekPlan,
  DrillSection,
  DrillSectionType,
} from './types.js';
import { RETRY_OUTCOMES, countsAsAttempt } from './types.js';
import type {
  IDrillGenerator,
  DailyDrillGenerationContext,
  RollForwardResult,
} from './interfaces.js';

// Phase 21: Science-Based Learning
import {
  getDayType,
  DAY_TYPE_CONFIGS,
  type DrillDayType,
  type ResourcePolicy,
  type GivenMaterialType,
} from './phase21/types/enhanced-types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Maximum retry count before escalating to a simpler version.
 */
const MAX_RETRY_COUNT = 3;

/**
 * Time reduction per retry attempt (percentage).
 */
const RETRY_TIME_REDUCTION = 0.8; // 80% of previous

/**
 * Minimum time for a drill (even after reductions).
 */
const MIN_DRILL_MINUTES = 10;

// ═══════════════════════════════════════════════════════════════════════════════
// DRILL GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Configuration for DrillGenerator.
 */
export interface DrillGeneratorConfig {
  /** OpenAI API key for LLM-powered adaptations */
  openaiApiKey?: string;
  /** Model to use (default: gpt-4o-mini) */
  model?: string;
  /** Whether to use LLM for smart adaptations */
  useLLM?: boolean;
}

/**
 * Generates daily drills with roll-forward logic.
 *
 * Priority order for skill selection:
 *   1. Carry-forward (retry failed skills)
 *   2. Prerequisites (unblocked skills)
 *   3. Sequence (next in order)
 *   4. Review (reinforcement of practicing skills)
 */
export class DrillGenerator implements IDrillGenerator {
  private readonly config: DrillGeneratorConfig;

  constructor(config: DrillGeneratorConfig = {}) {
    this.config = {
      useLLM: false,
      model: 'gpt-4o-mini',
      ...config,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate a drill for the given context.
   */
  async generate(context: DailyDrillGenerationContext): AsyncAppResult<DailyDrill> {
    const { skill, dayPlan, weekPlan, goal, quest, previousDrill, previousQuestSkills, componentSkills, dailyMinutes } = context;

    // Determine if this is a retry based on previous drill outcome
    const isRetry = previousDrill?.outcome && RETRY_OUTCOMES.includes(previousDrill.outcome);
    const retryCount = isRetry ? (previousDrill?.retryCount ?? 0) + 1 : 0;

    // Generate drill content
    let action = skill.action;
    let passSignal = skill.successSignal;
    let constraint = this.generateConstraint(skill);
    let estimatedMinutes = skill.estimatedMinutes;

    // Adapt for retry if needed
    if (isRetry && previousDrill) {
      const adapted = await this.adaptSkillForRetry(skill, previousDrill, retryCount);
      if (adapted.ok) {
        action = adapted.value.action;
        passSignal = adapted.value.passSignal;
        constraint = adapted.value.constraint;
        // Reduce time for retries
        estimatedMinutes = Math.max(
          MIN_DRILL_MINUTES,
          Math.floor(skill.estimatedMinutes * Math.pow(RETRY_TIME_REDUCTION, retryCount))
        );
      }
    }

    // Ensure within daily budget
    estimatedMinutes = Math.min(estimatedMinutes, dailyMinutes);

    const now = createTimestamp();

    // Build main section
    const main: DrillSection = {
      type: 'main' as DrillSectionType,
      title: skill.title,
      action,
      passSignal,
      constraint,
      estimatedMinutes,
      isOptional: false,
      isFromPreviousQuest: false,
      sourceSkillId: skill.id,
    };

    // Find review skill if any
    const reviewSkill = dayPlan.reviewSkillId
      ? previousQuestSkills.find(s => s.id === dayPlan.reviewSkillId)
      : undefined;

    const drill: DailyDrill = {
      id: createDrillId(),
      weekPlanId: weekPlan.id,
      skillId: skill.id,
      userId: skill.userId,
      goalId: goal.id,
      questId: quest.id,

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
      componentSkillIds: skill.componentSkillIds,

      // Cross-quest context
      buildsOnQuestIds: skill.prerequisiteQuestIds ?? [],
      reviewSkillId: reviewSkill?.id,
      reviewQuestId: reviewSkill?.questId,

      // Structured sections
      main,
      warmup: undefined,
      stretch: undefined,

      // Legacy fields
      action,
      passSignal,
      lockedVariables: skill.lockedVariables,
      constraint,
      estimatedMinutes,

      // Status
      repeatTomorrow: false,
      isRetry: isRetry ?? false,
      retryCount,

      // Timestamps
      createdAt: now,
      updatedAt: now,

      // Phase 21: Science-Based Learning Fields
      dayType: getDayType(((dayPlan.dayNumber - 1) % 5 + 1) as 1 | 2 | 3 | 4 | 5),
      globalDayNumber: dayPlan.dayNumber,
      prime: (skill as any).prime ?? null,
      primeAnswer: (skill as any).primeAnswer ?? null,
      do: (skill as any).do ?? action,
      givenMaterial: (skill as any).givenMaterial ?? null,
      givenMaterialType: (skill as any).givenMaterialType ?? null,
      done: (skill as any).done ?? passSignal,
      stuck: (skill as any).stuck ?? '',
      unstuck: (skill as any).unstuck ?? '',
      why: (skill as any).why ?? '',
      reflect: (skill as any).reflect ?? '',
      resourceTopics: (skill as any).resourceTopics ?? [],
      resourcePolicy: DAY_TYPE_CONFIGS[getDayType(((dayPlan.dayNumber - 1) % 5 + 1) as 1 | 2 | 3 | 4 | 5)].resourcePolicy,
    };

    return ok(drill);
  }

  /**
   * Determine next skill using roll-forward logic.
   */
  async rollForward(
    previousDrill: DailyDrill | null,
    availableSkills: readonly Skill[],
    weekPlan: WeekPlan
  ): AsyncAppResult<RollForwardResult> {
    if (!previousDrill) {
      // No previous drill - pick first available skill
      const skill = availableSkills[0];
      if (!skill) {
        return err(appError('INVALID_INPUT', 'No skills available'));
      }
      return ok({
        skill,
        isRetry: false,
        retryCount: 0,
      });
    }

    const outcome = previousDrill.outcome;

    // No outcome means drill wasn't completed - treat as skipped
    if (!outcome) {
      return this.handleSkippedDrill(previousDrill, availableSkills);
    }

    switch (outcome) {
      case 'pass':
        return this.handlePassedDrill(previousDrill, availableSkills);
      case 'fail':
        return this.handleFailedDrill(previousDrill, availableSkills);
      case 'partial':
        return this.handlePartialDrill(previousDrill, availableSkills);
      case 'skipped':
        return this.handleSkippedDrill(previousDrill, availableSkills);
      default:
        // Unknown outcome - move forward
        return this.handlePassedDrill(previousDrill, availableSkills);
    }
  }

  /**
   * Legacy method for backward compatibility.
   * @deprecated Use rollForward instead
   */
  async analyzeAndRollForward(
    previousDrill: DailyDrill,
    skills: readonly Skill[]
  ): AsyncAppResult<RollForwardResult> {
    return this.rollForward(previousDrill, skills, {} as WeekPlan);
  }

  /**
   * Select the optimal skill for today.
   * 
   * @deprecated The new DailyDrillGenerationContext provides skill directly.
   * This method is kept for backward compatibility with standalone skill selection.
   */
  async selectSkillFromPool(
    availableSkills: readonly Skill[],
    previousDrill: DailyDrill | null,
    weekPlan: WeekPlan
  ): AsyncAppResult<Skill> {
    if (availableSkills.length === 0) {
      return err(appError('INVALID_INPUT', 'No skills available'));
    }

    // Priority 1: Check for retry needed
    if (previousDrill?.outcome && RETRY_OUTCOMES.includes(previousDrill.outcome)) {
      const retrySkill = availableSkills.find(s => s.id === previousDrill.skillId);
      if (retrySkill) {
        return ok(retrySkill);
      }
    }

    // Priority 2: Carry-forward skills from week plan
    const carryForwardIds = weekPlan.carryForwardSkillIds ?? [];
    for (const carryForwardId of carryForwardIds) {
      const skill = availableSkills.find(s => s.id === carryForwardId);
      if (skill && skill.mastery !== 'mastered') {
        return ok(skill);
      }
    }

    // Priority 3: Next unmastered skill in schedule order
    const scheduledSkillIds = weekPlan.scheduledSkillIds ?? [];
    const scheduledUnmastered = scheduledSkillIds
      .map(id => availableSkills.find(s => s.id === id))
      .filter((s): s is Skill => s !== undefined && s.mastery !== 'mastered');

    // Check prerequisites
    for (const skill of scheduledUnmastered) {
      if (this.arePrerequisitesMet(skill, availableSkills)) {
        return ok(skill);
      }
    }

    // Priority 4: Any skill that needs more practice (practicing status)
    const practicing = availableSkills
      .filter((s: Skill) => s.mastery === 'practicing')
      .sort((a: Skill, b: Skill) => a.consecutivePasses - b.consecutivePasses);

    if (practicing.length > 0) {
      return ok(practicing[0]!);
    }

    // Priority 5: First not-started skill with met prerequisites
    const notStarted = availableSkills
      .filter((s: Skill) => s.mastery === 'not_started')
      .sort((a: Skill, b: Skill) => a.order - b.order);

    for (const skill of notStarted) {
      if (this.arePrerequisitesMet(skill, availableSkills)) {
        return ok(skill);
      }
    }

    // Fallback: Any skill
    return ok(availableSkills[0]!);
  }

  /**
   * Adapt a skill for retry after failure.
   */
  async adaptSkillForRetry(
    skill: Skill,
    previousDrill: DailyDrill,
    retryCount: number
  ): AsyncAppResult<{ action: string; passSignal: string; constraint: string }> {
    // Progressive simplification based on retry count
    const simplificationLevel = Math.min(retryCount, MAX_RETRY_COUNT);

    let action = skill.action;
    let passSignal = skill.successSignal;
    let constraint: string;

    switch (simplificationLevel) {
      case 1:
        // First retry: Add explicit guidance
        action = `[Retry] ${action}`;
        passSignal = `Focus on: ${passSignal}`;
        constraint = previousDrill.observation
          ? `Address yesterday's issue: ${this.extractIssue(previousDrill.observation)}`
          : 'Focus on the specific part that caused difficulty yesterday';
        break;

      case 2:
        // Second retry: Reduce scope
        action = `[Simplified] ${this.simplifyAction(action)}`;
        passSignal = `Minimum viable: ${this.simplifyPassSignal(passSignal)}`;
        constraint = 'Complete the core task only — skip optional elements';
        break;

      case 3:
      default:
        // Third+ retry: Break into smaller piece
        action = `[Foundation] ${this.extractFoundation(action)}`;
        passSignal = 'Make any visible progress on the core concept';
        constraint = 'Just start — any progress counts. Consider asking for help.';
        break;
    }

    return ok({ action, passSignal, constraint });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ROLL-FORWARD HANDLERS
  // ─────────────────────────────────────────────────────────────────────────────

  private async handlePassedDrill(
    previousDrill: DailyDrill,
    skills: readonly Skill[]
  ): AsyncAppResult<RollForwardResult> {
    // Find next skill in sequence
    const skillIndex = skills.findIndex(s => s.id === previousDrill.skillId);
    const nextSkill = skillIndex >= 0 && skillIndex < skills.length - 1
      ? skills[skillIndex + 1]
      : skills.find(s => s.mastery === 'not_started' || s.mastery === 'attempting');

    const skill = nextSkill ?? skills[0];
    if (!skill) {
      return err(appError('INVALID_INPUT', 'No skills available'));
    }

    return ok({
      skill,
      isRetry: false,
      retryCount: 0,
      carryForwardContext: previousDrill.observation
        ? `Previous: ${previousDrill.observation}`
        : 'Previous drill completed successfully',
    });
  }

  private async handleFailedDrill(
    previousDrill: DailyDrill,
    skills: readonly Skill[]
  ): AsyncAppResult<RollForwardResult> {
    const skill = skills.find(s => s.id === previousDrill.skillId);
    if (!skill) {
      return err(appError('INVALID_INPUT', 'Failed drill skill not found'));
    }

    return ok({
      skill,
      isRetry: true,
      retryCount: (previousDrill.retryCount ?? 0) + 1,
      previousFailureReason: previousDrill.observation ?? 'Retry needed — focus on what caused difficulty',
      carryForwardContext: previousDrill.observation
        ? `Yesterday's issue: ${previousDrill.observation}`
        : 'Retry needed — focus on what caused difficulty',
    });
  }

  private async handlePartialDrill(
    previousDrill: DailyDrill,
    skills: readonly Skill[]
  ): AsyncAppResult<RollForwardResult> {
    const skill = skills.find(s => s.id === previousDrill.skillId);
    if (!skill) {
      return err(appError('INVALID_INPUT', 'Partial drill skill not found'));
    }

    return ok({
      skill,
      isRetry: true,
      retryCount: previousDrill.retryCount ?? 0, // Don't increment for partial
      carryForwardContext: previousDrill.carryForward
        ?? previousDrill.observation
        ?? 'Continue from previous progress',
    });
  }

  private async handleSkippedDrill(
    previousDrill: DailyDrill,
    skills: readonly Skill[]
  ): AsyncAppResult<RollForwardResult> {
    const skill = skills.find(s => s.id === previousDrill.skillId);
    if (!skill) {
      return err(appError('INVALID_INPUT', 'Skipped drill skill not found'));
    }

    return ok({
      skill,
      isRetry: false, // Fresh start for skipped
      retryCount: 0,
      carryForwardContext: 'Rescheduled from previous day',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPER METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if all prerequisites for a skill are met.
   */
  private arePrerequisitesMet(skill: Skill, allSkills: readonly Skill[]): boolean {
    if (skill.prerequisiteSkillIds.length === 0) {
      return true;
    }

    return skill.prerequisiteSkillIds.every(prereqId => {
      const prereq = allSkills.find(s => s.id === prereqId);
      // Prerequisite is met if skill exists and is at least 'practicing'
      return prereq && (prereq.mastery === 'practicing' || prereq.mastery === 'mastered');
    });
  }

  /**
   * Generate a constraint for the drill.
   */
  private generateConstraint(skill: Skill): string {
    // Use locked variables to form constraint
    if (skill.lockedVariables.length > 0) {
      return skill.lockedVariables[0]!;
    }

    // Default constraint based on difficulty
    switch (skill.difficulty) {
      case 'intro':
        return 'Focus on accuracy over speed';
      case 'practice':
        return 'Apply without looking up references';
      case 'challenge':
        return 'Complete independently — no assistance';
      case 'synthesis':
        return 'Integrate concepts from multiple areas';
      default:
        return 'Complete in single session';
    }
  }

  /**
   * Extract the key issue from observation text.
   */
  private extractIssue(observation: string): string {
    // Take first sentence or first 100 chars
    const firstSentence = observation.split(/[.!?]/)[0] ?? observation;
    return firstSentence.slice(0, 100).trim();
  }

  /**
   * Simplify an action for retry.
   */
  private simplifyAction(action: string): string {
    // Remove part markers if present
    const cleaned = action.replace(/\[Part \d+\/\d+\]\s*/g, '');
    // Remove retry markers
    const withoutRetry = cleaned.replace(/\[Retry\]\s*/g, '');
    // Take first clause
    const firstClause = withoutRetry.split(/[,;]/)[0] ?? withoutRetry;
    return firstClause.trim();
  }

  /**
   * Simplify a pass signal for retry.
   */
  private simplifyPassSignal(passSignal: string): string {
    // Remove "Completed:" prefix if present
    const cleaned = passSignal.replace(/^Completed:\s*/i, '');
    // Take first clause
    const firstClause = cleaned.split(/[,;]/)[0] ?? cleaned;
    return firstClause.trim();
  }

  /**
   * Extract the foundation from an action.
   */
  private extractFoundation(action: string): string {
    // Look for the core verb + first object
    const words = action.split(/\s+/);
    // Take verb + first 3-4 words
    return words.slice(0, 5).join(' ');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a DrillGenerator instance.
 */
export function createDrillGenerator(config?: DrillGeneratorConfig): DrillGenerator {
  return new DrillGenerator(config);
}
