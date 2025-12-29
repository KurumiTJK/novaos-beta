// ═══════════════════════════════════════════════════════════════════════════════
// SKILL DECOMPOSER — CapabilityStage → Skills Transformation
// NovaOS Deliberate Practice Engine — Phase 18: Core Engine
// ═══════════════════════════════════════════════════════════════════════════════
//
// Decomposes Quest capability stages into actionable, time-bounded Skills.
//
// The transformation ensures:
//   - Each skill is verb-first and actionable
//   - Each skill has a binary pass/fail signal
//   - Each skill fits the daily time budget
//   - The resilience layer (adversarial, failure, recovery) is preserved
//   - Prerequisites establish correct sequencing
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { AsyncAppResult } from '../../types/result.js';
import { ok, err, appError } from '../../types/result.js';
import type { SkillId, QuestId, GoalId, UserId, Timestamp } from '../../types/branded.js';
import { createSkillId, createTimestamp } from '../../types/branded.js';
import type { CapabilityStage } from '../../gates/sword/capability-generator.js';
import type {
  Skill,
  SkillDifficulty,
  SkillMastery,
  SkillType,
  SkillStatus,
} from './types.js';
import type {
  ISkillDecomposer,
  SkillDecompositionContext,
  SkillDecompositionResult,
} from './interfaces.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Maximum minutes per skill (hard cap).
 * Skills exceeding this will be split.
 */
const MAX_SKILL_MINUTES = 60;

/**
 * Minimum minutes per skill (to avoid trivial tasks).
 */
const MIN_SKILL_MINUTES = 5;

/**
 * Default time estimate when not specified.
 */
const DEFAULT_SKILL_MINUTES = 25;

/**
 * Action verbs that indicate skill is properly actionable.
 */
const ACTION_VERBS = [
  'create', 'build', 'write', 'implement', 'design', 'develop',
  'configure', 'setup', 'install', 'deploy', 'test', 'debug',
  'refactor', 'optimize', 'profile', 'analyze', 'document',
  'explain', 'demonstrate', 'present', 'teach', 'review',
  'fix', 'modify', 'adapt', 'extend', 'integrate', 'connect',
  'validate', 'verify', 'measure', 'evaluate', 'compare',
  'research', 'explore', 'investigate', 'identify', 'discover',
  'practice', 'rehearse', 'drill', 'exercise', 'apply',
  'master', 'complete', 'finish', 'deliver', 'ship',
];

/**
 * Map stage index (0-4) to difficulty tier.
 */
const STAGE_DIFFICULTY_MAP: Record<number, SkillDifficulty> = {
  0: 'intro',     // REPRODUCE
  1: 'intro',     // MODIFY
  2: 'practice',  // DIAGNOSE
  3: 'practice',  // DESIGN
  4: 'challenge', // SHIP
};

// ═══════════════════════════════════════════════════════════════════════════════
// SKILL DECOMPOSER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Configuration for SkillDecomposer.
 */
export interface SkillDecomposerConfig {
  /** OpenAI API key for LLM-powered decomposition */
  openaiApiKey?: string;
  /** Model to use (default: gpt-4o-mini) */
  model?: string;
  /** Whether to use LLM for smart decomposition */
  useLLM?: boolean;
}

/**
 * Decomposes Quest capability stages into actionable Skills.
 *
 * The decomposer:
 *   - Extracts action, successSignal, lockedVariables from each stage
 *   - Ensures each skill fits the daily time budget
 *   - Preserves the resilience layer (adversarialElement, failureMode, etc.)
 *   - Establishes prerequisite chains
 */
export class SkillDecomposer implements ISkillDecomposer {
  private readonly config: SkillDecomposerConfig;

