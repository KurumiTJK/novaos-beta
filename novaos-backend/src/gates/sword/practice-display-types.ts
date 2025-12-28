// ═══════════════════════════════════════════════════════════════════════════════
// PRACTICE DISPLAY TYPES — Enhanced Chat Display Structures
// NovaOS Gates — Phase 19F: Practice Response Formats
// ═══════════════════════════════════════════════════════════════════════════════
//
// Structured types for rendering practice content in chat:
//
//   - DrillSectionDisplay: Warmup/Main/Stretch sections
//   - TodayDrillDisplay: Complete drill with all context
//   - WeekSummaryDisplay: Week plan with day breakdown
//   - SkillTreeNodeDisplay: Skill with status and dependencies
//   - GoalProgressDisplay: Overall progress with skill tree
//   - MilestoneDisplay: Quest milestone status
//
// These types bridge the internal data structures (DailyDrill, WeekPlan, Skill)
// to chat-friendly display formats.
//
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  SkillType,
  SkillStatus,
  SkillMastery,
  DrillStatus,
  DrillOutcome,
  MilestoneStatus,
  WeekPlanStatus,
} from '../../services/deliberate-practice-engine/types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// DRILL SECTION DISPLAY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A section of a daily drill for chat display.
 * Corresponds to DrillSection from deliberate-practice-engine.
 */
export interface DrillSectionDisplay {
  /** Section type */
  readonly type: 'warmup' | 'main' | 'stretch';

  /** Section title */
  readonly title: string;

  /** What to do */
  readonly action: string;

  /** Estimated time in minutes */
  readonly estimatedMinutes: number;

  /** Whether this section is optional */
  readonly isOptional: boolean;

  /** Success criteria (for main section) */
  readonly passSignal?: string;

  /** Constraint to follow */
  readonly constraint?: string;

  /** Whether this reviews a skill from a previous quest */
  readonly isFromPreviousQuest: boolean;

  /** Source quest title (if from previous quest) */
  readonly sourceQuestTitle?: string;

  /** Source skill title (if reviewing a specific skill) */
  readonly sourceSkillTitle?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TODAY'S DRILL DISPLAY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Complete today's drill for chat display.
 * Enhanced with structured sections and full context.
 */
export interface TodayDrillDisplay {
  // ─────────────────────────────────────────────────────────────────────────────
  // Identity
  // ─────────────────────────────────────────────────────────────────────────────

  /** Drill ID */
  readonly drillId: string;

  /** Goal ID */
  readonly goalId: string;

  /** Goal title */
  readonly goalTitle: string;

  /** Quest ID */
  readonly questId: string;

  /** Quest title */
  readonly questTitle: string;

  // ─────────────────────────────────────────────────────────────────────────────
  // Skill Information
  // ─────────────────────────────────────────────────────────────────────────────

  /** Skill ID being practiced */
  readonly skillId: string;

  /** Skill title */
  readonly skillTitle: string;

  /** Skill type in the progression */
  readonly skillType: SkillType;

  /** Human-readable skill type label */
  readonly skillTypeLabel: string;

  /** Current mastery level */
  readonly mastery: SkillMastery;

  // ─────────────────────────────────────────────────────────────────────────────
  // Scheduling
  // ─────────────────────────────────────────────────────────────────────────────

  /** Scheduled date (YYYY-MM-DD) */
  readonly scheduledDate: string;

  /** Day number in overall plan (1-based) */
  readonly dayNumber: number;

  /** Day within the week (1-5) */
  readonly dayInWeek: number;

  /** Day within the quest (1-based) */
  readonly dayInQuest: number;

  /** Week number in the goal (1-based) */
  readonly weekNumber: number;

  /** Current drill status */
  readonly status: DrillStatus;

  // ─────────────────────────────────────────────────────────────────────────────
  // Structured Sections
  // ─────────────────────────────────────────────────────────────────────────────

  /** Warmup section (review prerequisite or previous quest skill) */
  readonly warmup?: DrillSectionDisplay;

  /** Main practice section */
  readonly main: DrillSectionDisplay;

