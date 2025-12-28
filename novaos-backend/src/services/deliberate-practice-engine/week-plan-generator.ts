// ═══════════════════════════════════════════════════════════════════════════════
// WEEK PLAN GENERATOR — Phase 19C: Weekly Scheduling with Cross-Quest Context
// NovaOS Deliberate Practice Engine
// ═══════════════════════════════════════════════════════════════════════════════
//
// Generates week plans from skills with:
//   - Day-by-day scheduling respecting dependencies
//   - Review skill identification from previous quests
//   - Multi-week quest support (any duration)
//   - Synthesis placement in final week
//   - Carry-forward tracking for incomplete skills
//
// KEY FEATURES:
//   - Works for any quest duration (1 day to multi-week)
//   - Schedules skills respecting prerequisite order
//   - Identifies warm-up review skills from previous quests
//   - Places compound skills after their prerequisites
//   - Places synthesis (milestone) at end of quest's last week
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { AsyncAppResult } from '../../types/result.js';
import { ok, err, appError } from '../../types/result.js';
import type {
  WeekPlanId,
  QuestId,
  GoalId,
  UserId,
  SkillId,
  Timestamp,
} from '../../types/branded.js';
import { createWeekPlanId, createTimestamp } from '../../types/branded.js';
import type { Goal, Quest } from '../spark-engine/types.js';
import type {
  Skill,
  WeekPlan,
  DayPlan,
  QuestDuration,
  WeekPlanStatus,
  SkillType,
} from './types.js';
import type {
  IWeekPlanGenerator,
  WeekPlanGenerationContext,
  WeekPlanGenerationResult,
} from './interfaces.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Practice days per week (Monday-Friday).
 */
const DAYS_PER_WEEK = 5;

/**
 * Maximum skills to review per week.
 */
const MAX_REVIEW_SKILLS_PER_WEEK = 3;

/**
 * Probability of selecting a cross-quest review skill.
 */
const CROSS_QUEST_REVIEW_PROBABILITY = 0.4;

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Configuration for WeekPlanGenerator.
 */
export interface WeekPlanGeneratorConfig {
  /** Days per week for practice (default: 5 for weekdays) */
  daysPerWeek?: number;
  /** Maximum review skills per week */
  maxReviewSkillsPerWeek?: number;
  /** Whether to shuffle review skill selection */
  shuffleReviews?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEEK PLAN GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generates week plans with day-by-day scheduling.
 *
 * The generator creates structured week plans that:
 *   - Respect skill dependencies (foundations before compounds)
 *   - Include review skills from previous quests
 *   - Track cross-quest context for warmups
 *   - Place synthesis at the end of the quest
 */
export class WeekPlanGenerator implements IWeekPlanGenerator {
  private readonly config: Required<WeekPlanGeneratorConfig>;

