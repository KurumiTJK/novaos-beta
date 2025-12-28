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
import type { SkillId, DrillId, Timestamp } from '../../types/branded.js';
import { createDrillId, createTimestamp } from '../../types/branded.js';
import type {
  Skill,
  DailyDrill,
  DrillOutcome,
  DrillStatus,
} from './types.js';
import { RETRY_OUTCOMES, countsAsAttempt } from './types.js';
import type {
  IDrillGenerator,
  DrillGenerationContext,
  RollForwardResult,
} from './interfaces.js';

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
  async generate(context: DrillGenerationContext): AsyncAppResult<DailyDrill> {
    const { userId, goalId, weekPlan, availableSkills, previousDrill, date, dayNumber, dailyMinutes } = context;

    if (availableSkills.length === 0) {
      return err(appError('INVALID_INPUT', 'No skills available for drill generation'));
    }

    // Analyze previous drill for roll-forward
    let rollForward: RollForwardResult | null = null;
    if (previousDrill) {
      const rfResult = await this.analyzeAndRollForward(previousDrill, availableSkills);
      if (rfResult.ok) {
        rollForward = rfResult.value;
      }
    }

    // Select skill for today
    const skillResult = await this.selectSkill(context);
    if (!skillResult.ok) {
      return err(skillResult.error);
    }
    const skill = skillResult.value;

    // Determine if this is a retry
    const isRetry = rollForward?.repeatSkill && rollForward.nextSkillId === skill.id;
    const retryCount = isRetry ? (rollForward?.retryCount ?? 0) : 0;

    // Generate drill content
    let action = skill.action;
    let passSignal = skill.successSignal;
    let constraint = this.generateConstraint(skill);
    let estimatedMinutes = skill.estimatedMinutes;

    // Adapt for retry if needed
    if (isRetry && retryCount > 0) {
      const adapted = await this.adaptSkillForRetry(skill, previousDrill!, retryCount);
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

    const drill: DailyDrill = {
      id: createDrillId(),
      weekPlanId: weekPlan.id,
      skillId: skill.id,
      userId,
      goalId,
      scheduledDate: date,
      dayNumber,
      status: 'scheduled' as DrillStatus,
      action,
      passSignal,
      lockedVariables: skill.lockedVariables,
      constraint,
      estimatedMinutes,
      repeatTomorrow: false,
      previousDrillId: previousDrill?.id,
      continuationContext: rollForward?.carryForward,
      isRetry,
      retryCount,
      createdAt: now,
      updatedAt: now,
    };

    return ok(drill);
  }

  /**
   * Analyze previous drill and determine next action.
   */
  async analyzeAndRollForward(
    previousDrill: DailyDrill,
    skills: readonly Skill[]
  ): AsyncAppResult<RollForwardResult> {
    const outcome = previousDrill.outcome;

    // No outcome means drill wasn't completed - treat as skipped
    if (!outcome) {
      return this.handleSkippedDrill(previousDrill, skills);
    }

    switch (outcome) {
      case 'pass':
        return this.handlePassedDrill(previousDrill, skills);
      case 'fail':
        return this.handleFailedDrill(previousDrill, skills);
      case 'partial':
        return this.handlePartialDrill(previousDrill, skills);
      case 'skipped':
        return this.handleSkippedDrill(previousDrill, skills);
      default:
        // Unknown outcome - move forward
        return this.handlePassedDrill(previousDrill, skills);
    }
  }

  /**
   * Select the optimal skill for today.
   */
  async selectSkill(context: DrillGenerationContext): AsyncAppResult<Skill> {
    const { availableSkills, previousDrill, weekPlan } = context;

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
    for (const carryForwardId of weekPlan.carryForwardSkillIds) {
      const skill = availableSkills.find(s => s.id === carryForwardId);
      if (skill && skill.mastery !== 'mastered') {
        return ok(skill);
      }
    }

    // Priority 3: Next unmastered skill in schedule order
    const scheduledUnmastered = weekPlan.scheduledSkillIds
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
      .filter(s => s.mastery === 'practicing')
      .sort((a, b) => a.consecutivePasses - b.consecutivePasses);

    if (practicing.length > 0) {
      return ok(practicing[0]!);
    }

    // Priority 5: First not-started skill with met prerequisites
    const notStarted = availableSkills
      .filter(s => s.mastery === 'not_started')
      .sort((a, b) => a.order - b.order);

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
    const currentSkill = skills.find(s => s.id === previousDrill.skillId);
    const currentOrder = currentSkill?.order ?? 0;

    const nextSkill = skills
      .filter(s => s.order > currentOrder && s.mastery !== 'mastered')
      .sort((a, b) => a.order - b.order)[0];

    return ok({
      repeatSkill: false,
      carryForward: previousDrill.observation
        ? `Previous: ${previousDrill.observation}`
        : 'Previous drill completed successfully',
      nextSkillId: nextSkill?.id ?? previousDrill.skillId,
      retryCount: 0,
    });
  }

  private async handleFailedDrill(
    previousDrill: DailyDrill,
    _skills: readonly Skill[]
  ): AsyncAppResult<RollForwardResult> {
    return ok({
      repeatSkill: true,
      adaptation: 'Retry with additional guidance based on yesterday\'s attempt',
      carryForward: previousDrill.observation
        ? `Yesterday's issue: ${previousDrill.observation}`
        : 'Retry needed — focus on what caused difficulty',
      nextSkillId: previousDrill.skillId,
      retryCount: previousDrill.retryCount + 1,
    });
  }

  private async handlePartialDrill(
    previousDrill: DailyDrill,
    _skills: readonly Skill[]
  ): AsyncAppResult<RollForwardResult> {
    return ok({
      repeatSkill: true,
      adaptation: 'Continue from where you left off',
      carryForward: previousDrill.carryForward
        ?? previousDrill.observation
        ?? 'Continue from previous progress',
      nextSkillId: previousDrill.skillId,
      retryCount: previousDrill.retryCount, // Don't increment for partial
    });
  }

  private async handleSkippedDrill(
    previousDrill: DailyDrill,
    _skills: readonly Skill[]
  ): AsyncAppResult<RollForwardResult> {
    return ok({
      repeatSkill: true,
      carryForward: 'Rescheduled from previous day',
      nextSkillId: previousDrill.skillId,
      retryCount: 0, // Fresh start for skipped
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
      case 'foundation':
        return 'Focus on accuracy over speed';
      case 'practice':
        return 'Apply without looking up references';
      case 'challenge':
        return 'Complete independently — no assistance';
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
