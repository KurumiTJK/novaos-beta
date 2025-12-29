// ═══════════════════════════════════════════════════════════════════════════════
// PRACTICE DISPLAY BUILDER — Convert Internal Types to Display Types
// NovaOS Gates — Phase 19F: Practice Response Formats
// ═══════════════════════════════════════════════════════════════════════════════
//
// Builds display types from internal deliberate practice types:
//
//   - buildTodayDrillDisplay() → TodayDrillDisplay
//   - buildWeekSummaryDisplay() → WeekSummaryDisplay
//   - buildGoalProgressDisplay() → GoalProgressDisplay
//   - buildMilestoneDisplay() → MilestoneDisplay
//   - buildSkillTreeDisplay() → SkillTreeNodeDisplay[]
//
// These builders bridge the gap between:
//   - Internal types: DailyDrill, WeekPlan, Skill, GoalProgress
//   - Display types: TodayDrillDisplay, WeekSummaryDisplay, etc.
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { Goal, Quest } from '../../services/spark-engine/types.js';
import type { SkillId } from '../../types/branded.js';
import type {
  DailyDrill,
  Skill,
  WeekPlan,
  DrillSection,
  DayPlan,
  QuestMilestone,
  GoalProgress,
  QuestProgress,
  SkillType,
  SkillStatus,
  SkillMastery,
  MilestoneStatus,
} from '../../services/deliberate-practice-engine/types.js';
import type { TodayPracticeResult } from '../../services/deliberate-practice-engine/interfaces.js';

import type {
  TodayDrillDisplay,
  DrillSectionDisplay,
  WeekSummaryDisplay,
  DayPlanDisplay,
  GoalProgressDisplay,
  QuestProgressSummary,
  MilestoneDisplay,
  SkillTreeNodeDisplay,
} from './practice-display-types.js';

import {
  SKILL_TYPE_EMOJI,
  SKILL_TYPE_LABEL,
  SKILL_STATUS_EMOJI,
  SKILL_MASTERY_EMOJI,
  MILESTONE_STATUS_EMOJI,
  MILESTONE_STATUS_LABEL,
  DAY_NAMES,
} from './practice-display-types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// DRILL DISPLAY BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context for building drill display.
 */
export interface DrillDisplayContext {
  readonly drill: DailyDrill;
  readonly skill: Skill | null;
  readonly weekPlan: WeekPlan | null;
  readonly goal: Goal | null;
  readonly quest: Quest | null;
  readonly previousQuestSkills?: readonly Skill[];
  readonly previousQuests?: readonly Quest[];
}

/**
 * Build TodayDrillDisplay from practice result.
 */
