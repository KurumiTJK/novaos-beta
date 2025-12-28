// ═══════════════════════════════════════════════════════════════════════════════
// SKILL TREE GENERATOR — Phase 19B: Tree-Structured Skill Generation
// NovaOS Deliberate Practice Engine
// ═══════════════════════════════════════════════════════════════════════════════
//
// Generates skill trees from CapabilityStages with:
//   - Tree structure (foundation → building → compound → synthesis)
//   - Cross-quest dependencies (skills can depend on ANY previous quest)
//   - Compound skills that explicitly combine multiple skills
//   - Synthesis skill = milestone at end of each quest
//
// KEY DIFFERENCES from Phase 18 SkillDecomposer:
//   - Generates TREE structure, not flat list
//   - Handles CROSS-QUEST dependencies  
//   - Creates COMPOUND and SYNTHESIS skills
//   - Respects quest duration (multi-week)
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { AsyncAppResult } from '../../types/result.js';
import { ok, err, appError } from '../../types/result.js';
import type { SkillId, QuestId, GoalId, UserId, Timestamp } from '../../types/branded.js';
import { createSkillId, createTimestamp } from '../../types/branded.js';
import type { CapabilityStage } from '../../gates/sword/capability-generator.js';
import type {
  Skill,
  SkillType,
  SkillDifficulty,
  SkillStatus,
  SkillMastery,
  QuestDuration,
  QuestMilestone,
  SkillDistribution,
  MilestoneStatus,
} from './types.js';
import {
  DEFAULT_SKILL_DISTRIBUTION,
  createWeeksDuration,
} from './types.js';
import type {
  ISkillTreeGenerator,
  SkillTreeGenerationContext,
  SkillTreeGenerationResult,
} from './interfaces.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Maximum minutes per skill (hard cap).
 */
const MAX_SKILL_MINUTES = 45;

/**
 * Minimum minutes per skill.
 */
const MIN_SKILL_MINUTES = 10;

/**
 * Default time estimate.
 */
const DEFAULT_SKILL_MINUTES = 25;

/**
 * Action verbs that indicate skill is actionable.
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
  'use', 'combine', 'chain', 'filter', 'transform', 'parse',
];

/**
 * Map stage index (0-4) to base difficulty.
 */
const STAGE_TO_DIFFICULTY: Record<number, SkillDifficulty> = {
  0: 'intro',      // REPRODUCE
  1: 'practice',   // MODIFY
  2: 'practice',   // DIAGNOSE
  3: 'challenge',  // DESIGN
  4: 'synthesis',  // SHIP
};

/**
 * Map skill type to depth.
 */
