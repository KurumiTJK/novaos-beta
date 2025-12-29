// ═══════════════════════════════════════════════════════════════════════════════
// WEEK TRACKER — Week Lifecycle Management
// NovaOS Deliberate Practice Engine — Phase 18: Core Engine
// ═══════════════════════════════════════════════════════════════════════════════
//
// Manages week-level progress and transitions:
//   - Week lifecycle (pending → active → completed)
//   - Progress updates after each drill
//   - Week transitions with carry-forward
//   - Weekly summaries and next-week focus generation
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { AsyncAppResult } from '../../types/result.js';
import { ok, err, appError } from '../../types/result.js';
import type { GoalId, WeekPlanId, SkillId, Timestamp } from '../../types/branded.js';
import { createWeekPlanId, createTimestamp } from '../../types/branded.js';
import type {
  Skill,
  WeekPlan,
  WeekPlanStatus,
  DrillOutcome,
  SkillMastery,
  DayPlan,
} from './types.js';
import { MASTERY_THRESHOLDS, countsAsAttempt, requiresRetry } from './types.js';
import type {
  IWeekTracker,
  WeekCompletionResult,
  WeekProgressUpdate,
  IWeekPlanStore,
  ISkillStore,
  WeeklySummary,
} from './interfaces.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Number of practice days per week (excludes rest days).
 */
const PRACTICE_DAYS_PER_WEEK = 5;

/**
 * Pass rate threshold for "good" week.
 */
const GOOD_WEEK_PASS_RATE = 0.7;

/**
 * Pass rate threshold for "needs improvement" week.
 */
const NEEDS_IMPROVEMENT_PASS_RATE = 0.5;

// ═══════════════════════════════════════════════════════════════════════════════
// WEEK TRACKER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Dependencies for WeekTracker.
 */
export interface WeekTrackerDependencies {
  weekPlanStore: IWeekPlanStore;
  skillStore: ISkillStore;
}

/**
 * Tracks week-level progress and transitions.
 */
export class WeekTracker implements IWeekTracker {
  private readonly weekPlanStore: IWeekPlanStore;
  private readonly skillStore: ISkillStore;

