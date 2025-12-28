// ═══════════════════════════════════════════════════════════════════════════════
// PRACTICE DISPLAY EXPORTS — Phase 19F Enhanced Chat Response Formats
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// DISPLAY TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type {
  DrillSectionDisplay,
  TodayDrillDisplay,
  DayPlanDisplay,
  WeekSummaryDisplay,
  SkillTreeNodeDisplay,
  QuestProgressSummary,
  GoalProgressDisplay,
  MilestoneDisplay,
} from './practice-display-types.js';

export {
  SKILL_TYPE_EMOJI,
  SKILL_TYPE_LABEL,
  SKILL_STATUS_EMOJI,
  SKILL_MASTERY_EMOJI,
  MILESTONE_STATUS_EMOJI,
  MILESTONE_STATUS_LABEL,
  DAY_NAMES,
} from './practice-display-types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// DISPLAY BUILDERS
// ─────────────────────────────────────────────────────────────────────────────────

export type {
  DrillDisplayContext,
  WeekDisplayContext,
  ProgressDisplayContext,
  MilestoneDisplayContext,
} from './practice-display-builder.js';

export {
  buildTodayDrillDisplay,
  buildWeekSummaryDisplay,
  buildGoalProgressDisplay,
  buildMilestoneDisplay,
  buildSkillTreeDisplay,
  buildDrillDisplayFromPracticeResult,
} from './practice-display-builder.js';

// ─────────────────────────────────────────────────────────────────────────────────
// RESPONSE FORMATTERS
// ─────────────────────────────────────────────────────────────────────────────────

export {
  formatDrillForChat,
  formatWeekForChat,
  formatProgressForChat,
  formatMilestoneForChat,
  formatSkillTreeForChat,
  formatDrillCompact,
  formatProgressCompact,
  formatWeekCompact,
} from './practice-response-formatter.js';
