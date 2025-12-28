// ═══════════════════════════════════════════════════════════════════════════════
// SWORD GATE HOOK — Deliberate Practice Integration
// NovaOS Deliberate Practice Engine — Phase 18: SwordGate Integration
// ═══════════════════════════════════════════════════════════════════════════════
//
// This hook integrates the SwordGate goal creation flow with the
// Deliberate Practice Engine:
//
// 1. After goal/quests created → intercept
// 2. Get capability stages for each quest
// 3. Decompose into skills via DeliberatePracticeEngine
// 4. Initialize learning plan and week plans
//
// Integration Strategy:
//   - Non-invasive: Wraps existing SwordGate behavior
//   - Fail-safe: If decomposition fails, original flow continues
//   - Async: Skill decomposition happens after response to user
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { AsyncAppResult } from '../../types/result.js';
import { ok, err, appError, isOk } from '../../types/result.js';
import type { GoalId, QuestId, UserId } from '../../types/branded.js';
import type { Goal, Quest } from '../../services/spark-engine/types.js';
import type { CapabilityStage } from './capability-generator.js';
import { CapabilityGenerator, createCapabilityGenerator } from './capability-generator.js';
import type { IDeliberatePracticeEngine, IDeliberatePracticeStores } from '../../services/deliberate-practice-engine/interfaces.js';
import type { LearningPlan } from '../../services/deliberate-practice-engine/types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Result of skill decomposition for a goal.
 */
export interface SkillDecompositionResult {
  /** Goal ID */
  readonly goalId: GoalId;

  /** Total skills generated */
  readonly totalSkills: number;

  /** Skills per quest */
  readonly skillsByQuest: ReadonlyMap<QuestId, number>;

  /** Learning plan created */
  readonly learningPlan: LearningPlan | null;

  /** Warnings during decomposition */
  readonly warnings: readonly string[];

  /** Whether decomposition was successful */
  readonly success: boolean;
}

/**
 * Configuration for SwordGateHook.
 */
export interface SwordGateHookConfig {
  /** Whether to enable skill decomposition */
  enabled?: boolean;
  /** OpenAI API key for capability generation */
  openaiApiKey?: string;
  /** User level for skill time estimates */
  defaultUserLevel?: 'beginner' | 'intermediate' | 'advanced';
  /** Default daily time budget */
  defaultDailyMinutes?: number;
  /** Whether to fail silently if decomposition fails */
  failSilently?: boolean;
}

/**
 * Dependencies for SwordGateHook.
 */
export interface SwordGateHookDependencies {
  /** Deliberate Practice Engine */
  practiceEngine: IDeliberatePracticeEngine;
  /** Stores for direct access if needed */
  stores?: IDeliberatePracticeStores;
  /** Configuration */
  config?: SwordGateHookConfig;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SWORD GATE HOOK
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SwordGateHook — Integrates SwordGate with Deliberate Practice.
 *
 * Call `onGoalCreated()` after SwordGate creates a goal and quests
 * to trigger skill decomposition.
 */
export class SwordGateHook {
  private readonly practiceEngine: IDeliberatePracticeEngine;
  private readonly capabilityGenerator: CapabilityGenerator;
  private readonly config: Required<SwordGateHookConfig>;