  constructor(deps: WeekTrackerDependencies) {
    this.weekPlanStore = deps.weekPlanStore;
    this.skillStore = deps.skillStore;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get the current week plan for a goal.
   */
  async getCurrentWeek(goalId: GoalId): AsyncAppResult<WeekPlan | null> {
    return this.weekPlanStore.getActiveByGoal(goalId);
  }

  /**
   * Activate a week plan (pending → active).
   */
  async activateWeek(weekPlanId: WeekPlanId): AsyncAppResult<WeekPlan> {
    // Get current week plan
    const result = await this.weekPlanStore.get(weekPlanId);
    if (!result.ok) {
      return result;
    }
    if (result.value === null) {
      return err(appError('NOT_FOUND', `Week plan not found: ${weekPlanId}`));
    }

    const weekPlan = result.value;

    if (weekPlan.status === 'active') {
      return ok(weekPlan); // Already active
    }

    if (weekPlan.status === 'completed') {
      return err(appError('INVALID_STATE', 'Cannot activate a completed week plan'));
    }

    // Update status
    return this.weekPlanStore.updateStatus(weekPlanId, 'active');
  }

  /**
   * Complete a week and prepare the next one.
   */
  async completeWeek(weekPlanId: WeekPlanId): AsyncAppResult<WeekCompletionResult> {
    // Get week plan
    const weekResult = await this.weekPlanStore.get(weekPlanId);
    if (!weekResult.ok) {
      return err(weekResult.error);
    }
    if (weekResult.value === null) {
      return err(appError('NOT_FOUND', `Week plan not found: ${weekPlanId}`));
    }

    const weekPlan = weekResult.value;

    // Get skills for this week
    const skillsResult = await this.getWeekSkills(weekPlan);
    if (!skillsResult.ok) {
      return err(skillsResult.error);
    }
    const skills = skillsResult.value;

    // Calculate carry-forward skills (not yet mastered or needs retry)
    const carryForwardSkills = skills.filter((s: Skill) =>
      s.mastery !== 'mastered' && s.mastery !== 'not_started'
    );

    // Generate weekly summary
    const summary = this.generateWeeklySummary(weekPlan, skills);

    // Generate next week focus
    const nextWeekFocus = this.generateNextWeekFocus(weekPlan, carryForwardSkills);

    // Update week plan status
    const updateResult = await this.weekPlanStore.updateStatus(weekPlanId, 'completed');
    if (!updateResult.ok) {
      return err(updateResult.error);
    }

    const completedWeek = updateResult.value;

    // Create next week plan if there are more skills
    const nextWeekResult = await this.createNextWeekInternal(completedWeek, carryForwardSkills);
    const nextWeek = nextWeekResult.ok ? nextWeekResult.value : undefined;

    // Activate next week if created
    if (nextWeek) {
      await this.activateWeek(nextWeek.id);
    }

    return ok({
      completedWeek,
      carryForwardSkills,
      nextWeekFocus,
      summary,
      nextWeek,
      milestoneCompleted: false, // TODO: Check if quest's last week
      nextQuestUnlocked: false, // TODO: Check unlock logic
    });
  }

  /**
   * Update week progress after drill completion.
   */
  async updateProgress(
    weekPlanId: WeekPlanId,
    update: WeekProgressUpdate
  ): AsyncAppResult<WeekPlan> {
    // Get current week plan
    const weekResult = await this.weekPlanStore.get(weekPlanId);
    if (!weekResult.ok) {
      return err(weekResult.error);
    }
    if (weekResult.value === null) {
      return err(appError('NOT_FOUND', `Week plan not found: ${weekPlanId}`));
    }

    const weekPlan = weekResult.value;

    // Calculate new progress
    const drillsCompleted = weekPlan.drillsCompleted + update.drillsCompleted;
    const drillsPassed = weekPlan.drillsPassed + update.drillsPassed;
    const drillsFailed = weekPlan.drillsFailed + update.drillsFailed;
    const drillsSkipped = weekPlan.drillsSkipped + update.drillsSkipped;
    const skillsMastered = (weekPlan.skillsMastered ?? 0) + update.skillsMastered;

    // Update week plan progress
    const updateResult = await this.weekPlanStore.updateProgress(
      weekPlanId,
      drillsCompleted,
      drillsPassed,
      drillsFailed,
      drillsSkipped,
      skillsMastered
    );
    if (!updateResult.ok) {
      return err(updateResult.error);
    }

    return ok(updateResult.value);
  }

  /**
   * Update week progress after drill completion (legacy signature).
   * @deprecated Use updateProgress(weekPlanId, WeekProgressUpdate) instead
   */
  async updateProgressLegacy(
    weekPlanId: WeekPlanId,
    drillOutcome: DrillOutcome,
    skillId: SkillId
  ): AsyncAppResult<{ drillsCompleted: number; drillsPassed: number; drillsFailed: number; drillsSkipped: number; passRate: number; newlyCompletedSkillIds: SkillId[] }> {
    // Get current week plan
    const weekResult = await this.weekPlanStore.get(weekPlanId);
    if (!weekResult.ok) {
      return err(weekResult.error);
    }
    if (weekResult.value === null) {
      return err(appError('NOT_FOUND', `Week plan not found: ${weekPlanId}`));
    }

    const weekPlan = weekResult.value;

    // Calculate new progress
    let drillsCompleted = weekPlan.drillsCompleted;
    let drillsPassed = weekPlan.drillsPassed;
    let drillsFailed = weekPlan.drillsFailed;
    let drillsSkipped = weekPlan.drillsSkipped;

    // Update counts based on outcome
    if (countsAsAttempt(drillOutcome)) {
      drillsCompleted++;
    }

    switch (drillOutcome) {
      case 'pass':
        drillsPassed++;
        break;
      case 'fail':
        drillsFailed++;
        break;
      case 'skipped':
        drillsSkipped++;
        break;
      case 'partial':
        // Partial counts as attempt but neither pass nor fail
        break;
    }

    // Calculate pass rate
    const totalAttempted = drillsPassed + drillsFailed;
    const passRate = totalAttempted > 0 ? drillsPassed / totalAttempted : 0;

    // Check if skill should be added to completed list
    const newlyCompletedSkillIds: SkillId[] = [];
    if (drillOutcome === 'pass') {
      // Get skill to check mastery
      const skillResult = await this.skillStore.get(skillId);
      if (skillResult.ok && skillResult.value) {
        const skill = skillResult.value;
        // Check if this pass brings skill to 'practicing' or 'mastered'
        if (skill.passCount + 1 >= MASTERY_THRESHOLDS.MASTERED) {
          newlyCompletedSkillIds.push(skillId);
        }
      }
    }

    // Update week plan progress
    const updateResult = await this.weekPlanStore.updateProgress(
      weekPlanId,
      drillsCompleted,
      drillsPassed,
      drillsFailed,
      drillsSkipped,
      newlyCompletedSkillIds.length
    );
    if (!updateResult.ok) {
      return err(updateResult.error);
    }

    return ok({
      drillsCompleted,
      drillsPassed,
      drillsFailed,
      drillsSkipped,
      passRate,
      newlyCompletedSkillIds,
    });
  }

  /**
   * Get week plan by week number.
   */
  async getWeekByNumber(goalId: GoalId, weekNumber: number): AsyncAppResult<WeekPlan | null> {
    return this.weekPlanStore.getByWeekNumber(goalId, weekNumber);
  }

  /**
   * Get all week plans for a goal.
   */
  async getAllWeeks(goalId: GoalId): AsyncAppResult<readonly WeekPlan[]> {
    const result = await this.weekPlanStore.getByGoal(goalId);
    if (!result.ok) {
      return err(result.error);
    }
    return ok(result.value.items);
  }

  /**
   * Get weekly summary for a week plan.
   */
  async getWeeklySummary(weekPlanId: WeekPlanId): AsyncAppResult<WeeklySummary> {
    const weekResult = await this.weekPlanStore.get(weekPlanId);
    if (!weekResult.ok) {
      return err(weekResult.error);
    }
    if (!weekResult.value) {
      return err(appError('NOT_FOUND', `Week plan not found: ${weekPlanId}`));
    }

    const weekPlan = weekResult.value;
    const skillsResult = await this.getWeekSkills(weekPlan);
    if (!skillsResult.ok) {
      return err(skillsResult.error);
    }

    const summary = this.generateWeeklySummary(weekPlan, skillsResult.value);
    return ok(summary);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPER METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get all skills for a week plan.
   */
  private async getWeekSkills(weekPlan: WeekPlan): AsyncAppResult<Skill[]> {
    const allSkillIds = [
      ...weekPlan.scheduledSkillIds,
      ...weekPlan.carryForwardSkillIds,
    ];

    const skills: Skill[] = [];
    for (const skillId of allSkillIds) {
      const result = await this.skillStore.get(skillId);
      if (result.ok && result.value) {
        skills.push(result.value);
      }
    }

    return ok(skills);
  }

  /**
   * Generate weekly summary based on progress.
   */
  private generateWeeklySummary(weekPlan: WeekPlan, skills: Skill[]): WeeklySummary {
    const passRate = weekPlan.passRate ?? 0;

    // Calculate skill mastery progress
    const masteredSkills = skills.filter((s: Skill) => s.mastery === 'mastered');
    const practicingSkills = skills.filter((s: Skill) => s.mastery === 'practicing');

    return {
      weekNumber: weekPlan.weekNumber,
      theme: weekPlan.theme ?? `Week ${weekPlan.weekNumber}`,
      questTitle: '', // Quest title not available on WeekPlan, needs to be fetched separately
      skillsMastered: masteredSkills.map((s: Skill) => s.title),
      skillsInProgress: practicingSkills.map((s: Skill) => s.title),
      crossQuestSkills: [], // TODO: Populate from compound skills
      daysPracticed: weekPlan.drillsCompleted,
      daysTotal: weekPlan.drillsTotal,
      passRate,
      currentStreak: 0, // TODO: Track streak
      milestoneAvailable: false, // TODO: Check milestone
      milestoneTitle: '',
      nextWeekPreview: undefined,
    };
  }

  /**
   * Generate focus for next week based on carry-forward.
   */
  private generateNextWeekFocus(
    weekPlan: WeekPlan,
    carryForwardSkills: Skill[]
  ): string {
    if (carryForwardSkills.length === 0) {
      return 'Ready to advance! No skills need review.';
    }

    if (carryForwardSkills.length === 1) {
      const skill = carryForwardSkills[0]!;
      return `Focus: Master "${this.truncate(skill.action, 50)}" before moving on.`;
    }

    const skillNames = carryForwardSkills
      .slice(0, 3)
      .map((s: Skill) => this.truncate(s.action, 30))
      .join(', ');

    return `Focus: Complete ${carryForwardSkills.length} skills from this week: ${skillNames}...`;
  }

  /**
   * Create next week plan (public interface method).
   */
  async createNextWeek(
    goalId: GoalId,
    previousWeek: WeekPlan
  ): AsyncAppResult<WeekPlan> {
    // Get skills for carry-forward
    const skillsResult = await this.getWeekSkills(previousWeek);
    if (!skillsResult.ok) {
      return err(skillsResult.error);
    }

    const carryForwardSkills = skillsResult.value.filter((s: Skill) =>
      s.mastery !== 'mastered' && s.mastery !== 'not_started'
    );

    const result = await this.createNextWeekInternal(previousWeek, carryForwardSkills);
    if (!result.ok) {
      return err(result.error);
    }

    if (!result.value) {
      return err(appError('INVALID_STATE', 'No more weeks to create'));
    }

    return ok(result.value);
  }

  /**
   * Create the next week plan (internal).
   */
  private async createNextWeekInternal(
    completedWeek: WeekPlan,
    carryForwardSkills: Skill[]
  ): AsyncAppResult<WeekPlan | undefined> {
    // Get all skills for the goal to find what's next
    const allSkillsResult = await this.skillStore.getByGoal(completedWeek.goalId);
    if (!allSkillsResult.ok) {
      return err(allSkillsResult.error);
    }
    const allSkills = allSkillsResult.value.items;

    // Find skills not yet scheduled or completed
    const completedSkillIds = new Set([
      ...completedWeek.completedSkillIds,
    ]);
    const scheduledSkillIds = new Set([
      ...completedWeek.scheduledSkillIds,
    ]);

    const unscheduledSkills = allSkills.filter((s: Skill) =>
      !completedSkillIds.has(s.id) &&
      !scheduledSkillIds.has(s.id) &&
      s.mastery !== 'mastered'
    );

    // Calculate how many new skills to add
    const carryForwardCount = carryForwardSkills.length;
    const newSkillsToAdd = Math.max(0, PRACTICE_DAYS_PER_WEEK - carryForwardCount);
    const newSkills = unscheduledSkills.slice(0, newSkillsToAdd);

    // If no new skills and no carry-forward, we're done
    if (newSkills.length === 0 && carryForwardSkills.length === 0) {
      return ok(undefined);
    }

    // Calculate next week dates
    const nextStartDate = this.addDays(completedWeek.endDate, 1);
    const nextEndDate = this.addDays(nextStartDate, 6);

    // Generate theme for next week
    const theme = carryForwardSkills.length > 0
      ? `Review & Reinforce`
      : `Week ${completedWeek.weekNumber + 1}`;

    // Generate competence for next week
    const weeklyCompetence = newSkills.length > 0
      ? newSkills[0]!.action
      : carryForwardSkills[0]?.action ?? 'Continue practicing';

    const now = createTimestamp();

    // Calculate skill type counts
    const foundationCount = newSkills.filter((s: Skill) => s.skillType === 'foundation').length;
    const buildingCount = newSkills.filter((s: Skill) => s.skillType === 'building').length;
    const compoundCount = newSkills.filter((s: Skill) => s.skillType === 'compound').length;
    const hasSynthesis = newSkills.some((s: Skill) => s.skillType === 'synthesis');

    // Create day plans (5 days per week)
    const allSkillsForWeek = [...carryForwardSkills, ...newSkills];
    const days: DayPlan[] = [];
    for (let dayNumber = 1; dayNumber <= 5; dayNumber++) {
      const skillForDay = allSkillsForWeek[dayNumber - 1];
      if (skillForDay) {
        days.push({
          dayNumber,
          dayInQuest: skillForDay.dayInQuest ?? dayNumber,
          scheduledDate: this.addDays(nextStartDate, dayNumber - 1),
          skillId: skillForDay.id,
          skillType: skillForDay.skillType,
          skillTitle: skillForDay.title,
          reviewSkillId: undefined,
          reviewQuestId: undefined,
          status: 'pending' as const,
          drillId: undefined,
        });
      }
    }

    const nextWeek: WeekPlan = {
      id: createWeekPlanId(),
      goalId: completedWeek.goalId,
      userId: completedWeek.userId,
      questId: completedWeek.questId,
      weekNumber: completedWeek.weekNumber + 1,
      weekInQuest: completedWeek.weekInQuest + 1,
      isFirstWeekOfQuest: false,
      isLastWeekOfQuest: false, // Unknown without more context
      startDate: nextStartDate,
      endDate: nextEndDate,
      status: 'pending',
      weeklyCompetence,
      theme,
      days,
      scheduledSkillIds: newSkills.map((s: Skill) => s.id),
      carryForwardSkillIds: carryForwardSkills.map((s: Skill) => s.id),
      completedSkillIds: [],
      foundationCount,
      buildingCount,
      compoundCount,
      hasSynthesis,
      reviewsFromQuestIds: [],
      buildsOnSkillIds: [],
      drillsCompleted: 0,
      drillsTotal: newSkills.length + carryForwardSkills.length,
      drillsPassed: 0,
      drillsFailed: 0,
      drillsSkipped: 0,
      skillsMastered: 0,
      createdAt: now,
      updatedAt: now,
    };

    const saveResult = await this.weekPlanStore.save(nextWeek);
    if (!saveResult.ok) {
      return err(saveResult.error);
    }

    return ok(nextWeek);
  }

  /**
   * Add days to a date string.
   */
  private addDays(dateStr: string, days: number): string {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0]!;
  }

  /**
   * Truncate string with ellipsis.
   */
  private truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) {
      return str;
    }
    return str.slice(0, maxLength - 3) + '...';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a WeekTracker instance.
 */
export function createWeekTracker(deps: WeekTrackerDependencies): WeekTracker {
  return new WeekTracker(deps);
}