  /** Stretch challenge section (optional) */
  readonly stretch?: DrillSectionDisplay;

  // ─────────────────────────────────────────────────────────────────────────────
  // Legacy Flat Fields (for backward compatibility)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Today's specific action (from main section) */
  readonly action: string;

  /** Binary success criteria (from main section) */
  readonly passSignal: string;

  /** Single focus constraint */
  readonly constraint?: string;

  /** What NOT to change today */
  readonly lockedVariables: readonly string[];

  // ─────────────────────────────────────────────────────────────────────────────
  // Time
  // ─────────────────────────────────────────────────────────────────────────────

  /** Total estimated time in minutes */
  readonly totalMinutes: number;

  /** Warmup time (if present) */
  readonly warmupMinutes?: number;

  /** Main section time */
  readonly mainMinutes: number;

  /** Stretch time (if present) */
  readonly stretchMinutes?: number;

  // ─────────────────────────────────────────────────────────────────────────────
  // Retry Context
  // ─────────────────────────────────────────────────────────────────────────────

  /** Whether this is a retry of a failed skill */
  readonly isRetry: boolean;

  /** Number of times this skill has been retried */
  readonly retryCount: number;

  /** Context carried forward from previous drill */
  readonly continuationContext?: string;

  /** Previous drill ID (for continuation) */
  readonly previousDrillId?: string;

  // ─────────────────────────────────────────────────────────────────────────────
  // Cross-Quest Context
  // ─────────────────────────────────────────────────────────────────────────────

  /** Whether this is a compound skill spanning quests */
  readonly isCompound: boolean;

  /** Quest titles this drill builds on (for compound skills) */
  readonly buildsOnQuests?: readonly string[];

  /** Skill being reviewed in warmup */
  readonly reviewsSkillTitle?: string;

  /** Quest the review skill comes from */
  readonly reviewsQuestTitle?: string;

  // ─────────────────────────────────────────────────────────────────────────────
  // Resilience Layer (from Skill)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Intentional failure scenario — the adversary */
  readonly adversarialElement?: string;

  /** What happens when it fails — visible impact */
  readonly failureMode?: string;

  /** How to recover and learn from failure */
  readonly recoverySteps?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEEK SUMMARY DISPLAY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Day plan for week summary display.
 */
export interface DayPlanDisplay {
  /** Day number within the week (1-5) */
  readonly dayNumber: number;

  /** Day number within the quest (1-based) */
  readonly dayInQuest: number;

  /** Scheduled date (YYYY-MM-DD) */
  readonly scheduledDate?: string;

  /** Day of week name (Monday, Tuesday, etc.) */
  readonly dayName: string;

  /** Skill title for this day */
  readonly skillTitle: string;

  /** Skill type */
  readonly skillType: SkillType;

  /** Skill type emoji */
  readonly skillTypeEmoji: string;

  /** Day status */
  readonly status: 'pending' | 'completed' | 'skipped' | 'today';

  /** Drill outcome (if completed) */
  readonly outcome?: DrillOutcome;

  /** Whether this is today */
  readonly isToday: boolean;
}

/**
 * Week summary for chat display.
 */
export interface WeekSummaryDisplay {
  // ─────────────────────────────────────────────────────────────────────────────
  // Identity
  // ─────────────────────────────────────────────────────────────────────────────

  /** Week plan ID */
  readonly weekPlanId: string;

  /** Goal ID */
  readonly goalId: string;

  /** Goal title */
  readonly goalTitle: string;

  /** Quest ID */
  readonly questId: string;

  /** Quest title */
  readonly questTitle: string;

  // ─────────────────────────────────────────────────────────────────────────────
  // Week Info
  // ─────────────────────────────────────────────────────────────────────────────

  /** Week number in the goal (1-based) */
  readonly weekNumber: number;

  /** Week number within the quest (1-based) */
  readonly weekInQuest: number;

  /** Whether this is the first week of the quest */
  readonly isFirstWeekOfQuest: boolean;

  /** Whether this is the last week of the quest (has milestone) */
  readonly isLastWeekOfQuest: boolean;