  constructor(deps: SwordGateHookDependencies) {
    this.practiceEngine = deps.practiceEngine;

    this.config = {
      enabled: deps.config?.enabled ?? true,
      openaiApiKey: deps.config?.openaiApiKey ?? '',
      defaultUserLevel: deps.config?.defaultUserLevel ?? 'intermediate',
      defaultDailyMinutes: deps.config?.defaultDailyMinutes ?? 30,
      failSilently: deps.config?.failSilently ?? true,
    };

    this.capabilityGenerator = createCapabilityGenerator({
      openaiApiKey: this.config.openaiApiKey,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN HOOK
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Hook called after goal and quests are created.
   *
   * Triggers skill decomposition for the new goal.
   *
   * @param goal - The created goal
   * @param quests - The created quests
   * @returns Result of skill decomposition
   */
  async onGoalCreated(
    goal: Goal,
    quests: readonly Quest[]
  ): AsyncAppResult<SkillDecompositionResult> {
    if (!this.config.enabled) {
      return ok({
        goalId: goal.id,
        totalSkills: 0,
        skillsByQuest: new Map(),
        learningPlan: null,
        warnings: ['Skill decomposition disabled'],
        success: true,
      });
    }

    if (quests.length === 0) {
      return ok({
        goalId: goal.id,
        totalSkills: 0,
        skillsByQuest: new Map(),
        learningPlan: null,
        warnings: ['No quests to decompose'],
        success: true,
      });
    }

    try {
      return await this.decomposeGoal(goal, quests);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[SWORD_GATE_HOOK] Decomposition error:', errorMessage);

      if (this.config.failSilently) {
        return ok({
          goalId: goal.id,
          totalSkills: 0,
          skillsByQuest: new Map(),
          learningPlan: null,
          warnings: [`Decomposition failed: ${errorMessage}`],
          success: false,
        });
      }

      return err(appError('PROCESSING_ERROR', `Skill decomposition failed: ${errorMessage}`));
    }
  }

  /**
   * Hook for async decomposition (fire and forget).
   *
   * Use this when you don't want to block the response to the user.
   */
  async onGoalCreatedAsync(
    goal: Goal,
    quests: readonly Quest[]
  ): Promise<void> {
    // Fire and forget - don't await
    this.onGoalCreated(goal, quests)
      .then(result => {
        if (isOk(result)) {
          console.log(
            `[SWORD_GATE_HOOK] Decomposition complete: ${result.value.totalSkills} skills`
          );
        }
      })
      .catch(error => {
        console.error('[SWORD_GATE_HOOK] Async decomposition error:', error);
      });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DECOMPOSITION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Decompose a goal into skills.
   */
  private async decomposeGoal(
    goal: Goal,
    quests: readonly Quest[]
  ): AsyncAppResult<SkillDecompositionResult> {
    const warnings: string[] = [];
    const stagesByQuest = new Map<QuestId, readonly CapabilityStage[]>();

    // Generate capability stages for each quest
    for (const quest of quests) {
      const stagesResult = await this.generateStagesForQuest(quest, goal);
      
      if (isOk(stagesResult)) {
        stagesByQuest.set(quest.id, stagesResult.value);
      } else {
        warnings.push(`Quest "${quest.title}": ${stagesResult.error.message}`);
      }
    }

    if (stagesByQuest.size === 0) {
      return ok({
        goalId: goal.id,
        totalSkills: 0,
        skillsByQuest: new Map(),
        learningPlan: null,
        warnings: [...warnings, 'No capability stages generated'],
        success: false,
      });
    }

    // Initialize learning plan via Deliberate Practice Engine
    const planResult = await this.practiceEngine.initializePlan(
      goal,
      quests,
      stagesByQuest
    );

    if (!isOk(planResult)) {
      return ok({
        goalId: goal.id,
        totalSkills: 0,
        skillsByQuest: new Map(),
        learningPlan: null,
        warnings: [...warnings, `Learning plan failed: ${planResult.error.message}`],
        success: false,
      });
    }

    const learningPlan = planResult.value;

    // Calculate skills per quest
    const skillsByQuest = new Map<QuestId, number>();
    for (const mapping of learningPlan.questSkillMapping) {
      skillsByQuest.set(mapping.questId, mapping.skillCount);
    }

    return ok({
      goalId: goal.id,
      totalSkills: learningPlan.totalSkills,
      skillsByQuest,
      learningPlan,
      warnings,
      success: true,
    });
  }

  /**
   * Generate capability stages for a quest.
   */
  private async generateStagesForQuest(
    quest: Quest,
    goal: Goal
  ): AsyncAppResult<readonly CapabilityStage[]> {
    // Extract topic from quest title
    const topic = this.extractTopic(quest, goal);

    // Get user level from goal config
    const userLevel = goal.learningConfig?.userLevel ?? this.config.defaultUserLevel;

    // Calculate duration based on quest's estimated days
    const durationDays = quest.estimatedDays ?? 7;

    // Generate capability stages
    const stagesResult = await this.capabilityGenerator.generate(
      topic,
      userLevel,
      durationDays
    );

    return stagesResult;
  }

  /**
   * Extract topic from quest and goal.
   */
  private extractTopic(quest: Quest, goal: Goal): string {
    // Try to extract meaningful topic from quest title
    // Remove common prefixes like "Week 1:", "Phase 1:", etc.
    const cleanedTitle = quest.title
      .replace(/^(week|phase|part|section|module)\s*\d+\s*[:\-–—]\s*/i, '')
      .trim();

    // If cleaned title is too short, use goal title + quest title
    if (cleanedTitle.length < 5) {
      return `${goal.title} - ${quest.title}`;
    }

    return cleanedTitle;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if a goal has been decomposed.
   */
  async hasBeenDecomposed(goalId: GoalId): AsyncAppResult<boolean> {
    const planResult = await this.practiceEngine.getLearningPlan(goalId);
    return ok(isOk(planResult) && planResult.value !== null);
  }

  /**
   * Re-decompose a goal (e.g., after quest changes).
   */
  async redecompose(
    goal: Goal,
    quests: readonly Quest[]
  ): AsyncAppResult<SkillDecompositionResult> {
    // For now, just call the regular decomposition
    // In a full implementation, this would handle cleanup of existing skills
    return this.onGoalCreated(goal, quests);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a SwordGateHook instance.
 */
export function createSwordGateHook(deps: SwordGateHookDependencies): SwordGateHook {
  return new SwordGateHook(deps);
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTEGRATION HELPER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Wrap the SwordGate.createGoalFromProposal result to trigger skill decomposition.
 *
 * Use this in SwordGate after goal creation:
 *
 * ```typescript
 * const createResult = await this.createGoalFromProposal(...);
 * if (createResult.ok && this.swordGateHook) {
 *   await triggerSkillDecomposition(
 *     this.swordGateHook,
 *     createResult.value.goal,
 *     createResult.value.quests
 *   );
 * }
 * ```
 */
export async function triggerSkillDecomposition(
  hook: SwordGateHook,
  goal: Goal,
  quests: readonly Quest[]
): Promise<SkillDecompositionResult | null> {
  const result = await hook.onGoalCreated(goal, quests);
  
  if (isOk(result)) {
    const decomposition = result.value;
    
    if (decomposition.success) {
      console.log(
        `[SKILL_DECOMPOSITION] Goal ${goal.id}: ${decomposition.totalSkills} skills created`
      );
    } else {
      console.warn(
        `[SKILL_DECOMPOSITION] Goal ${goal.id}: Decomposition failed - ${decomposition.warnings.join(', ')}`
      );
    }
    
    return decomposition;
  }
  
  console.error(
    `[SKILL_DECOMPOSITION] Goal ${goal.id}: Error - ${result.error.message}`
  );
  
  return null;
}