const SKILL_TYPE_DEPTH: Record<SkillType, number> = {
  foundation: 0,
  building: 1,
  compound: 2,
  synthesis: 3,
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Configuration for SkillTreeGenerator.
 */
export interface SkillTreeGeneratorConfig {
  /** OpenAI API key for LLM-powered generation */
  openaiApiKey?: string;
  /** Model to use (default: gpt-4o-mini) */
  model?: string;
  /** Whether to use LLM for smart skill generation */
  useLLM?: boolean;
  /** Maximum retries on LLM failure */
  maxRetries?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SKILL TREE GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generates skill trees from CapabilityStages.
 *
 * The generator creates a tree structure where:
 *   - Foundation skills have no prerequisites within the quest
 *   - Building skills depend on foundations
 *   - Compound skills combine 2+ skills (can span quests)
 *   - Synthesis skill combines everything (the milestone)
 */
export class SkillTreeGenerator implements ISkillTreeGenerator {
  private readonly config: Required<SkillTreeGeneratorConfig>;

  constructor(config: SkillTreeGeneratorConfig = {}) {
    this.config = {
      openaiApiKey: config.openaiApiKey ?? process.env.OPENAI_API_KEY ?? '',
      model: config.model ?? 'gpt-4o-mini',
      useLLM: config.useLLM ?? true,
      maxRetries: config.maxRetries ?? 2,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate a skill tree for a quest.
   */
  async generate(context: SkillTreeGenerationContext): AsyncAppResult<SkillTreeGenerationResult> {
    const {
      quest,
      goal,
      stages,
      duration,
      dailyMinutes,
      userLevel,
      previousQuestSkills,
      distribution = DEFAULT_SKILL_DISTRIBUTION,
    } = context;

    if (stages.length === 0) {
      return err(appError('INVALID_INPUT', 'No capability stages provided'));
    }

    console.log(`[SKILL_TREE] Generating tree for quest "${quest.title}" with ${stages.length} stages`);
    console.log(`[SKILL_TREE] Duration: ${duration.practiceDays} days, ${previousQuestSkills.length} prior skills available`);

    const warnings: string[] = [];
    const now = createTimestamp();

    // Calculate target skill counts based on distribution
    const totalDays = duration.practiceDays;
    const targetCounts = this.calculateTargetCounts(totalDays, distribution);

    console.log(`[SKILL_TREE] Target counts: F=${targetCounts.foundation}, B=${targetCounts.building}, C=${targetCounts.compound}, S=${targetCounts.synthesis}`);

    // ─────────────────────────────────────────────────────────────────────────
    // Step 1: Generate foundation skills (from first 1-2 stages)
    // ─────────────────────────────────────────────────────────────────────────
    const foundationSkills = await this.generateFoundationSkills(
      stages.slice(0, 2),
      context,
      targetCounts.foundation,
      now
    );

    if (!foundationSkills.ok) {
      return err(foundationSkills.error);
    }

    console.log(`[SKILL_TREE] Generated ${foundationSkills.value.length} foundation skills`);

    // ─────────────────────────────────────────────────────────────────────────
    // Step 2: Generate building skills (from middle stages)
    // ─────────────────────────────────────────────────────────────────────────
    const buildingSkills = await this.generateBuildingSkills(
      stages.slice(1, 4),
      context,
      foundationSkills.value,
      targetCounts.building,
      now
    );

    if (!buildingSkills.ok) {
      return err(buildingSkills.error);
    }

    console.log(`[SKILL_TREE] Generated ${buildingSkills.value.length} building skills`);

    // ─────────────────────────────────────────────────────────────────────────
    // Step 3: Generate compound skills (combining foundations + buildings)
    // ─────────────────────────────────────────────────────────────────────────
    const allBaseSkills = [...foundationSkills.value, ...buildingSkills.value];
    const relevantPriorSkills = this.findRelevantPriorSkills(
      quest.topicIds ?? stages.flatMap(s => s.topics),
      previousQuestSkills
    );

    const compoundSkills = await this.generateCompoundSkills(
      stages.slice(2, 5),
      context,
      allBaseSkills,
      relevantPriorSkills,
      targetCounts.compound,
      now
    );

    if (!compoundSkills.ok) {
      return err(compoundSkills.error);
    }

    console.log(`[SKILL_TREE] Generated ${compoundSkills.value.length} compound skills`);

    // ─────────────────────────────────────────────────────────────────────────
    // Step 4: Generate synthesis skill (the milestone)
    // ─────────────────────────────────────────────────────────────────────────
    const allQuestSkills = [...allBaseSkills, ...compoundSkills.value];
    const synthesisResult = await this.createSynthesisSkill(allQuestSkills, context);

    if (!synthesisResult.ok) {
      return err(synthesisResult.error);
    }

    const synthesisSkill = synthesisResult.value;
    console.log(`[SKILL_TREE] Generated synthesis skill: "${synthesisSkill.title}"`);

    // ─────────────────────────────────────────────────────────────────────────
    // Step 5: Assign scheduling (week, day) and finalize
    // ─────────────────────────────────────────────────────────────────────────
    const allSkills = [...allQuestSkills, synthesisSkill];
    const scheduledSkills = this.assignScheduling(allSkills, duration, context);

    // Validate all skills
    for (const skill of scheduledSkills) {
      const validationError = this.validateSkill(skill, dailyMinutes);
      if (validationError) {
        warnings.push(`Skill "${skill.title}": ${validationError}`);
      }
    }

    // Identify cross-quest skills
    const crossQuestSkillIds = scheduledSkills
      .filter(s => s.prerequisiteQuestIds.length > 0 || (s.componentQuestIds?.length ?? 0) > 0)
      .map(s => s.id);

    // Build milestone
    const milestone = this.buildMilestone(synthesisSkill, quest.title, stages);

    // Calculate actual distribution
    const actualDistribution = {
      foundation: foundationSkills.value.length,
      building: buildingSkills.value.length,
      compound: compoundSkills.value.length,
      synthesis: 1,
    };

    return ok({
      skills: scheduledSkills,
      rootSkillIds: foundationSkills.value.map(s => s.id),
      synthesisSkillId: synthesisSkill.id,
      crossQuestSkillIds,
      totalDays: scheduledSkills.length,
      warnings,
      milestone,
      distribution: actualDistribution,
    });
  }

  /**
   * Find relevant skills from previous quests for dependencies.
   */
  findRelevantPriorSkills(
    topics: readonly string[],
    previousSkills: readonly Skill[]
  ): readonly Skill[] {
    if (previousSkills.length === 0) {
      return [];
    }

    const normalizedTopics = new Set(topics.map(t => t.toLowerCase().trim()));
    const relevantSkills: Skill[] = [];

    for (const skill of previousSkills) {
      // Check if skill's topic overlaps with current quest topics
      const skillTopics = skill.topics ?? [skill.topic];
      const hasOverlap = skillTopics.some(st =>
        normalizedTopics.has(st.toLowerCase().trim()) ||
        topics.some(t => st.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(st.toLowerCase()))
      );

      if (hasOverlap) {
        relevantSkills.push(skill);
      }
    }

    // Also include mastered skills that are good for review
    const masteredSkills = previousSkills.filter(s =>
      s.mastery === 'mastered' && !relevantSkills.includes(s)
    );

    // Take up to 5 most relevant mastered skills
    const additionalMastered = masteredSkills.slice(0, 5);

    return [...relevantSkills, ...additionalMastered];
  }

  /**
   * Create compound skill that combines multiple skills.
   */
  async createCompoundSkill(
    componentSkills: readonly Skill[],
    context: SkillTreeGenerationContext
  ): AsyncAppResult<Skill> {
    if (componentSkills.length < 2) {
      return err(appError('INVALID_INPUT', 'Compound skills require at least 2 component skills'));
    }

    const { quest, goal } = context;
    const now = createTimestamp();

    // Determine if this is cross-quest
    const componentQuestIds = [...new Set(componentSkills.map(s => s.questId))];
    const isCrossQuest = componentQuestIds.some(qid => qid !== quest.id);

    // Generate title from component skills
    const componentTitles = componentSkills.slice(0, 2).map(s => s.title);
    const title = `${componentTitles.join(' + ')}`;

    // Generate action that combines the components
    const combinedAction = `Combine ${componentSkills.map(s => s.title.toLowerCase()).join(' and ')} to solve a multi-step problem`;

    // Generate success signal
    const successSignal = `Solution uses all component skills correctly and produces expected output`;

    // Generate combination context
    const combinationContext = componentSkills
      .map(s => `${s.title} (${s.action.split(' ').slice(0, 3).join(' ')}...)`)
      .join(', ');

    // Calculate prerequisites (all component skills)
    const prerequisiteSkillIds = componentSkills.map(s => s.id);
    const prerequisiteQuestIds = [...componentQuestIds];

    // Estimate time (sum of components, capped)
    const estimatedMinutes = Math.min(
      MAX_SKILL_MINUTES,
      componentSkills.reduce((sum, s) => sum + s.estimatedMinutes, 0) * 0.6
    );

    const skill: Skill = {
      id: createSkillId(),
      questId: quest.id,
      goalId: goal.id,
      userId: goal.userId,
      title,
      topic: componentSkills[0]?.topic ?? 'compound',
      action: combinedAction,
      successSignal,
      lockedVariables: ["Don't simplify the problem", "Use all components"],
      estimatedMinutes: Math.round(estimatedMinutes),
      skillType: 'compound',
      depth: SKILL_TYPE_DEPTH.compound,
      prerequisiteSkillIds,
      prerequisiteQuestIds: prerequisiteQuestIds.filter(qid => qid !== quest.id),
      isCompound: true,
      componentSkillIds: prerequisiteSkillIds,
      componentQuestIds: isCrossQuest ? prerequisiteQuestIds : undefined,
      combinationContext,
      weekNumber: 0, // Will be assigned later
      dayInWeek: 0,
      dayInQuest: 0,
      order: 0,
      difficulty: 'challenge',
      mastery: 'not_started',
      status: 'locked',
      passCount: 0,
      failCount: 0,
      consecutivePasses: 0,
      adversarialElement: `Miss one component or use them in isolation instead of combining`,
      failureMode: `Solution doesn't integrate all skills, missing the combined benefit`,
      recoverySteps: `Identify which component is missing or underused, practice that component, then retry the combination`,
      createdAt: now,
      updatedAt: now,
    };

    return ok(skill);
  }

  /**
   * Create synthesis skill (milestone skill) for end of quest.
   */
  async createSynthesisSkill(
    allQuestSkills: readonly Skill[],
    context: SkillTreeGenerationContext
  ): AsyncAppResult<Skill> {
    const { quest, goal, stages } = context;
    const now = createTimestamp();

    // Get the SHIP stage for milestone content
    const shipStage = stages[stages.length - 1];
    if (!shipStage) {
      return err(appError('INVALID_INPUT', 'No stages available for synthesis'));
    }

    // Build title from quest and ship stage
    const title = `Milestone: ${shipStage.title}`;

    // Action from ship stage
    const action = this.capabilityToAction(shipStage.capability);

    // Success signal from artifact
    const successSignal = this.artifactToSuccessSignal(shipStage.artifact);

    // All quest skills are prerequisites
    const prerequisiteSkillIds = allQuestSkills.map(s => s.id);

    // Identify cross-quest dependencies through components
    const compoundSkills = allQuestSkills.filter(s => s.isCompound);
    const crossQuestIds = [...new Set(
      compoundSkills.flatMap(s => s.componentQuestIds ?? [])
    )].filter(qid => qid !== quest.id);

    // Estimate time (longer for synthesis)
    const estimatedMinutes = Math.min(MAX_SKILL_MINUTES, 35);

    const skill: Skill = {
      id: createSkillId(),
      questId: quest.id,
      goalId: goal.id,
      userId: goal.userId,
      title,
      topic: 'synthesis',
      action,
      successSignal,
      lockedVariables: ["Don't skip any component", "Complete all acceptance criteria"],
      estimatedMinutes,
      skillType: 'synthesis',
      depth: SKILL_TYPE_DEPTH.synthesis,
      prerequisiteSkillIds,
      prerequisiteQuestIds: crossQuestIds,
      isCompound: true,
      componentSkillIds: prerequisiteSkillIds,
      componentQuestIds: crossQuestIds.length > 0 ? crossQuestIds : undefined,
      combinationContext: `Combines all ${allQuestSkills.length} skills from this quest`,
      weekNumber: 0, // Will be assigned (last day)
      dayInWeek: 0,
      dayInQuest: 0,
      order: allQuestSkills.length + 1,
      difficulty: 'synthesis',
      mastery: 'not_started',
      status: 'locked',
      passCount: 0,
      failCount: 0,
      consecutivePasses: 0,
      adversarialElement: shipStage.designedFailure,
      failureMode: shipStage.consequence,
      recoverySteps: shipStage.recovery,
      transferScenario: shipStage.transfer,
      sourceStageTitle: shipStage.title,
      sourceStageIndex: 5,
      topics: shipStage.topics,
      createdAt: now,
      updatedAt: now,
    };

    return ok(skill);
  }

  /**
   * Validate a skill meets all requirements.
   */
  validateSkill(skill: Skill, dailyMinutes: number): string | undefined {
    // Check action is verb-first
    if (!this.startsWithActionVerb(skill.action)) {
      return `Action must start with verb. Got: "${skill.action.substring(0, 30)}..."`;
    }

    // Check success signal exists
    if (!skill.successSignal || skill.successSignal.trim().length < 10) {
      return 'Success signal must be at least 10 characters';
    }

    // Check locked variables exist
    if (!skill.lockedVariables || skill.lockedVariables.length === 0) {
      return 'Must have at least one locked variable';
    }

    // Check time fits budget
    if (skill.estimatedMinutes > dailyMinutes) {
      return `Exceeds daily budget (${skill.estimatedMinutes} > ${dailyMinutes} min)`;
    }

    if (skill.estimatedMinutes < MIN_SKILL_MINUTES) {
      return `Too short (${skill.estimatedMinutes} < ${MIN_SKILL_MINUTES} min)`;
    }

    // Check compound skills have components
    if (skill.isCompound && (!skill.componentSkillIds || skill.componentSkillIds.length < 2)) {
      return 'Compound skill must have at least 2 components';
    }

    return undefined;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE: SKILL GENERATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate foundation skills from early stages.
   */
  private async generateFoundationSkills(
    stages: readonly CapabilityStage[],
    context: SkillTreeGenerationContext,
    targetCount: number,
    now: Timestamp
  ): AsyncAppResult<Skill[]> {
    const { quest, goal, userLevel, dailyMinutes } = context;
    const skills: Skill[] = [];

    // Distribute skills across stages
    const skillsPerStage = Math.ceil(targetCount / Math.max(stages.length, 1));

    for (let stageIndex = 0; stageIndex < stages.length; stageIndex++) {
      const stage = stages[stageIndex]!;
      const stageSkillCount = Math.min(
        skillsPerStage,
        targetCount - skills.length
      );

      if (stageSkillCount <= 0) break;

      // Generate skills for this stage
      const stageSkills = await this.generateSkillsFromStage(
        stage,
        stageIndex,
        'foundation',
        stageSkillCount,
        quest,
        goal,
        userLevel,
        dailyMinutes,
        now,
        skills.length + 1
      );

      if (stageSkills.ok) {
        skills.push(...stageSkills.value);
      }
    }

    return ok(skills);
  }

  /**
   * Generate building skills from middle stages.
   */
  private async generateBuildingSkills(
    stages: readonly CapabilityStage[],
    context: SkillTreeGenerationContext,
    foundationSkills: readonly Skill[],
    targetCount: number,
    now: Timestamp
  ): AsyncAppResult<Skill[]> {
    const { quest, goal, userLevel, dailyMinutes } = context;
    const skills: Skill[] = [];

    const skillsPerStage = Math.ceil(targetCount / Math.max(stages.length, 1));

    for (let stageIndex = 0; stageIndex < stages.length; stageIndex++) {
      const stage = stages[stageIndex]!;
      const stageSkillCount = Math.min(
        skillsPerStage,
        targetCount - skills.length
      );

      if (stageSkillCount <= 0) break;

      const stageSkills = await this.generateSkillsFromStage(
        stage,
        stageIndex + 1, // Offset for stage index
        'building',
        stageSkillCount,
        quest,
        goal,
        userLevel,
        dailyMinutes,
        now,
        foundationSkills.length + skills.length + 1
      );

      if (stageSkills.ok) {
        // Link to foundation prerequisites
        const linkedSkills = stageSkills.value.map((skill, idx) => {
          // Each building skill depends on 1-2 foundations
          const prereqCount = Math.min(2, foundationSkills.length);
          const startIdx = idx % Math.max(foundationSkills.length - prereqCount + 1, 1);
          const prereqs = foundationSkills.slice(startIdx, startIdx + prereqCount);

          return {
            ...skill,
            prerequisiteSkillIds: prereqs.map(p => p.id),
          };
        });

        skills.push(...linkedSkills);
      }
    }

    return ok(skills);
  }

  /**
   * Generate compound skills that combine base skills.
   */
  private async generateCompoundSkills(
    stages: readonly CapabilityStage[],
    context: SkillTreeGenerationContext,
    baseSkills: readonly Skill[],
    priorSkills: readonly Skill[],
    targetCount: number,
    now: Timestamp
  ): AsyncAppResult<Skill[]> {
    const skills: Skill[] = [];

    // Create compound skills by combining base skills
    // Strategy: pair skills that complement each other
    const foundations = baseSkills.filter(s => s.skillType === 'foundation');
    const buildings = baseSkills.filter(s => s.skillType === 'building');

    // Compound 1: Foundation + Building from same quest
    if (foundations.length > 0 && buildings.length > 0) {
      for (let i = 0; i < Math.min(targetCount / 2, foundations.length); i++) {
        const foundation = foundations[i]!;
        const building = buildings[i % buildings.length]!;

        const result = await this.createCompoundSkill([foundation, building], context);
        if (result.ok) {
          skills.push(result.value);
        }

        if (skills.length >= targetCount) break;
      }
    }

    // Compound 2: Cross-quest compounds (if prior skills available)
    if (priorSkills.length > 0 && skills.length < targetCount) {
      const masteredPrior = priorSkills.filter(s => s.mastery === 'mastered');

      for (const priorSkill of masteredPrior.slice(0, 3)) {
        if (skills.length >= targetCount) break;

        // Find a complementary skill from current quest
        const complementary = baseSkills.find(s =>
          s.topic !== priorSkill.topic &&
          !skills.some(existing =>
            existing.componentSkillIds?.includes(s.id)
          )
        );

        if (complementary) {
          const result = await this.createCompoundSkill([priorSkill, complementary], context);
          if (result.ok) {
            skills.push(result.value);
          }
        }
      }
    }

    // Compound 3: Building + Building combinations
    while (skills.length < targetCount && buildings.length >= 2) {
      const idx = skills.length % (buildings.length - 1);
      const skill1 = buildings[idx]!;
      const skill2 = buildings[idx + 1]!;

      const result = await this.createCompoundSkill([skill1, skill2], context);
      if (result.ok) {
        skills.push(result.value);
      } else {
        break; // Avoid infinite loop
      }
    }

    return ok(skills.slice(0, targetCount));
  }

  /**
   * Generate skills from a single stage.
   */
  private async generateSkillsFromStage(
    stage: CapabilityStage,
    stageIndex: number,
    skillType: SkillType,
    count: number,
    quest: { id: QuestId; title: string },
    goal: { id: GoalId; userId: UserId },
    userLevel: 'beginner' | 'intermediate' | 'advanced',
    dailyMinutes: number,
    now: Timestamp,
    startOrder: number
  ): AsyncAppResult<Skill[]> {
    const skills: Skill[] = [];

    // Use LLM for smart decomposition if available
    if (this.config.useLLM && this.config.openaiApiKey && count > 1) {
      const llmResult = await this.generateSkillsViaLLM(
        stage,
        skillType,
        count,
        quest.title,
        userLevel
      );

      if (llmResult.ok) {
        // Convert LLM output to full Skill objects
        for (let i = 0; i < llmResult.value.length; i++) {
          const llmSkill = llmResult.value[i]!;
          skills.push(this.createSkillFromLLMOutput(
            llmSkill,
            stage,
            stageIndex,
            skillType,
            quest,
            goal,
            dailyMinutes,
            startOrder + i,
            now
          ));
        }
        return ok(skills);
      }
      // Fall through to rule-based if LLM fails
    }

    // Rule-based skill generation
    for (let i = 0; i < count; i++) {
      const skill = this.createSkillFromStage(
        stage,
        stageIndex,
        skillType,
        quest,
        goal,
        dailyMinutes,
        startOrder + i,
        now,
        count > 1 ? i + 1 : undefined
      );
      skills.push(skill);
    }

    return ok(skills);
  }

  /**
   * Generate skills via LLM for smarter decomposition.
   */
  private async generateSkillsViaLLM(
    stage: CapabilityStage,
    skillType: SkillType,
    count: number,
    questTitle: string,
    userLevel: string
  ): AsyncAppResult<LLMSkillOutput[]> {
    if (!this.config.openaiApiKey) {
      return err(appError('CONFIG_ERROR', 'No OpenAI API key'));
    }

    const systemPrompt = `You are an expert instructional designer. Generate ${count} atomic, actionable skills from a capability stage.

Each skill must be:
- ACTIONABLE (starts with verb)
- SPECIFIC (not vague)
- MEASURABLE (has clear success signal)
- TIME-BOUNDED (fits in 15-30 minutes)

Output JSON array with objects containing:
{
  "title": "Short skill name (2-4 words)",
  "topic": "Main topic (1-2 words)",
  "action": "Verb-first action statement",
  "successSignal": "Observable completion criteria",
  "lockedVariables": ["What NOT to change"],
  "estimatedMinutes": 15-30
}`;

    const userPrompt = `Quest: ${questTitle}
Skill Type: ${skillType}
User Level: ${userLevel}

Capability Stage:
- Title: ${stage.title}
- Capability: ${stage.capability}
- Artifact: ${stage.artifact}
- Topics: ${stage.topics.join(', ')}

Generate ${count} ${skillType} skills that build toward this capability.
Return ONLY the JSON array.`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return err(appError('LLM_ERROR', `OpenAI error: ${response.status} - ${errorText}`));
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
      };

      const content = data.choices[0]?.message?.content;
      if (!content) {
        return err(appError('LLM_ERROR', 'Empty response'));
      }

      // Parse JSON
      const cleaned = content.trim().replace(/^```json\s*/, '').replace(/```$/, '');
      const parsed = JSON.parse(cleaned) as LLMSkillOutput[];

      return ok(parsed);
    } catch (error) {
      return err(appError('LLM_ERROR', `LLM generation failed: ${error}`));
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE: SKILL CREATION HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create skill from LLM output.
   */
  private createSkillFromLLMOutput(
    llmSkill: LLMSkillOutput,
    stage: CapabilityStage,
    stageIndex: number,
    skillType: SkillType,
    quest: { id: QuestId; title: string },
    goal: { id: GoalId; userId: UserId },
    dailyMinutes: number,
    order: number,
    now: Timestamp
  ): Skill {
    const estimatedMinutes = Math.min(
      dailyMinutes,
      Math.max(MIN_SKILL_MINUTES, llmSkill.estimatedMinutes ?? DEFAULT_SKILL_MINUTES)
    );

    return {
      id: createSkillId(),
      questId: quest.id,
      goalId: goal.id,
      userId: goal.userId,
      title: llmSkill.title,
      topic: llmSkill.topic ?? stage.topics[0] ?? 'general',
      action: llmSkill.action,
      successSignal: llmSkill.successSignal,
      lockedVariables: llmSkill.lockedVariables ?? ["Don't change approach mid-exercise"],
      estimatedMinutes,
      skillType,
      depth: SKILL_TYPE_DEPTH[skillType],
      prerequisiteSkillIds: [],
      prerequisiteQuestIds: [],
      isCompound: false,
      weekNumber: 0,
      dayInWeek: 0,
      dayInQuest: 0,
      order,
      difficulty: this.getDifficultyForType(skillType, stageIndex),
      mastery: 'not_started',
      status: skillType === 'foundation' ? 'available' : 'locked',
      passCount: 0,
      failCount: 0,
      consecutivePasses: 0,
      adversarialElement: stage.designedFailure,
      failureMode: stage.consequence,
      recoverySteps: stage.recovery,
      transferScenario: stage.transfer,
      sourceStageTitle: stage.title,
      sourceStageIndex: stageIndex + 1,
      topics: stage.topics,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Create skill directly from stage (rule-based).
   */
  private createSkillFromStage(
    stage: CapabilityStage,
    stageIndex: number,
    skillType: SkillType,
    quest: { id: QuestId; title: string },
    goal: { id: GoalId; userId: UserId },
    dailyMinutes: number,
    order: number,
    now: Timestamp,
    partNumber?: number
  ): Skill {
    const title = partNumber
      ? `${stage.title} (Part ${partNumber})`
      : stage.title;

    const action = this.capabilityToAction(stage.capability);
    const successSignal = this.artifactToSuccessSignal(stage.artifact);

    const estimatedMinutes = Math.min(dailyMinutes, DEFAULT_SKILL_MINUTES);

    return {
      id: createSkillId(),
      questId: quest.id,
      goalId: goal.id,
      userId: goal.userId,
      title,
      topic: stage.topics[0] ?? 'general',
      action,
      successSignal,
      lockedVariables: ["Don't change approach mid-exercise", "Complete in single session"],
      estimatedMinutes,
      skillType,
      depth: SKILL_TYPE_DEPTH[skillType],
      prerequisiteSkillIds: [],
      prerequisiteQuestIds: [],
      isCompound: false,
      weekNumber: 0,
      dayInWeek: 0,
      dayInQuest: 0,
      order,
      difficulty: this.getDifficultyForType(skillType, stageIndex),
      mastery: 'not_started',
      status: skillType === 'foundation' ? 'available' : 'locked',
      passCount: 0,
      failCount: 0,
      consecutivePasses: 0,
      adversarialElement: stage.designedFailure,
      failureMode: stage.consequence,
      recoverySteps: stage.recovery,
      transferScenario: stage.transfer,
      sourceStageTitle: stage.title,
      sourceStageIndex: stageIndex + 1,
      topics: stage.topics,
      createdAt: now,
      updatedAt: now,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE: SCHEDULING
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Assign scheduling (week, day) to all skills.
   */
  private assignScheduling(
    skills: Skill[],
    duration: QuestDuration,
    context: SkillTreeGenerationContext
  ): Skill[] {
    const totalDays = duration.practiceDays;
    const totalWeeks = Math.ceil(totalDays / 5);

    // Sort by order
    const sorted = [...skills].sort((a, b) => a.order - b.order);

    return sorted.map((skill, index) => {
      const dayInQuest = index + 1;
      const weekInQuest = Math.ceil(dayInQuest / 5);
      const dayInWeek = ((dayInQuest - 1) % 5) + 1;
      const weekNumber = duration.weekStart + weekInQuest - 1;

      return {
        ...skill,
        weekNumber,
        dayInWeek,
        dayInQuest,
        order: index + 1,
      };
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE: UTILITIES
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Calculate target skill counts from distribution.
   */
  private calculateTargetCounts(
    totalDays: number,
    distribution: SkillDistribution
  ): { foundation: number; building: number; compound: number; synthesis: number } {
    // Reserve 1 day for synthesis
    const availableDays = totalDays - 1;

    const foundation = Math.max(1, Math.round(availableDays * distribution.foundationPercent));
    const building = Math.max(1, Math.round(availableDays * distribution.buildingPercent));
    const compound = Math.max(1, Math.round(availableDays * distribution.compoundPercent));

    // Adjust to match available days
    const total = foundation + building + compound + 1;
    const adjustment = availableDays + 1 - total;

    return {
      foundation,
      building: building + Math.max(0, adjustment),
      compound,
      synthesis: 1,
    };
  }

  /**
   * Get difficulty for skill type and stage.
   */
  private getDifficultyForType(skillType: SkillType, stageIndex: number): SkillDifficulty {
    if (skillType === 'synthesis') return 'synthesis';
    if (skillType === 'compound') return 'challenge';
    if (skillType === 'building') return 'practice';
    return stageIndex === 0 ? 'intro' : 'practice';
  }

  /**
   * Transform capability to action (verb-first).
   */
  private capabilityToAction(capability: string): string {
    if (this.startsWithActionVerb(capability)) {
      return capability;
    }

    const canPattern = /^(?:can|able to)\s+(.+)$/i;
    const match = capability.match(canPattern);
    if (match) {
      const action = match[1]!.trim();
      return action.charAt(0).toUpperCase() + action.slice(1);
    }

    return `Practice: ${capability}`;
  }

  /**
   * Transform artifact to success signal.
   */
  private artifactToSuccessSignal(artifact: string): string {
    const cleaned = artifact.replace(/^(?:a|an|the)\s+/i, '');
    if (/^(?:completed?|finished?|working|functional|tested)/i.test(cleaned)) {
      return cleaned;
    }
    return `Completed: ${cleaned}`;
  }

  /**
   * Check if text starts with action verb.
   */
  private startsWithActionVerb(text: string): boolean {
    const firstWord = text.split(/\s+/)[0]?.toLowerCase() ?? '';
    return ACTION_VERBS.some(verb =>
      firstWord === verb || firstWord.startsWith(verb)
    );
  }

  /**
   * Build milestone from synthesis skill.
   */
  private buildMilestone(
    synthesisSkill: Skill,
    questTitle: string,
    stages: readonly CapabilityStage[]
  ): QuestMilestone {
    const shipStage = stages[stages.length - 1];

    return {
      title: synthesisSkill.title.replace('Milestone: ', ''),
      description: `Complete the ${questTitle} quest by demonstrating all learned skills`,
      artifact: shipStage?.artifact ?? synthesisSkill.successSignal,
      acceptanceCriteria: [
        'All component skills demonstrated',
        synthesisSkill.successSignal,
        'No critical errors or failures',
        'Can explain key decisions',
      ],
      estimatedMinutes: synthesisSkill.estimatedMinutes,
      requiredMasteryPercent: 0.75,
      status: 'locked' as MilestoneStatus,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * LLM output structure for skill generation.
 */
interface LLMSkillOutput {
  title: string;
  topic?: string;
  action: string;
  successSignal: string;
  lockedVariables?: string[];
  estimatedMinutes?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a SkillTreeGenerator instance.
 */
export function createSkillTreeGenerator(config?: SkillTreeGeneratorConfig): SkillTreeGenerator {
  return new SkillTreeGenerator(config);
}