export function buildTodayDrillDisplay(context: DrillDisplayContext): TodayDrillDisplay {
  const { drill, skill, weekPlan, goal, quest } = context;

  // Build sections
  const warmup = drill.warmup ? buildDrillSectionDisplay(drill.warmup, 'warmup', context) : undefined;
  const main = buildDrillSectionDisplay(drill.main ?? createMainSection(drill), 'main', context);
  const stretch = drill.stretch ? buildDrillSectionDisplay(drill.stretch, 'stretch', context) : undefined;

  // Calculate times
  const warmupMinutes = warmup?.estimatedMinutes ?? 0;
  const mainMinutes = main.estimatedMinutes;
  const stretchMinutes = stretch?.estimatedMinutes ?? 0;
  const totalMinutes = drill.estimatedMinutes || (warmupMinutes + mainMinutes + stretchMinutes);

  // Determine skill type
  const skillType: SkillType = skill?.skillType ?? 'foundation';

  // Build cross-quest context
  const buildsOnQuests = getBuildsOnQuests(skill, context.previousQuests);
  const isCompound = skillType === 'compound' || skillType === 'synthesis';

  // Get review context from warmup
  let reviewsSkillTitle: string | undefined;
  let reviewsQuestTitle: string | undefined;
  if (warmup?.isFromPreviousQuest) {
    reviewsSkillTitle = warmup.sourceSkillTitle;
    reviewsQuestTitle = warmup.sourceQuestTitle;
  }

  return {
    // Identity
    drillId: drill.id,
    goalId: goal?.id ?? '',
    goalTitle: goal?.title ?? 'Unknown Goal',
    questId: quest?.id ?? drill.questId ?? '',
    questTitle: quest?.title ?? 'Unknown Quest',

    // Skill Information
    skillId: skill?.id ?? drill.skillId ?? '',
    skillTitle: skill?.action ?? 'Unknown Skill',
    skillType,
    skillTypeLabel: SKILL_TYPE_LABEL[skillType],
    mastery: skill?.mastery ?? 'not_started',

    // Scheduling
    scheduledDate: drill.scheduledDate,
    dayNumber: drill.dayNumber,
    dayInWeek: drill.dayInWeek ?? ((drill.dayNumber - 1) % 5) + 1,
    dayInQuest: drill.dayInQuest ?? drill.dayNumber,
    weekNumber: weekPlan?.weekNumber ?? drill.weekNumber ?? 1,
    status: drill.status,

    // Structured Sections
    warmup,
    main,
    stretch,

    // Legacy Flat Fields
    action: drill.action,
    passSignal: drill.passSignal,
    constraint: drill.constraint,
    lockedVariables: drill.lockedVariables ?? [],

    // Time
    totalMinutes,
    warmupMinutes: warmupMinutes > 0 ? warmupMinutes : undefined,
    mainMinutes,
    stretchMinutes: stretchMinutes > 0 ? stretchMinutes : undefined,

    // Retry Context
    isRetry: drill.isRetry ?? drill.retryCount > 0,
    retryCount: drill.retryCount ?? 0,
    continuationContext: drill.carryForward,
    previousDrillId: drill.previousDrillId,

    // Cross-Quest Context
    isCompound,
    buildsOnQuests: buildsOnQuests.length > 0 ? buildsOnQuests : undefined,
    reviewsSkillTitle,
    reviewsQuestTitle,

    // Resilience Layer
    adversarialElement: skill?.adversarialElement,
    failureMode: skill?.failureMode,
    recoverySteps: skill?.recoverySteps,
  };
}

/**
 * Build a drill section display.
 */
function buildDrillSectionDisplay(
  section: DrillSection,
  type: 'warmup' | 'main' | 'stretch',
  context: DrillDisplayContext
): DrillSectionDisplay {
  // Determine if from previous quest
  const isFromPreviousQuest = section.sourceQuestId !== undefined &&
    section.sourceQuestId !== context.quest?.id;

  // Find source quest title
  let sourceQuestTitle: string | undefined;
  let sourceSkillTitle: string | undefined;

  if (isFromPreviousQuest && context.previousQuests) {
    const sourceQuest = context.previousQuests.find(q => q.id === section.sourceQuestId);
    sourceQuestTitle = sourceQuest?.title;
  }

  if (section.sourceSkillId && context.previousQuestSkills) {
    const sourceSkill = context.previousQuestSkills.find(s => s.id === section.sourceSkillId);
    sourceSkillTitle = sourceSkill?.action;
  }

  return {
    type,
    title: section.title || getSectionDefaultTitle(type),
    action: section.action,
    estimatedMinutes: section.estimatedMinutes,
    isOptional: section.isOptional ?? type === 'stretch',
    passSignal: type === 'main' ? section.passSignal : undefined,
    constraint: section.constraint,
    isFromPreviousQuest,
    sourceQuestTitle,
    sourceSkillTitle,
  };
}

/**
 * Create a main section from flat drill fields (backward compatibility).
 */
function createMainSection(drill: DailyDrill): DrillSection {
  return {
    type: 'main',
    title: 'Main Practice',
    action: drill.action,
    passSignal: drill.passSignal,
    constraint: drill.constraint,
    estimatedMinutes: drill.estimatedMinutes,
    isOptional: false,
  };
}

/**
 * Get default title for section type.
 */
function getSectionDefaultTitle(type: 'warmup' | 'main' | 'stretch'): string {
  switch (type) {
    case 'warmup':
      return 'Warmup';
    case 'main':
      return 'Main Practice';
    case 'stretch':
      return 'Stretch Challenge';
  }
}

/**
 * Get quest titles that this skill builds on.
 */