  constructor(config: SkillDecomposerConfig = {}) {
    this.config = {
      useLLM: false, // Default to rule-based for reliability
      model: 'gpt-4o-mini',
      ...config,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Decompose a quest's capability stages into skills.
   */
  async decompose(context: SkillDecompositionContext): AsyncAppResult<SkillDecompositionResult> {
    const { quest, goal, stages, dailyMinutes, userId } = context;

    if (stages.length === 0) {
      return err(appError('INVALID_INPUT', 'No capability stages provided for decomposition'));
    }

    const skills: Skill[] = [];
    const warnings: string[] = [];
    let globalOrder = 1;

    // Process each stage
    for (let stageIndex = 0; stageIndex < stages.length; stageIndex++) {
      const stage = stages[stageIndex]!;

      // Decompose stage into one or more skills
      const stageSkills = await this.decomposeStage(
        stage,
        stageIndex,
        quest.id,
        goal.id,
        userId,
        dailyMinutes,
        globalOrder
      );

      if (!stageSkills.ok) {
        warnings.push(`Stage ${stageIndex + 1} (${stage.title}): ${stageSkills.error.message}`);
        continue;
      }

      for (const skill of stageSkills.value) {
        skills.push(skill);
        globalOrder++;
      }
    }

    if (skills.length === 0) {
      return err(appError('PROCESSING_ERROR', 'No skills could be generated from stages'));
    }

    // Link prerequisites (each skill depends on the previous one within the same stage)
    const linkedSkills = this.linkPrerequisites(skills);

    // Calculate totals
    const totalMinutes = linkedSkills.reduce((sum, s) => sum + s.estimatedMinutes, 0);
    const estimatedDays = Math.ceil(totalMinutes / dailyMinutes);

    return ok({
      skills: linkedSkills,
      totalMinutes,
      estimatedDays,
      warnings,
    });
  }

  /**
   * Validate a skill meets all requirements.
   */
  validateSkill(skill: Skill, dailyMinutes: number): string | undefined {
    // Check action is verb-first
    if (!this.startsWithActionVerb(skill.action)) {
      return `Skill action must start with an action verb. Got: "${skill.action.substring(0, 30)}..."`;
    }

    // Check success signal exists
    if (!skill.successSignal || skill.successSignal.trim().length < 10) {
      return 'Skill must have a clear success signal (at least 10 characters)';
    }

    // Check locked variables exist
    if (!skill.lockedVariables || skill.lockedVariables.length === 0) {
      return 'Skill must have at least one locked variable for clean feedback';
    }

    // Check time fits budget
    if (skill.estimatedMinutes > dailyMinutes) {
      return `Skill exceeds daily time budget (${skill.estimatedMinutes} > ${dailyMinutes} minutes)`;
    }

    if (skill.estimatedMinutes < MIN_SKILL_MINUTES) {
      return `Skill is too short (${skill.estimatedMinutes} < ${MIN_SKILL_MINUTES} minutes)`;
    }

    return undefined;
  }

  /**
   * Split a skill that exceeds time budget into smaller skills.
   */
  async splitSkill(skill: Skill, dailyMinutes: number): AsyncAppResult<Skill[]> {
    if (skill.estimatedMinutes <= dailyMinutes) {
      return ok([skill]);
    }

    // Calculate number of parts needed
    const partsNeeded = Math.ceil(skill.estimatedMinutes / dailyMinutes);
    const timePerPart = Math.ceil(skill.estimatedMinutes / partsNeeded);

    const splitSkills: Skill[] = [];
    const now = createTimestamp();

    for (let i = 0; i < partsNeeded; i++) {
      const partNumber = i + 1;
      const isLast = partNumber === partsNeeded;

      // Create part-specific action
      const partAction = this.createPartAction(skill.action, partNumber, partsNeeded);
      const partSignal = isLast
        ? skill.successSignal
        : `Part ${partNumber} checkpoint: Progress documented for continuation`;

      const partSkill: Skill = {
        id: createSkillId(),
        questId: skill.questId,
        goalId: skill.goalId,
        userId: skill.userId,
        // Core definition
        title: `${skill.title ?? skill.action.slice(0, 30)} (Part ${partNumber})`,
        topic: skill.topic ?? skill.sourceStageTitle ?? 'General',
        action: partAction,
        successSignal: partSignal,
        lockedVariables: skill.lockedVariables,
        estimatedMinutes: Math.min(timePerPart, dailyMinutes),
        // Skill tree structure
        skillType: skill.skillType ?? 'foundation',
        depth: skill.depth ?? 0,
        prerequisiteSkillIds: i === 0 ? skill.prerequisiteSkillIds : [splitSkills[i - 1]!.id],
        prerequisiteQuestIds: skill.prerequisiteQuestIds ?? [],
        isCompound: false,
        // Scheduling
        weekNumber: skill.weekNumber ?? 1,
        dayInWeek: skill.dayInWeek ?? 1,
        dayInQuest: skill.dayInQuest ?? (skill.order + i),
        difficulty: skill.difficulty,
        order: skill.order + i,
        // Mastery tracking
        mastery: 'not_started',
        status: i === 0 ? (skill.status ?? 'available') : 'locked',
        passCount: 0,
        failCount: 0,
        consecutivePasses: 0,
        // Resilience layer only on last part (where the full skill is tested)
        adversarialElement: isLast ? skill.adversarialElement : undefined,
        failureMode: isLast ? skill.failureMode : undefined,
        recoverySteps: isLast ? skill.recoverySteps : undefined,
        transferScenario: isLast ? skill.transferScenario : undefined,
        sourceStageTitle: skill.sourceStageTitle,
        sourceStageIndex: skill.sourceStageIndex,
        topics: skill.topics,
        createdAt: now,
        updatedAt: now,
      };

      splitSkills.push(partSkill);
    }

    return ok(splitSkills);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Decompose a single capability stage into skills.
   */
  private async decomposeStage(
    stage: CapabilityStage,
    stageIndex: number,
    questId: QuestId,
    goalId: GoalId,
    userId: UserId,
    dailyMinutes: number,
    startOrder: number
  ): AsyncAppResult<Skill[]> {
    const now = createTimestamp();
    const difficulty = STAGE_DIFFICULTY_MAP[stageIndex] ?? 'practice';

    // Estimate time based on stage complexity (default to intermediate level)
    const baseMinutes = this.estimateStageMinutes(stage, 'intermediate');

    // Create the primary skill from the stage
    const primarySkill = this.createSkillFromStage(
      stage,
      stageIndex,
      questId,
      goalId,
      userId,
      difficulty,
      startOrder,
      baseMinutes,
      now
    );

    // Validate the skill
    const validationError = this.validateSkill(primarySkill, dailyMinutes);
    if (validationError) {
      // Try to fix by splitting
      if (primarySkill.estimatedMinutes > dailyMinutes) {
        return this.splitSkill(primarySkill, dailyMinutes);
      }
      return err(appError('VALIDATION_ERROR', validationError));
    }

    // Check if skill needs splitting
    if (primarySkill.estimatedMinutes > dailyMinutes) {
      return this.splitSkill(primarySkill, dailyMinutes);
    }

    return ok([primarySkill]);
  }

  /**
   * Create a Skill from a CapabilityStage.
   */
  private createSkillFromStage(
    stage: CapabilityStage,
    stageIndex: number,
    questId: QuestId,
    goalId: GoalId,
    userId: UserId,
    difficulty: SkillDifficulty,
    order: number,
    estimatedMinutes: number,
    timestamp: Timestamp
  ): Skill {
    // Transform capability into action (ensure verb-first)
    const action = this.capabilityToAction(stage.capability);

    // Transform artifact into success signal
    const successSignal = this.artifactToSuccessSignal(stage.artifact);

    // Extract locked variables from the stage context
    const lockedVariables = this.extractLockedVariables(stage);

    return {
      id: createSkillId(),
      questId,
      goalId,
      userId,
      // Core definition
      title: stage.title,
      topic: stage.topics?.[0] ?? stage.title,
      action,
      successSignal,
      lockedVariables,
      estimatedMinutes,
      // Skill tree structure
      skillType: 'foundation' as const,
      depth: 0,
      prerequisiteSkillIds: [],
      prerequisiteQuestIds: [],
      isCompound: false,
      // Scheduling
      weekNumber: 1,
      dayInWeek: ((order - 1) % 5) + 1,
      dayInQuest: order,
      difficulty,
      order,
      // Mastery tracking
      mastery: 'not_started' as SkillMastery,
      status: 'available' as const,
      passCount: 0,
      failCount: 0,
      consecutivePasses: 0,
      // Resilience layer from CapabilityStage
      adversarialElement: stage.designedFailure,
      failureMode: stage.consequence,
      recoverySteps: stage.recovery,
      transferScenario: stage.transfer,
      sourceStageTitle: stage.title,
      sourceStageIndex: stageIndex + 1, // 1-based for display
      topics: stage.topics,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  /**
   * Transform capability statement into action (verb-first).
   */
  private capabilityToAction(capability: string): string {
    // If already starts with action verb, return as-is
    if (this.startsWithActionVerb(capability)) {
      return capability;
    }

    // Try to extract the action from common patterns
    // Pattern: "Can X" or "Able to X"
    const canPattern = /^(?:can|able to)\s+(.+)$/i;
    const canMatch = capability.match(canPattern);
    if (canMatch) {
      const action = canMatch[1]!.trim();
      // Capitalize first letter and ensure it starts with verb
      return action.charAt(0).toUpperCase() + action.slice(1);
    }

    // Pattern: "X something" where X is already a verb
    const words = capability.split(/\s+/);
    if (words.length > 0) {
      const firstWord = words[0]!.toLowerCase();
      // Check if first word is a verb (even if not in our list)
      if (firstWord.endsWith('e') || firstWord.endsWith('y') || firstWord.endsWith('t')) {
        return capability.charAt(0).toUpperCase() + capability.slice(1);
      }
    }

    // Default: prepend "Complete" or "Practice"
    return `Practice: ${capability}`;
  }

  /**
   * Transform artifact into success signal.
   */
  private artifactToSuccessSignal(artifact: string): string {
    // Remove leading articles
    const cleaned = artifact.replace(/^(?:a|an|the)\s+/i, '');

    // Check if already describes completion
    if (/^(?:completed?|finished?|working|functional|tested)/i.test(cleaned)) {
      return cleaned;
    }

    // Frame as completion check
    return `Completed: ${cleaned}`;
  }

  /**
   * Extract locked variables from stage context.
   */
  private extractLockedVariables(stage: CapabilityStage): readonly string[] {
    const locked: string[] = [];

    // Default locked variable: don't change the approach mid-exercise
    locked.push("Don't switch approach mid-exercise");

    // If there's a designed failure, lock around it
    if (stage.designedFailure) {
      // Extract what NOT to do from the failure scenario
      if (stage.designedFailure.toLowerCase().includes('without')) {
        const afterWithout = stage.designedFailure.split(/without/i)[1];
        if (afterWithout) {
          locked.push(`Ensure: ${afterWithout.trim()}`);
        }
      }
    }

    // Add time constraint
    locked.push("Complete in single session");

    return locked;
  }

  /**
   * Estimate time for a stage based on complexity and user level.
   */
  private estimateStageMinutes(
    stage: CapabilityStage,
    userLevel: 'beginner' | 'intermediate' | 'advanced'
  ): number {
    // Base estimate from capability length and complexity
    const capabilityWords = stage.capability.split(/\s+/).length;
    const artifactWords = stage.artifact.split(/\s+/).length;
    const complexityScore = capabilityWords + artifactWords;

    // Base time: 15-45 minutes depending on complexity
    let baseMinutes = Math.min(45, Math.max(15, complexityScore * 2));

    // Adjust for user level
    const levelMultiplier = {
      beginner: 1.5,
      intermediate: 1.0,
      advanced: 0.75,
    }[userLevel];

    const adjusted = Math.round(baseMinutes * levelMultiplier);

    // Clamp to valid range
    return Math.min(MAX_SKILL_MINUTES, Math.max(MIN_SKILL_MINUTES, adjusted));
  }

  /**
   * Check if a string starts with an action verb.
   */
  private startsWithActionVerb(text: string): boolean {
    const firstWord = text.split(/\s+/)[0]?.toLowerCase() ?? '';
    return ACTION_VERBS.some(verb => firstWord === verb || firstWord.startsWith(verb));
  }

  /**
   * Create a part-specific action for split skills.
   */
  private createPartAction(originalAction: string, partNumber: number, totalParts: number): string {
    const partLabel = `[Part ${partNumber}/${totalParts}]`;

    if (partNumber === 1) {
      return `${partLabel} Begin: ${originalAction}`;
    } else if (partNumber === totalParts) {
      return `${partLabel} Complete: ${originalAction}`;
    } else {
      return `${partLabel} Continue: ${originalAction}`;
    }
  }

  /**
   * Link skills with prerequisite relationships.
   * Skills within the same stage form a chain.
   */
  private linkPrerequisites(skills: Skill[]): Skill[] {
    if (skills.length <= 1) {
      return skills;
    }

    const linked: Skill[] = [];

    for (let i = 0; i < skills.length; i++) {
      const skill = skills[i]!;

      if (i === 0) {
        // First skill has no prerequisites
        linked.push(skill);
      } else {
        const previousSkill = linked[i - 1]!;

        // Only link if same stage or consecutive stages
        const sameStage = skill.sourceStageIndex === previousSkill.sourceStageIndex;
        const consecutiveStage = skill.sourceStageIndex === (previousSkill.sourceStageIndex ?? 0) + 1;

        if (sameStage || consecutiveStage) {
          linked.push({
            ...skill,
            prerequisiteSkillIds: [previousSkill.id],
          });
        } else {
          linked.push(skill);
        }
      }
    }

    return linked;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a SkillDecomposer instance.
 */
export function createSkillDecomposer(config?: SkillDecomposerConfig): SkillDecomposer {
  return new SkillDecomposer(config);
}