  /** Week theme */
  readonly theme: string;

  /** Weekly competence target */
  readonly weeklyCompetence: string;

  /** Start date (YYYY-MM-DD) */
  readonly startDate: string;

  /** End date (YYYY-MM-DD) */
  readonly endDate: string;

  /** Week status */
  readonly status: WeekPlanStatus;

  // ─────────────────────────────────────────────────────────────────────────────
  // Days
  // ─────────────────────────────────────────────────────────────────────────────

  /** Day plans for this week */
  readonly days: readonly DayPlanDisplay[];

  /** Current day within the week (1-5, or 0 if not active) */
  readonly currentDayInWeek: number;

  // ─────────────────────────────────────────────────────────────────────────────
  // Progress
  // ─────────────────────────────────────────────────────────────────────────────

  /** Drills completed */
  readonly drillsCompleted: number;

  /** Drills total */
  readonly drillsTotal: number;

  /** Drills passed */
  readonly drillsPassed: number;

  /** Drills failed */
  readonly drillsFailed: number;

  /** Drills skipped */
  readonly drillsSkipped: number;

  /** Pass rate (0-1) */
  readonly passRate: number;

  /** Progress percentage (0-100) */
  readonly progressPercent: number;

  // ─────────────────────────────────────────────────────────────────────────────
  // Skill Type Breakdown
  // ─────────────────────────────────────────────────────────────────────────────

  /** Skill type counts */
  readonly skillTypes: {
    readonly foundation: number;
    readonly building: number;
    readonly compound: number;
    readonly synthesis: number;
  };

  /** Skills mastered this week */
  readonly skillsMastered: number;

  // ─────────────────────────────────────────────────────────────────────────────
  // Cross-Quest Context
  // ─────────────────────────────────────────────────────────────────────────────

  /** Previous quest titles this week reviews */
  readonly reviewsFromQuests: readonly string[];

  /** Key prerequisite skill titles from previous quests */
  readonly buildsOnSkills: readonly string[];