function getBuildsOnQuests(
  skill: Skill | null,
  previousQuests?: readonly Quest[]
): string[] {
  if (!skill || !previousQuests || !skill.prerequisiteSkillIds) {
    return [];
  }

  // This is a simplified version - in production, we'd look up
  // the prerequisite skills and find their quest titles
  return [];
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEEK SUMMARY BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context for building week summary display.
 */
export interface WeekDisplayContext {
  readonly weekPlan: WeekPlan;
  readonly goal: Goal | null;
  readonly quest: Quest | null;
  readonly skills: readonly Skill[];
  readonly drills: readonly DailyDrill[];
  readonly milestone?: QuestMilestone;
  readonly previousQuests?: readonly Quest[];
  readonly today?: string; // YYYY-MM-DD
}

/**
 * Build WeekSummaryDisplay from week plan.
 */
export function buildWeekSummaryDisplay(context: WeekDisplayContext): WeekSummaryDisplay {
  const { weekPlan, goal, quest, skills, drills, milestone, today } = context;

  // Build day plans
  const days = buildDayPlans(weekPlan, skills, drills, today);

  // Calculate progress
  const drillsCompleted = drills.filter(d => d.status === 'completed').length;
  const drillsPassed = drills.filter(d => d.outcome === 'pass').length;
  const drillsFailed = drills.filter(d => d.outcome === 'fail').length;
  const drillsSkipped = drills.filter(d => d.outcome === 'skipped').length;
  const drillsTotal = weekPlan.drillsTotal ?? days.length;
  const passRate = drillsCompleted > 0 ? drillsPassed / drillsCompleted : 0;
  const progressPercent = Math.round((drillsCompleted / Math.max(drillsTotal, 1)) * 100);

  // Count skill types
  const skillTypes = countSkillTypes(skills);

  // Count mastered skills
  const skillsMastered = skills.filter(s => s.mastery === 'mastered').length;

  // Find current day
  const todayDate = today ?? new Date().toISOString().split('T')[0];
  const currentDayPlan = days.find(d => d.isToday);
  const currentDayInWeek = currentDayPlan?.dayNumber ?? 0;

  // Determine if first/last week of quest
  const isFirstWeekOfQuest = weekPlan.weekInQuest === 1;
  const isLastWeekOfQuest = weekPlan.isLastWeekOfQuest ?? false;

  // Build milestone info if last week
  let milestoneInfo: WeekSummaryDisplay['milestone'] | undefined;
  if (isLastWeekOfQuest && milestone) {
    milestoneInfo = {
      title: milestone.title,
      status: milestone.status,
      requiredMasteryPercent: milestone.requiredMasteryPercent ?? 80,
      currentMasteryPercent: 0, // Calculated elsewhere
      isUnlocked: milestone.status !== 'locked',
    };
  }

  // Find cross-quest reviews
  const reviewsFromQuests = findReviewsFromQuests(skills, context.previousQuests);
  const buildsOnSkills = findBuildsOnSkills(skills);

  // Find carry forward skills
  const carryForwardSkills = weekPlan.carryForwardSkillIds
    ? skills.filter(s => weekPlan.carryForwardSkillIds?.includes(s.id)).map(s => s.action)
    : [];

  return {
    // Identity
    weekPlanId: weekPlan.id,
    goalId: goal?.id ?? weekPlan.goalId,
    goalTitle: goal?.title ?? 'Unknown Goal',
    questId: quest?.id ?? weekPlan.questId ?? '',
    questTitle: quest?.title ?? 'Unknown Quest',

    // Week Info
    weekNumber: weekPlan.weekNumber,
    weekInQuest: weekPlan.weekInQuest ?? 1,
    isFirstWeekOfQuest,
    isLastWeekOfQuest,
    theme: weekPlan.theme ?? `Week ${weekPlan.weekNumber}`,
    weeklyCompetence: weekPlan.weeklyCompetence ?? '',
    startDate: weekPlan.startDate,
    endDate: weekPlan.endDate ?? calculateEndDate(weekPlan.startDate, drillsTotal),
    status: weekPlan.status,

    // Days
    days,
    currentDayInWeek,

    // Progress
    drillsCompleted,
    drillsTotal,
    drillsPassed,
    drillsFailed,
    drillsSkipped,
    passRate,
    progressPercent,

    // Skill Type Breakdown
    skillTypes,
    skillsMastered,

    // Cross-Quest Context
    reviewsFromQuests,
    buildsOnSkills,

    // Milestone
    milestone: milestoneInfo,

    // Carry Forward
    carryForwardSkills,
    nextWeekFocus: undefined, // Populated at week completion
  };
}

/**
 * Build day plans from week plan.
 */
function buildDayPlans(
  weekPlan: WeekPlan,
  skills: readonly Skill[],
  drills: readonly DailyDrill[],
  today?: string
): DayPlanDisplay[] {
  const todayDate = today ?? new Date().toISOString().split('T')[0];
  const days: DayPlanDisplay[] = [];

  // Use days if available, otherwise generate from drills
  if (weekPlan.days && weekPlan.days.length > 0) {
    for (const dayPlan of weekPlan.days) {
      const skill = skills.find(s => s.id === dayPlan.skillId);
      const drill = drills.find(d => d.scheduledDate === dayPlan.scheduledDate);
      const isToday = dayPlan.scheduledDate === todayDate;

      let status: DayPlanDisplay['status'] = 'pending';
      if (drill?.status === 'completed') {
        status = 'completed';
      } else if (drill?.outcome === 'skipped') {
        status = 'skipped';
      } else if (isToday) {
        status = 'today';
      }

      days.push({
        dayNumber: dayPlan.dayNumber,
        dayInQuest: dayPlan.dayInQuest ?? dayPlan.dayNumber,
        scheduledDate: dayPlan.scheduledDate ?? '',
        dayName: DAY_NAMES[dayPlan.dayNumber - 1] ?? `Day ${dayPlan.dayNumber}`,
        skillTitle: skill?.action ?? 'Unknown Skill',
        skillType: skill?.skillType ?? 'foundation',
        skillTypeEmoji: SKILL_TYPE_EMOJI[skill?.skillType ?? 'foundation'],
        status,
        outcome: drill?.outcome,
        isToday,
      });
    }
  } else {
    // Generate from drills
    for (let i = 0; i < drills.length && i < 5; i++) {
      const drill = drills[i]!;
      const skill = skills.find(s => s.id === drill.skillId);
      const isToday = drill.scheduledDate === todayDate;

      let status: DayPlanDisplay['status'] = 'pending';
      if (drill.status === 'completed') {
        status = 'completed';
      } else if (drill.outcome === 'skipped') {
        status = 'skipped';
      } else if (isToday) {
        status = 'today';
      }

      days.push({
        dayNumber: i + 1,
        dayInQuest: drill.dayInQuest ?? drill.dayNumber,
        scheduledDate: drill.scheduledDate,
        dayName: DAY_NAMES[i] ?? `Day ${i + 1}`,
        skillTitle: skill?.action ?? drill.action.slice(0, 50),
        skillType: skill?.skillType ?? 'foundation',
        skillTypeEmoji: SKILL_TYPE_EMOJI[skill?.skillType ?? 'foundation'],
        status,
        outcome: drill.outcome,
        isToday,
      });
    }
  }

  return days;
}

/**
 * Count skills by type.
 */
function countSkillTypes(skills: readonly Skill[]): WeekSummaryDisplay['skillTypes'] {
  return {
    foundation: skills.filter(s => s.skillType === 'foundation').length,
    building: skills.filter(s => s.skillType === 'building').length,
    compound: skills.filter(s => s.skillType === 'compound').length,
    synthesis: skills.filter(s => s.skillType === 'synthesis').length,
  };
}

/**
 * Find quests that skills review from.
 */
function findReviewsFromQuests(
  skills: readonly Skill[],
  previousQuests?: readonly Quest[]
): string[] {
  if (!previousQuests) return [];

  const questIds = new Set<string>();
  for (const skill of skills) {
    if (skill.prerequisiteSkillIds) {
      // In production, we'd look up the quest for each prerequisite
      // For now, return empty
    }
  }

  return Array.from(questIds);
}

/**
 * Find skills that current skills build on.
 */
function findBuildsOnSkills(skills: readonly Skill[]): string[] {
  // In production, we'd resolve prerequisite skill titles
  return [];
}

/**
 * Calculate end date from start date and days.
 */
function calculateEndDate(startDate: string, days: number): string {
  try {
    const start = new Date(startDate);
    start.setDate(start.getDate() + days - 1);
    return start.toISOString().split('T')[0] ?? startDate;
  } catch {
    return startDate;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRESS DISPLAY BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context for building progress display.
 */
export interface ProgressDisplayContext {
  readonly goal: Goal;
  readonly progress: GoalProgress;
  readonly quests: readonly Quest[];
  readonly questProgress: readonly QuestProgress[];
  readonly skills?: readonly Skill[];
  readonly includeSkillTree?: boolean;
}

/**
 * Build GoalProgressDisplay from progress data.
 */
export function buildGoalProgressDisplay(context: ProgressDisplayContext): GoalProgressDisplay {
  const { goal, progress, quests, questProgress, skills, includeSkillTree } = context;

  // Build quest summaries
  const questSummaries = buildQuestSummaries(quests, questProgress, progress.currentQuest?.questId);

  // Find current quest
  const currentQuest = questSummaries.find(q => q.isCurrent);

  // Build skill type breakdown
  const skillTypeBreakdown = buildSkillTypeBreakdown(progress, skills);

  // Build skill tree if requested
  let skillTree: SkillTreeNodeDisplay[] | undefined;
  if (includeSkillTree && skills) {
    skillTree = buildSkillTreeDisplay(skills);
  }

  // Calculate on-track status
  const expectedDays = Math.floor((Date.now() - new Date(goal.createdAt).getTime()) / (1000 * 60 * 60 * 24));
  const daysBehind = Math.max(0, expectedDays - progress.daysCompleted);
  const onTrack = daysBehind <= 2;

  // Estimate completion date
  const avgDaysPerPractice = progress.daysCompleted > 0
    ? (Date.now() - new Date(goal.createdAt).getTime()) / (1000 * 60 * 60 * 24 * progress.daysCompleted)
    : 1;
  const remainingDays = progress.totalDays - progress.daysCompleted;
  const estimatedCompletion = new Date(Date.now() + remainingDays * avgDaysPerPractice * 24 * 60 * 60 * 1000);
  const estimatedCompletionDate = estimatedCompletion.toISOString().split('T')[0] ?? '';

  // Generate suggested actions
  const suggestedActions = generateSuggestedActions(progress, currentQuest);

  return {
    // Identity
    goalId: goal.id,
    goalTitle: goal.title,
    goalDescription: goal.description,
    goalStatus: goal.status,

    // Overall Progress
    percentComplete: progress.percentComplete ?? 0,
    daysCompleted: progress.daysCompleted,
    daysTotal: progress.totalDays,
    currentWeek: progress.currentQuest?.currentWeek ?? 1,
    totalWeeks: Math.ceil(progress.totalDays / 5),
    onTrack,
    daysBehind,
    estimatedCompletionDate,

    // Skills Overview
    skillsTotal: progress.skillsTotal,
    skillsMastered: progress.skillsMastered,
    skillsPracticing: progress.skillsPracticing ?? 0,
    skillsAttempting: 0, // Not tracked in GoalProgress
    skillsNotStarted: progress.skillsNotStarted ?? 0,
    skillsLocked: progress.skillsLocked ?? 0,

    // Skill Type Breakdown
    skillTypeBreakdown,

    // Streaks & Pass Rate
    currentStreak: progress.currentStreak ?? 0,
    longestStreak: progress.longestStreak ?? 0,
    overallPassRate: progress.overallPassRate ?? 0,
    lastPracticeDate: progress.lastPracticeDate ?? undefined,

    // Quest Progress
    quests: questSummaries,
    currentQuest,

    // Skill Tree
    skillTree,

    // Next Actions
    suggestedActions,
  };
}

/**
 * Build quest progress summaries.
 */
function buildQuestSummaries(
  quests: readonly Quest[],
  questProgress: readonly QuestProgress[],
  currentQuestId?: string
): QuestProgressSummary[] {
  return quests.map((quest, index) => {
    const progress = questProgress.find(p => p.questId === quest.id);
    const isCurrent = quest.id === currentQuestId;

    return {
      questId: quest.id,
      title: quest.title,
      order: quest.order ?? index + 1,
      durationLabel: `Week ${index + 1}`, // Simplified
      skillsTotal: progress?.skillsTotal ?? 0,
      skillsMastered: progress?.skillsMastered ?? 0,
      percentComplete: progress?.percentComplete ?? 0,
      isCurrent,
      milestoneStatus: (progress?.milestoneStatus ?? 'locked') as MilestoneStatus,
      milestoneTitle: progress?.milestoneTitle,
    };
  });
}

/**
 * Build skill type breakdown from progress.
 */
function buildSkillTypeBreakdown(
  progress: GoalProgress,
  skills?: readonly Skill[]
): GoalProgressDisplay['skillTypeBreakdown'] {
  // If we have skills, calculate from them
  if (skills && skills.length > 0) {
    const types: Record<SkillType, { total: number; mastered: number }> = {
      foundation: { total: 0, mastered: 0 },
      building: { total: 0, mastered: 0 },
      compound: { total: 0, mastered: 0 },
      synthesis: { total: 0, mastered: 0 },
    };

    for (const skill of skills) {
      const type = skill.skillType ?? 'foundation';
      types[type].total++;
      if (skill.mastery === 'mastered') {
        types[type].mastered++;
      }
    }

    return types;
  }

  // Otherwise, use progress data if available
  return {
    foundation: { total: progress.skillsTotal, mastered: progress.skillsMastered },
    building: { total: 0, mastered: 0 },
    compound: { total: 0, mastered: 0 },
    synthesis: { total: 0, mastered: 0 },
  };
}

/**
 * Generate suggested next actions.
 */
function generateSuggestedActions(
  progress: GoalProgress,
  currentQuest?: QuestProgressSummary
): string[] {
  const actions: string[] = [];

  // Primary action
  if (progress.daysCompleted === 0) {
    actions.push('Say "start now" to begin your first practice');
  } else {
    actions.push('Say "what\'s my lesson" to see today\'s practice');
  }

  // Streak encouragement
  if (progress.currentStreak && progress.currentStreak > 0 && progress.currentStreak < 7) {
    actions.push(`Keep your ${progress.currentStreak}-day streak going!`);
  }

  // Milestone hint
  if (currentQuest && currentQuest.milestoneStatus === 'available') {
    actions.push(`Milestone "${currentQuest.milestoneTitle}" is ready to attempt!`);
  }

  return actions;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SKILL TREE BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build skill tree node display from skills.
 */
export function buildSkillTreeDisplay(skills: readonly Skill[]): SkillTreeNodeDisplay[] {
  return skills.map(skill => buildSkillNode(skill, skills));
}

/**
 * Build a single skill node.
 */
function buildSkillNode(skill: Skill, allSkills: readonly Skill[]): SkillTreeNodeDisplay {
  // Find prerequisite titles
  const prerequisiteTitles = skill.prerequisiteSkillIds
    ?.map((id: SkillId) => allSkills.find(s => s.id === id)?.action)
    .filter((t: string | undefined): t is string => t !== undefined) ?? [];

  // Count skills this unlocks
  const unlocksCount = allSkills.filter(s =>
    s.prerequisiteSkillIds?.includes(skill.id)
  ).length;

  // Find component titles for compound skills
  const componentTitles = skill.componentSkillIds
    ?.map(id => allSkills.find(s => s.id === id)?.action)
    .filter((t): t is string => t !== undefined);

  // Calculate depth (simplified)
  let depth = 0;
  switch (skill.skillType) {
    case 'foundation':
      depth = 0;
      break;
    case 'building':
      depth = 1;
      break;
    case 'compound':
      depth = 2;
      break;
    case 'synthesis':
      depth = 3;
      break;
  }

  return {
    skillId: skill.id,
    title: skill.action,
    action: skill.action,
    skillType: skill.skillType ?? 'foundation',
    skillTypeEmoji: SKILL_TYPE_EMOJI[skill.skillType ?? 'foundation'],
    status: skill.status,
    statusEmoji: SKILL_STATUS_EMOJI[skill.status],
    mastery: skill.mastery,
    masteryEmoji: SKILL_MASTERY_EMOJI[skill.mastery],
    depth,
    passCount: skill.passCount ?? 0,
    failCount: skill.failCount ?? 0,
    consecutivePasses: skill.consecutivePasses ?? 0,
    prerequisiteCount: skill.prerequisiteSkillIds?.length ?? 0,
    prerequisiteTitles: prerequisiteTitles.length > 0 ? prerequisiteTitles : undefined,
    unlocksCount,
    isCompound: skill.skillType === 'compound' || skill.skillType === 'synthesis',
    componentTitles,
    weekNumber: skill.weekNumber ?? 1,
    dayInQuest: skill.dayInQuest ?? 1,
    lastPracticedAt: skill.lastPracticedAt,
    masteredAt: skill.masteredAt,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MILESTONE BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context for building milestone display.
 */
export interface MilestoneDisplayContext {
  readonly milestone: QuestMilestone;
  readonly quest: Quest;
  readonly skills: readonly Skill[];
}

/**
 * Build MilestoneDisplay from milestone data.
 */
export function buildMilestoneDisplay(context: MilestoneDisplayContext): MilestoneDisplay {
  const { milestone, quest, skills } = context;

  // Calculate mastery
  const skillsTotal = skills.length;
  const skillsMastered = skills.filter(s => s.mastery === 'mastered').length;
  const currentMasteryPercent = skillsTotal > 0
    ? Math.round((skillsMastered / skillsTotal) * 100)
    : 0;
  const requiredMasteryPercent = milestone.requiredMasteryPercent ?? 80;
  const isUnlocked = currentMasteryPercent >= requiredMasteryPercent || milestone.status !== 'locked';
  const isCompleted = milestone.status === 'completed';

  // Find blocking skills
  let blockingSkills: MilestoneDisplay['blockingSkills'];
  if (!isUnlocked) {
    const notMastered = skills.filter(s => s.mastery !== 'mastered');
    blockingSkills = notMastered.slice(0, 5).map(skill => ({
      title: skill.action,
      mastery: skill.mastery,
      passCount: skill.passCount ?? 0,
      passesNeeded: 3, // Typically 3 consecutive passes for mastery
    }));
  }

  // Calculate skills needed to unlock
  const neededPercent = requiredMasteryPercent - currentMasteryPercent;
  const skillsNeededToUnlock = Math.ceil((neededPercent / 100) * skillsTotal);

  return {
    // Identity
    questId: quest.id,
    questTitle: quest.title,
    questOrder: quest.order ?? 1,

    // Milestone Info
    title: milestone.title,
    description: milestone.description ?? '',
    artifact: milestone.artifact ?? milestone.title,
    acceptanceCriteria: milestone.acceptanceCriteria ?? [],
    estimatedMinutes: milestone.estimatedMinutes ?? 60,

    // Status
    status: milestone.status,
    statusEmoji: MILESTONE_STATUS_EMOJI[milestone.status],
    statusLabel: MILESTONE_STATUS_LABEL[milestone.status],
    isUnlocked,
    isCompleted,

    // Mastery Requirements
    requiredMasteryPercent,
    currentMasteryPercent,
    skillsMastered,
    skillsTotal,
    skillsNeededToUnlock: Math.max(0, skillsNeededToUnlock),

    // Blocking Skills
    blockingSkills,

    // Timestamps
    unlockedAt: milestone.unlockedAt,
    completedAt: milestone.completedAt,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE BUILDERS (from TodayPracticeResult)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build TodayDrillDisplay from TodayPracticeResult.
 * This is the primary entry point for PracticeFlow.
 */
export function buildDrillDisplayFromPracticeResult(
  practice: TodayPracticeResult,
  goal: Goal | null,
  quest: Quest | null
): TodayDrillDisplay | null {
  if (!practice.hasContent || !practice.drill) {
    return null;
  }

  return buildTodayDrillDisplay({
    drill: practice.drill,
    skill: practice.skill,
    weekPlan: practice.weekPlan,
    goal,
    quest,
  });
}