  constructor(config: WeekPlanGeneratorConfig = {}) {
    this.config = {
      daysPerWeek: config.daysPerWeek ?? DAYS_PER_WEEK,
      maxReviewSkillsPerWeek: config.maxReviewSkillsPerWeek ?? MAX_REVIEW_SKILLS_PER_WEEK,
      shuffleReviews: config.shuffleReviews ?? true,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate a single week plan.
   */
  async generate(context: WeekPlanGenerationContext): AsyncAppResult<WeekPlanGenerationResult> {
    const {
      goal,
      quest,
      duration,
      weekNumber,
      weekInQuest,
      weekSkills,
      previousQuestSkills,
      carryForwardSkills,
      startDate,
    } = context;

    console.log(`[WEEK_PLAN] Generating week ${weekNumber} (week ${weekInQuest} of quest "${quest.title}")`);
    console.log(`[WEEK_PLAN] ${weekSkills.length} skills, ${carryForwardSkills.length} carry-forward, ${previousQuestSkills.length} prior skills available`);

    const warnings: string[] = [];
    const now = createTimestamp();

    // Determine week position in quest
    const totalWeeksInQuest = Math.ceil(duration.practiceDays / this.config.daysPerWeek);
    const isFirstWeekOfQuest = weekInQuest === 1;
    const isLastWeekOfQuest = weekInQuest === totalWeeksInQuest;

    // Combine carry-forward with week skills (carry-forward takes priority)
    const allSkillsForWeek = this.prioritizeSkills(weekSkills, carryForwardSkills);

    // Identify review skills from previous quests
    const reviewSkills = this.identifyReviewSkills(weekSkills, previousQuestSkills);
    console.log(`[WEEK_PLAN] Identified ${reviewSkills.length} review skills from previous quests`);

    // Assign skills to days
    const skillAssignments = this.assignSkillsToDays(
      allSkillsForWeek,
      this.config.daysPerWeek
    );

    // Build day plans
    const dayPlans = this.buildDayPlans(
      skillAssignments,
      reviewSkills,
      weekInQuest,
      startDate
    );

    // Calculate skill type counts
    const typeCounts = this.countSkillTypes(allSkillsForWeek);

    // Calculate end date
    const endDate = this.calculateEndDate(startDate, this.config.daysPerWeek);

    // Generate weekly competence statement
    const weeklyCompetence = this.generateWeeklyCompetence(allSkillsForWeek, isLastWeekOfQuest);

    // Generate theme
    const theme = this.generateTheme(allSkillsForWeek, weekInQuest, quest.title);

    // Identify which quests are being reviewed
    const reviewsFromQuestIds = [...new Set(reviewSkills.map(s => s.questId))];

    // Identify key prerequisite skills from previous quests
    const buildsOnSkillIds = this.identifyBuildsOnSkills(weekSkills, previousQuestSkills);

    const weekPlan: WeekPlan = {
      id: createWeekPlanId(),
      goalId: goal.id,
      userId: goal.userId,
      questId: quest.id,
      weekNumber,
      weekInQuest,
      isFirstWeekOfQuest,
      isLastWeekOfQuest,
      startDate,
      endDate,
      status: 'pending' as WeekPlanStatus,
      weeklyCompetence,
      theme,
      days: dayPlans,
      scheduledSkillIds: allSkillsForWeek.map(s => s.id),
      carryForwardSkillIds: carryForwardSkills.map(s => s.id),
      completedSkillIds: [],
      foundationCount: typeCounts.foundation,
      buildingCount: typeCounts.building,
      compoundCount: typeCounts.compound,
      hasSynthesis: typeCounts.synthesis > 0,
      reviewsFromQuestIds,
      buildsOnSkillIds,
      drillsCompleted: 0,
      drillsTotal: dayPlans.filter(d => d.skillId).length,
      drillsPassed: 0,
      drillsFailed: 0,
      drillsSkipped: 0,
      skillsMastered: 0,
      createdAt: now,
      updatedAt: now,
    };

    return ok({
      weekPlan,
      dayPlans,
      reviewSkills,
      warnings,
    });
  }

  /**
   * Generate all week plans for a quest.
   */
  async generateForQuest(
    quest: Quest,
    duration: QuestDuration,
    skills: readonly Skill[],
    previousQuestSkills: readonly Skill[],
    goal: Goal,
    startWeekNumber: number,
    startDate: string
  ): AsyncAppResult<readonly WeekPlan[]> {
    console.log(`[WEEK_PLAN] Generating all weeks for quest "${quest.title}"`);
    console.log(`[WEEK_PLAN] Duration: ${duration.practiceDays} days, starting week ${startWeekNumber}`);

    const weekPlans: WeekPlan[] = [];
    const totalWeeks = Math.ceil(duration.practiceDays / this.config.daysPerWeek);

    // Sort skills by order (dependency-respecting order)
    const sortedSkills = [...skills].sort((a, b) => a.order - b.order);

    // Distribute skills across weeks
    const skillsPerWeek = this.distributeSkillsAcrossWeeks(sortedSkills, totalWeeks);

    let currentStartDate = startDate;

    for (let weekInQuest = 1; weekInQuest <= totalWeeks; weekInQuest++) {
      const weekNumber = startWeekNumber + weekInQuest - 1;
      const weekSkills = skillsPerWeek[weekInQuest - 1] ?? [];

      const context: WeekPlanGenerationContext = {
        goal,
        quest,
        duration,
        weekNumber,
        weekInQuest,
        weekSkills,
        previousQuestSkills,
        carryForwardSkills: [], // No carry-forward for initial generation
        startDate: currentStartDate,
      };

      const result = await this.generate(context);

      if (!result.ok) {
        return err(result.error);
      }

      weekPlans.push(result.value.weekPlan);

      // Move to next week's start date
      currentStartDate = this.getNextWeekStartDate(currentStartDate);
    }

    console.log(`[WEEK_PLAN] Generated ${weekPlans.length} week plans`);
    return ok(weekPlans);
  }

  /**
   * Identify skills from previous quests to review in warmups.
   */
  identifyReviewSkills(
    weekSkills: readonly Skill[],
    previousQuestSkills: readonly Skill[]
  ): readonly Skill[] {
    if (previousQuestSkills.length === 0) {
      return [];
    }

    const reviewSkills: Skill[] = [];

    // Strategy 1: Find prerequisites from previous quests
    for (const skill of weekSkills) {
      if (skill.prerequisiteQuestIds.length > 0) {
        // This skill depends on previous quests
        const prereqSkills = previousQuestSkills.filter(ps =>
          skill.prerequisiteSkillIds.includes(ps.id)
        );
        reviewSkills.push(...prereqSkills);
      }

      // For compound skills, check component skills from other quests
      if (skill.isCompound && skill.componentQuestIds) {
        const componentSkills = previousQuestSkills.filter(ps =>
          skill.componentSkillIds?.includes(ps.id)
        );
        reviewSkills.push(...componentSkills);
      }
    }

    // Strategy 2: Add mastered skills for spaced repetition
    const masteredPrior = previousQuestSkills.filter(s => s.mastery === 'mastered');
    const alreadyIncluded = new Set(reviewSkills.map(s => s.id));

    for (const skill of masteredPrior) {
      if (!alreadyIncluded.has(skill.id)) {
        // Randomly include some mastered skills for review
        if (Math.random() < CROSS_QUEST_REVIEW_PROBABILITY) {
          reviewSkills.push(skill);
        }
      }
    }

    // Deduplicate and limit
    const uniqueReviews = this.deduplicateSkills(reviewSkills);
    const limited = this.config.shuffleReviews
      ? this.shuffleArray(uniqueReviews).slice(0, this.config.maxReviewSkillsPerWeek)
      : uniqueReviews.slice(0, this.config.maxReviewSkillsPerWeek);

    return limited;
  }

  /**
   * Assign skills to days respecting dependencies.
   */
  assignSkillsToDays(
    skills: readonly Skill[],
    daysAvailable: number
  ): readonly (Skill | null)[] {
    if (skills.length === 0) {
      return Array(daysAvailable).fill(null);
    }

    // Sort by dependency order (foundations first, synthesis last)
    const sorted = this.topologicalSort(skills);

    // Assign to days
    const assignments: (Skill | null)[] = [];

    for (let day = 0; day < daysAvailable; day++) {
      if (day < sorted.length) {
        assignments.push(sorted[day]!);
      } else {
        assignments.push(null); // Empty day
      }
    }

    return assignments;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE: SKILL DISTRIBUTION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Distribute skills across weeks.
   */
  private distributeSkillsAcrossWeeks(
    skills: readonly Skill[],
    totalWeeks: number
  ): Skill[][] {
    const weeks: Skill[][] = Array.from({ length: totalWeeks }, () => []);
    const skillsPerWeek = Math.ceil(skills.length / totalWeeks);

    for (let i = 0; i < skills.length; i++) {
      const weekIndex = Math.min(
        Math.floor(i / skillsPerWeek),
        totalWeeks - 1
      );
      weeks[weekIndex]!.push(skills[i]!);
    }

    // Ensure synthesis is in last week
    const synthesisSkill = skills.find(s => s.skillType === 'synthesis');
    if (synthesisSkill) {
      // Remove from current week
      for (const week of weeks) {
        const idx = week.findIndex(s => s.id === synthesisSkill.id);
        if (idx !== -1) {
          week.splice(idx, 1);
        }
      }
      // Add to last week
      weeks[totalWeeks - 1]!.push(synthesisSkill);
    }

    return weeks;
  }

  /**
   * Prioritize skills: carry-forward first, then regular.
   */
  private prioritizeSkills(
    weekSkills: readonly Skill[],
    carryForwardSkills: readonly Skill[]
  ): Skill[] {
    const carryForwardIds = new Set(carryForwardSkills.map(s => s.id));
    const regularSkills = weekSkills.filter(s => !carryForwardIds.has(s.id));

    // Carry-forward takes priority (they need more practice)
    return [...carryForwardSkills, ...regularSkills];
  }

  /**
   * Topological sort skills by dependencies.
   */
  private topologicalSort(skills: readonly Skill[]): Skill[] {
    const skillMap = new Map(skills.map(s => [s.id, s]));
    const visited = new Set<SkillId>();
    const result: Skill[] = [];

    const visit = (skill: Skill) => {
      if (visited.has(skill.id)) return;
      visited.add(skill.id);

      // Visit prerequisites first
      for (const prereqId of skill.prerequisiteSkillIds) {
        const prereq = skillMap.get(prereqId);
        if (prereq) {
          visit(prereq);
        }
      }

      result.push(skill);
    };

    // Sort by skill type first (foundation → building → compound → synthesis)
    const typeOrder: Record<SkillType, number> = {
      foundation: 0,
      building: 1,
      compound: 2,
      synthesis: 3,
    };

    const sortedByType = [...skills].sort((a, b) => {
      const typeA = typeOrder[a.skillType];
      const typeB = typeOrder[b.skillType];
      if (typeA !== typeB) return typeA - typeB;
      return a.order - b.order;
    });

    for (const skill of sortedByType) {
      visit(skill);
    }

    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE: DAY PLAN BUILDING
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Build day plans from skill assignments.
   */
  private buildDayPlans(
    skillAssignments: readonly (Skill | null)[],
    reviewSkills: readonly Skill[],
    weekInQuest: number,
    startDate: string
  ): DayPlan[] {
    const dayPlans: DayPlan[] = [];
    let reviewIndex = 0;

    for (let dayInWeek = 1; dayInWeek <= skillAssignments.length; dayInWeek++) {
      const skill = skillAssignments[dayInWeek - 1];
      const dayInQuest = (weekInQuest - 1) * this.config.daysPerWeek + dayInWeek;
      const scheduledDate = this.calculateDayDate(startDate, dayInWeek - 1);

      if (skill) {
        // Determine review skill for warmup
        let reviewSkillId: SkillId | undefined;
        let reviewQuestId: QuestId | undefined;

        // Assign review skills to compound/building skills (they benefit most)
        if ((skill.skillType === 'compound' || skill.skillType === 'building') &&
            reviewIndex < reviewSkills.length) {
          const review = reviewSkills[reviewIndex]!;
          reviewSkillId = review.id;
          reviewQuestId = review.questId;
          reviewIndex++;
        }

        dayPlans.push({
          dayNumber: dayInWeek,
          dayInQuest,
          scheduledDate,
          skillId: skill.id,
          skillType: skill.skillType,
          skillTitle: skill.title,
          reviewSkillId,
          reviewQuestId,
          status: 'pending',
        });
      } else {
        // Empty day (catch-up or rest)
        dayPlans.push({
          dayNumber: dayInWeek,
          dayInQuest,
          scheduledDate,
          skillId: '' as SkillId, // Will need to handle empty days
          skillType: 'foundation',
          skillTitle: 'Catch-up / Review',
          status: 'pending',
        });
      }
    }

    return dayPlans;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE: CROSS-QUEST CONTEXT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Identify key prerequisite skills from previous quests.
   */
  private identifyBuildsOnSkills(
    weekSkills: readonly Skill[],
    previousQuestSkills: readonly Skill[]
  ): readonly SkillId[] {
    const buildsOnIds = new Set<SkillId>();

    for (const skill of weekSkills) {
      // Check direct prerequisites from other quests
      for (const prereqId of skill.prerequisiteSkillIds) {
        const prereq = previousQuestSkills.find(ps => ps.id === prereqId);
        if (prereq) {
          buildsOnIds.add(prereqId);
        }
      }

      // Check component skills from other quests
      if (skill.componentSkillIds) {
        for (const compId of skill.componentSkillIds) {
          const comp = previousQuestSkills.find(ps => ps.id === compId);
          if (comp) {
            buildsOnIds.add(compId);
          }
        }
      }
    }

    return [...buildsOnIds];
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE: CONTENT GENERATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate weekly competence statement.
   */
  private generateWeeklyCompetence(
    skills: readonly Skill[],
    isLastWeek: boolean
  ): string {
    if (skills.length === 0) {
      return 'Review and practice';
    }

    if (isLastWeek) {
      const synthesis = skills.find(s => s.skillType === 'synthesis');
      if (synthesis) {
        return `Complete milestone: ${synthesis.title.replace('Milestone: ', '')}`;
      }
    }

    // Build from skill actions
    const actions = skills
      .slice(0, 3)
      .map(s => s.action.split(' ').slice(0, 3).join(' '))
      .join(', ');

    return `Master: ${actions}`;
  }

  /**
   * Generate theme for the week.
   */
  private generateTheme(
    skills: readonly Skill[],
    weekInQuest: number,
    questTitle: string
  ): string {
    if (skills.length === 0) {
      return `${questTitle} - Week ${weekInQuest}`;
    }

    // Use most common topic
    const topics = skills.flatMap(s => s.topics ?? [s.topic]);
    const topicCounts = new Map<string, number>();

    for (const topic of topics) {
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
    }

    const sortedTopics = [...topicCounts.entries()]
      .sort((a, b) => b[1] - a[1]);

    const mainTopic = sortedTopics[0]?.[0];

    if (mainTopic) {
      return this.capitalizeWords(mainTopic);
    }

    return `${questTitle} - Week ${weekInQuest}`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE: UTILITIES
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Count skills by type.
   */
  private countSkillTypes(skills: readonly Skill[]): {
    foundation: number;
    building: number;
    compound: number;
    synthesis: number;
  } {
    return {
      foundation: skills.filter(s => s.skillType === 'foundation').length,
      building: skills.filter(s => s.skillType === 'building').length,
      compound: skills.filter(s => s.skillType === 'compound').length,
      synthesis: skills.filter(s => s.skillType === 'synthesis').length,
    };
  }

  /**
   * Calculate end date from start date.
   */
  private calculateEndDate(startDate: string, daysToAdd: number): string {
    const date = new Date(startDate);
    // Add days, skipping weekends
    let added = 0;
    while (added < daysToAdd) {
      date.setDate(date.getDate() + 1);
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        added++;
      }
    }
    return date.toISOString().split('T')[0]!;
  }

  /**
   * Calculate specific day's date.
   */
  private calculateDayDate(startDate: string, dayOffset: number): string {
    const date = new Date(startDate);
    let added = 0;
    while (added < dayOffset) {
      date.setDate(date.getDate() + 1);
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        added++;
      }
    }
    return date.toISOString().split('T')[0]!;
  }

  /**
   * Get next week's start date (next Monday).
   */
  private getNextWeekStartDate(currentStartDate: string): string {
    const date = new Date(currentStartDate);
    // Move to next Monday
    date.setDate(date.getDate() + 7);
    // Adjust to Monday if needed
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0) {
      date.setDate(date.getDate() + 1); // Sunday -> Monday
    } else if (dayOfWeek === 6) {
      date.setDate(date.getDate() + 2); // Saturday -> Monday
    }
    return date.toISOString().split('T')[0]!;
  }

  /**
   * Deduplicate skills by ID.
   */
  private deduplicateSkills(skills: readonly Skill[]): Skill[] {
    const seen = new Set<SkillId>();
    const result: Skill[] = [];

    for (const skill of skills) {
      if (!seen.has(skill.id)) {
        seen.add(skill.id);
        result.push(skill);
      }
    }

    return result;
  }

  /**
   * Shuffle array (Fisher-Yates).
   */
  private shuffleArray<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
  }

  /**
   * Capitalize words in a string.
   */
  private capitalizeWords(str: string): string {
    return str
      .split(/[\s-]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a WeekPlanGenerator instance.
 */
export function createWeekPlanGenerator(config?: WeekPlanGeneratorConfig): WeekPlanGenerator {
  return new WeekPlanGenerator(config);
}