  // ─────────────────────────────────────────────────────────────────────────────
  // Milestone (if last week of quest)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Milestone info (present if isLastWeekOfQuest) */
  readonly milestone?: {
    readonly title: string;
    readonly status: MilestoneStatus;
    readonly requiredMasteryPercent: number;
    readonly currentMasteryPercent: number;
    readonly isUnlocked: boolean;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Carry Forward
  // ─────────────────────────────────────────────────────────────────────────────

  /** Skills carried forward from previous week */
  readonly carryForwardSkills: readonly string[];

  /** Next week focus (generated at week completion) */
  readonly nextWeekFocus?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SKILL TREE NODE DISPLAY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A skill node in the skill tree for progress display.
 */
export interface SkillTreeNodeDisplay {
  /** Skill ID */
  readonly skillId: string;

  /** Skill title */
  readonly title: string;

  /** Skill action (verb-first) */
  readonly action: string;

  /** Skill type in progression */
  readonly skillType: SkillType;

  /** Skill type emoji */
  readonly skillTypeEmoji: string;

  /** Availability status */
  readonly status: SkillStatus;

  /** Status emoji */
  readonly statusEmoji: string;

  /** Mastery level */
  readonly mastery: SkillMastery;

  /** Mastery emoji */
  readonly masteryEmoji: string;

  /** Depth in skill tree (0=foundation, 1=building, etc.) */
  readonly depth: number;

  /** Pass count */
  readonly passCount: number;

  /** Fail count */
  readonly failCount: number;

  /** Consecutive passes */
  readonly consecutivePasses: number;

  /** Number of prerequisites */
  readonly prerequisiteCount: number;

  /** Prerequisites titles (for locked skills) */
  readonly prerequisiteTitles?: readonly string[];

  /** Number of skills this unlocks */
  readonly unlocksCount: number;

  /** Whether this is a compound skill */
  readonly isCompound: boolean;

  /** Component skill titles (for compound skills) */
  readonly componentTitles?: readonly string[];

  /** Week number when scheduled */
  readonly weekNumber: number;

  /** Day in quest when scheduled */
  readonly dayInQuest: number;

  /** Last practiced date */
  readonly lastPracticedAt?: string;

  /** When mastered */
  readonly masteredAt?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GOAL PROGRESS DISPLAY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Quest progress summary for goal progress display.
 */
export interface QuestProgressSummary {
  /** Quest ID */
  readonly questId: string;

  /** Quest title */
  readonly title: string;

  /** Quest order (1-based) */
  readonly order: number;

  /** Duration label (e.g., "Week 1", "Weeks 2-4") */
  readonly durationLabel: string;

  /** Skills in this quest */
  readonly skillsTotal: number;

  /** Skills mastered */
  readonly skillsMastered: number;

  /** Progress percentage (0-100) */
  readonly percentComplete: number;

  /** Whether this is the current quest */
  readonly isCurrent: boolean;

  /** Milestone status */
  readonly milestoneStatus: MilestoneStatus;

  /** Milestone title */
  readonly milestoneTitle?: string;
}

/**
 * Goal progress for chat display.
 */
export interface GoalProgressDisplay {
  // ─────────────────────────────────────────────────────────────────────────────
  // Identity
  // ─────────────────────────────────────────────────────────────────────────────

  /** Goal ID */
  readonly goalId: string;

  /** Goal title */
  readonly goalTitle: string;

  /** Goal description */
  readonly goalDescription?: string;

  /** Goal status */
  readonly goalStatus: string;

  // ─────────────────────────────────────────────────────────────────────────────
  // Overall Progress
  // ─────────────────────────────────────────────────────────────────────────────

  /** Overall progress percentage (0-100) */
  readonly percentComplete: number;

  /** Days of practice completed */
  readonly daysCompleted: number;

  /** Total days planned */
  readonly daysTotal: number;

  /** Current week number */
  readonly currentWeek: number;

  /** Total weeks */
  readonly totalWeeks: number;

  /** On track? */
  readonly onTrack: boolean;

  /** Days behind schedule (if any) */
  readonly daysBehind: number;

  /** Estimated completion date */
  readonly estimatedCompletionDate: string;

  // ─────────────────────────────────────────────────────────────────────────────
  // Skills Overview
  // ─────────────────────────────────────────────────────────────────────────────

  /** Total skills */
  readonly skillsTotal: number;

  /** Skills mastered */
  readonly skillsMastered: number;

  /** Skills practicing */
  readonly skillsPracticing: number;

  /** Skills attempting */
  readonly skillsAttempting: number;

  /** Skills not started */
  readonly skillsNotStarted: number;

  /** Skills locked */
  readonly skillsLocked: number;

  // ─────────────────────────────────────────────────────────────────────────────
  // Skill Type Breakdown
  // ─────────────────────────────────────────────────────────────────────────────

  /** Skill type totals */
  readonly skillTypeBreakdown: {
    readonly foundation: { readonly total: number; readonly mastered: number };
    readonly building: { readonly total: number; readonly mastered: number };
    readonly compound: { readonly total: number; readonly mastered: number };
    readonly synthesis: { readonly total: number; readonly mastered: number };
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Streaks & Pass Rate
  // ─────────────────────────────────────────────────────────────────────────────

  /** Current practice streak (consecutive days) */
  readonly currentStreak: number;

  /** Longest practice streak */
  readonly longestStreak: number;

  /** Overall pass rate (0-1) */
  readonly overallPassRate: number;

  /** Last practice date */
  readonly lastPracticeDate?: string;

  // ─────────────────────────────────────────────────────────────────────────────
  // Quest Progress
  // ─────────────────────────────────────────────────────────────────────────────

  /** Progress by quest */
  readonly quests: readonly QuestProgressSummary[];

  /** Current quest */
  readonly currentQuest?: QuestProgressSummary;

  // ─────────────────────────────────────────────────────────────────────────────
  // Skill Tree (optional, for detailed view)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Skill tree nodes (optional, can be large) */
  readonly skillTree?: readonly SkillTreeNodeDisplay[];

  // ─────────────────────────────────────────────────────────────────────────────
  // Next Actions
  // ─────────────────────────────────────────────────────────────────────────────

  /** Suggested next actions */
  readonly suggestedActions: readonly string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// MILESTONE DISPLAY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Quest milestone for chat display.
 */
export interface MilestoneDisplay {
  // ─────────────────────────────────────────────────────────────────────────────
  // Identity
  // ─────────────────────────────────────────────────────────────────────────────

  /** Quest ID */
  readonly questId: string;

  /** Quest title */
  readonly questTitle: string;

  /** Quest order (1-based) */
  readonly questOrder: number;

  // ─────────────────────────────────────────────────────────────────────────────
  // Milestone Info
  // ─────────────────────────────────────────────────────────────────────────────

  /** Milestone title */
  readonly title: string;

  /** Detailed description */
  readonly description: string;

  /** The deliverable (what you build) */
  readonly artifact: string;

  /** Acceptance criteria */
  readonly acceptanceCriteria: readonly string[];

  /** Estimated time in minutes */
  readonly estimatedMinutes: number;

  // ─────────────────────────────────────────────────────────────────────────────
  // Status
  // ─────────────────────────────────────────────────────────────────────────────

  /** Current status */
  readonly status: MilestoneStatus;

  /** Status emoji */
  readonly statusEmoji: string;

  /** Status label */
  readonly statusLabel: string;

  /** Whether unlocked */
  readonly isUnlocked: boolean;

  /** Whether completed */
  readonly isCompleted: boolean;

  // ─────────────────────────────────────────────────────────────────────────────
  // Mastery Requirements
  // ─────────────────────────────────────────────────────────────────────────────

  /** Required mastery percentage to unlock (0-100) */
  readonly requiredMasteryPercent: number;

  /** Current mastery percentage (0-100) */
  readonly currentMasteryPercent: number;

  /** Skills mastered in this quest */
  readonly skillsMastered: number;

  /** Skills total in this quest */
  readonly skillsTotal: number;

  /** Skills still needed to unlock */
  readonly skillsNeededToUnlock: number;

  // ─────────────────────────────────────────────────────────────────────────────
  // Blocking Skills (if locked)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Skills that need to be mastered to unlock */
  readonly blockingSkills?: readonly {
    readonly title: string;
    readonly mastery: SkillMastery;
    readonly passCount: number;
    readonly passesNeeded: number;
  }[];

  // ─────────────────────────────────────────────────────────────────────────────
  // Timestamps
  // ─────────────────────────────────────────────────────────────────────────────

  /** When unlocked */
  readonly unlockedAt?: string;

  /** When completed */
  readonly completedAt?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Emoji for skill types.
 */
export const SKILL_TYPE_EMOJI: Record<SkillType, string> = {
  foundation: '🧱',
  building: '🔨',
  compound: '🔗',
  synthesis: '⭐',
};

/**
 * Labels for skill types.
 */
export const SKILL_TYPE_LABEL: Record<SkillType, string> = {
  foundation: 'Foundation',
  building: 'Building',
  compound: 'Compound',
  synthesis: 'Synthesis',
};

/**
 * Emoji for skill status.
 */
export const SKILL_STATUS_EMOJI: Record<SkillStatus, string> = {
  locked: '🔒',
  available: '🔓',
  in_progress: '🔄',
  mastered: '✅',
};

/**
 * Emoji for skill mastery.
 */
export const SKILL_MASTERY_EMOJI: Record<SkillMastery, string> = {
  not_started: '⏳',
  attempting: '🔄',
  practicing: '📝',
  mastered: '✅',
};

/**
 * Emoji for milestone status.
 */
export const MILESTONE_STATUS_EMOJI: Record<MilestoneStatus, string> = {
  locked: '🔒',
  available: '🎯',
  in_progress: '🚀',
  completed: '🏆',
};

/**
 * Labels for milestone status.
 */
export const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
  locked: 'Locked',
  available: 'Ready to Start',
  in_progress: 'In Progress',
  completed: 'Completed',
};

/**
 * Day names for week display.
 */
export const DAY_NAMES: readonly string[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
];
