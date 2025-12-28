// ═══════════════════════════════════════════════════════════════════════════════
// PRACTICE RESPONSE FORMATTER — Markdown Chat Message Generation
// NovaOS Gates — Phase 19F: Practice Response Formats
// ═══════════════════════════════════════════════════════════════════════════════
//
// Converts structured display types to human-readable markdown for chat:
//
//   - formatDrillForChat() → Today's drill with sections
//   - formatWeekForChat() → Week summary with days
//   - formatProgressForChat() → Goal progress with skill breakdown
//   - formatMilestoneForChat() → Milestone status and requirements
//
// Design principles:
//   - Clear visual hierarchy with headers and separators
//   - Emoji for quick scanning
//   - Actionable instructions at the end
//   - Compact but complete information
//
// ═══════════════════════════════════════════════════════════════════════════════

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
} from './practice-display-types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// DRILL FORMATTER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format today's drill for chat display.
 *
 * Produces a structured markdown message with:
 * - Header with day/week context
 * - Skill info with type badge
 * - Warmup section (if present)
 * - Main practice section
 * - Stretch challenge (if present)
 * - Instructions for completion
 */
export function formatDrillForChat(drill: TodayDrillDisplay): string {
  const lines: string[] = [];

  // ─────────────────────────────────────────────────────────────────────────────
  // Header
  // ─────────────────────────────────────────────────────────────────────────────

  lines.push(`📚 **Today's Practice** — Day ${drill.dayInQuest}, Week ${drill.weekNumber}`);
  lines.push('');

  // Skill info with type badge
  const typeEmoji = SKILL_TYPE_EMOJI[drill.skillType];
  const typeLabel = SKILL_TYPE_LABEL[drill.skillType];
  lines.push(`**Skill:** ${drill.skillTitle} ${typeEmoji} *${typeLabel}*`);

  // Cross-quest context
  if (drill.isCompound && drill.buildsOnQuests && drill.buildsOnQuests.length > 0) {
    lines.push(`🔗 *Builds on: ${drill.buildsOnQuests.join(', ')}*`);
  }

  // Retry context
  if (drill.isRetry) {
    if (drill.retryCount === 1) {
      lines.push(`🔄 *Retry — different approach today*`);
    } else if (drill.retryCount >= 2) {
      lines.push(`🔄 *Retry #${drill.retryCount} — simplified version*`);
    }
  }

  // Continuation context
  if (drill.continuationContext) {
    lines.push('');
    lines.push(`📝 *Previous context:* ${drill.continuationContext}`);
  }

  lines.push('');

  // ─────────────────────────────────────────────────────────────────────────────
  // Warmup Section
  // ─────────────────────────────────────────────────────────────────────────────

  if (drill.warmup) {
    lines.push('───────────────────────────────────────');
    lines.push('');
    lines.push(formatSection(drill.warmup));
    lines.push('');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Main Section
  // ─────────────────────────────────────────────────────────────────────────────

  lines.push('───────────────────────────────────────');
  lines.push('');
  lines.push(formatSection(drill.main));
  lines.push('');

  // ─────────────────────────────────────────────────────────────────────────────
  // Stretch Section
  // ─────────────────────────────────────────────────────────────────────────────

  if (drill.stretch) {
    lines.push('───────────────────────────────────────');
    lines.push('');
    lines.push(formatSection(drill.stretch));
    lines.push('');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Resilience Info (if present)
  // ─────────────────────────────────────────────────────────────────────────────

  if (drill.adversarialElement || drill.failureMode) {
    lines.push('───────────────────────────────────────');
    lines.push('');
    lines.push('💡 **Learning Edge**');
    if (drill.adversarialElement) {
      lines.push(`*Challenge:* ${drill.adversarialElement}`);
    }
    if (drill.failureMode) {
      lines.push(`*If stuck:* ${drill.failureMode}`);
    }
    if (drill.recoverySteps) {
      lines.push(`*Recovery:* ${drill.recoverySteps}`);
    }
    lines.push('');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Footer
  // ─────────────────────────────────────────────────────────────────────────────

  lines.push('───────────────────────────────────────');
  lines.push('');
  lines.push(`⏱️ Total: ~${drill.totalMinutes} min`);
  lines.push('');
  lines.push('When done, say **"I\'m done"** or **"I finished"**.');
  lines.push('If you need to skip, say **"Skip today"**.');

  return lines.join('\n');
}

/**
 * Format a drill section.
 */
function formatSection(section: DrillSectionDisplay): string {
  const lines: string[] = [];

  // Section header with emoji and time
  const sectionEmoji = getSectionEmoji(section.type);
  const optionalTag = section.isOptional ? ' — *optional*' : '';
  lines.push(`${sectionEmoji} **${section.title}** (${section.estimatedMinutes} min)${optionalTag}`);

  // Cross-quest review note
  if (section.isFromPreviousQuest && section.sourceQuestTitle) {
    lines.push(`*Review from ${section.sourceQuestTitle}*`);
  }

  // Action
  lines.push(section.action);

  // Pass signal (for main section)
  if (section.passSignal) {
    lines.push('');
    lines.push(`**Success Signal:**`);
    lines.push(section.passSignal);
  }

  // Constraint
  if (section.constraint) {
    lines.push('');
    lines.push(`**Constraint:**`);
    lines.push(section.constraint);
  }

  return lines.join('\n');
}

/**
 * Get emoji for section type.
 */
function getSectionEmoji(type: 'warmup' | 'main' | 'stretch'): string {
  switch (type) {
    case 'warmup':
      return '🔥';
    case 'main':
      return '🎯';
    case 'stretch':
      return '⚡';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEEK FORMATTER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format week summary for chat display.
 *
 * Produces a structured markdown message with:
 * - Header with week theme
 * - Progress bar and stats
 * - Day-by-day breakdown
 * - Milestone info (if last week of quest)
 */
export function formatWeekForChat(week: WeekSummaryDisplay): string {
  const lines: string[] = [];

  // ─────────────────────────────────────────────────────────────────────────────
  // Header
  // ─────────────────────────────────────────────────────────────────────────────

  lines.push(`📅 **Week ${week.weekNumber}** — ${week.theme}`);
  lines.push('');

  // Quest context
  if (week.questTitle) {
    lines.push(`*${week.questTitle}* • Week ${week.weekInQuest}`);
    lines.push('');
  }

  // Weekly competence
  lines.push(`🎯 **Goal:** ${week.weeklyCompetence}`);
  lines.push('');

  // ─────────────────────────────────────────────────────────────────────────────
  // Progress
  // ─────────────────────────────────────────────────────────────────────────────

  const progressBar = generateProgressBar(week.progressPercent);
  lines.push(`**Progress:** ${progressBar} ${week.progressPercent}%`);
  lines.push('');

  // Stats
  lines.push(`✅ ${week.drillsPassed} passed • ❌ ${week.drillsFailed} failed • ⏭️ ${week.drillsSkipped} skipped`);

  if (week.skillsMastered > 0) {
    lines.push(`🌟 ${week.skillsMastered} skill${week.skillsMastered > 1 ? 's' : ''} mastered this week`);
  }
  lines.push('');

  // ─────────────────────────────────────────────────────────────────────────────
  // Day Breakdown
  // ─────────────────────────────────────────────────────────────────────────────

  lines.push('───────────────────────────────────────');
  lines.push('');
  lines.push('**This Week:**');
  lines.push('');

  for (const day of week.days) {
    lines.push(formatDayPlan(day));
  }

  lines.push('');

  // ─────────────────────────────────────────────────────────────────────────────
  // Skill Type Breakdown
  // ─────────────────────────────────────────────────────────────────────────────

  const hasSkillTypes =
    week.skillTypes.foundation > 0 ||
    week.skillTypes.building > 0 ||
    week.skillTypes.compound > 0 ||
    week.skillTypes.synthesis > 0;

  if (hasSkillTypes) {
    lines.push('───────────────────────────────────────');
    lines.push('');
    lines.push('**Skill Focus:**');

    const typeParts: string[] = [];
    if (week.skillTypes.foundation > 0) {
      typeParts.push(`🧱 ${week.skillTypes.foundation} foundation`);
    }
    if (week.skillTypes.building > 0) {
      typeParts.push(`🔨 ${week.skillTypes.building} building`);
    }
    if (week.skillTypes.compound > 0) {
      typeParts.push(`🔗 ${week.skillTypes.compound} compound`);
    }
    if (week.skillTypes.synthesis > 0) {
      typeParts.push(`⭐ ${week.skillTypes.synthesis} synthesis`);
    }

    lines.push(typeParts.join(' • '));
    lines.push('');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Cross-Quest Context
  // ─────────────────────────────────────────────────────────────────────────────

  if (week.reviewsFromQuests.length > 0) {
    lines.push('───────────────────────────────────────');
    lines.push('');
    lines.push(`🔄 **Reviews from:** ${week.reviewsFromQuests.join(', ')}`);
    lines.push('');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Milestone (if last week)
  // ─────────────────────────────────────────────────────────────────────────────

  if (week.isLastWeekOfQuest && week.milestone) {
    lines.push('───────────────────────────────────────');
    lines.push('');
    lines.push(formatWeekMilestone(week.milestone));
    lines.push('');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Carry Forward
  // ─────────────────────────────────────────────────────────────────────────────

  if (week.carryForwardSkills.length > 0) {
    lines.push('───────────────────────────────────────');
    lines.push('');
    lines.push(`📌 **Carried from last week:** ${week.carryForwardSkills.join(', ')}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format a day plan for week display.
 */
function formatDayPlan(day: DayPlanDisplay): string {
  const statusEmoji = getDayStatusEmoji(day.status, day.outcome);
  const typeEmoji = day.skillTypeEmoji || SKILL_TYPE_EMOJI[day.skillType];
  const todayMarker = day.isToday ? ' **← TODAY**' : '';

  return `${statusEmoji} **${day.dayName}** — ${typeEmoji} ${day.skillTitle}${todayMarker}`;
}

/**
 * Get emoji for day status.
 */
function getDayStatusEmoji(status: string, outcome?: string): string {
  if (status === 'completed') {
    return outcome === 'pass' ? '✅' : outcome === 'fail' ? '❌' : '⏭️';
  }
  if (status === 'skipped') return '⏭️';
  if (status === 'today') return '📍';
  return '⬜';
}

/**
 * Format milestone for week display (compact version).
 */
function formatWeekMilestone(milestone: {
  title: string;
  status: string;
  requiredMasteryPercent: number;
  currentMasteryPercent: number;
  isUnlocked: boolean;
}): string {
  const lines: string[] = [];

  const statusEmoji = milestone.isUnlocked ? '🎯' : '🔒';
  lines.push(`${statusEmoji} **Milestone:** ${milestone.title}`);

  if (!milestone.isUnlocked) {
    const remaining = milestone.requiredMasteryPercent - milestone.currentMasteryPercent;
    lines.push(`*Need ${remaining}% more mastery to unlock*`);
  } else {
    lines.push(`*Ready to attempt!*`);
  }

  return lines.join('\n');
}

/**
 * Generate ASCII progress bar.
 */
function generateProgressBar(percent: number, width: number = 10): string {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRESS FORMATTER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format goal progress for chat display.
 *
 * Produces a structured markdown message with:
 * - Overall progress stats
 * - Skills breakdown by mastery
 * - Quest progress
 * - Streaks and pass rate
 */
export function formatProgressForChat(progress: GoalProgressDisplay): string {
  const lines: string[] = [];

  // ─────────────────────────────────────────────────────────────────────────────
  // Header
  // ─────────────────────────────────────────────────────────────────────────────

  lines.push(`📊 **Progress: ${progress.goalTitle}**`);
  lines.push('');

  // ─────────────────────────────────────────────────────────────────────────────
  // Overall Progress
  // ─────────────────────────────────────────────────────────────────────────────

  const progressBar = generateProgressBar(progress.percentComplete, 15);
  lines.push(`**Overall:** ${progressBar} ${progress.percentComplete}%`);
  lines.push('');

  lines.push(`📅 Week ${progress.currentWeek} of ${progress.totalWeeks}`);
  lines.push(`📝 Day ${progress.daysCompleted} of ${progress.daysTotal}`);

  if (!progress.onTrack && progress.daysBehind > 0) {
    lines.push(`⚠️ ${progress.daysBehind} day${progress.daysBehind > 1 ? 's' : ''} behind`);
  }

  lines.push('');

  // ─────────────────────────────────────────────────────────────────────────────
  // Skills Breakdown
  // ─────────────────────────────────────────────────────────────────────────────

  lines.push('───────────────────────────────────────');
  lines.push('');
  lines.push('**Skills:**');
  lines.push('');
  lines.push(`✅ Mastered: ${progress.skillsMastered}`);
  lines.push(`📝 Practicing: ${progress.skillsPracticing}`);
  lines.push(`🔄 Attempting: ${progress.skillsAttempting}`);
  lines.push(`⏳ Not Started: ${progress.skillsNotStarted}`);

  if (progress.skillsLocked > 0) {
    lines.push(`🔒 Locked: ${progress.skillsLocked}`);
  }

  lines.push(`**Total:** ${progress.skillsTotal}`);
  lines.push('');

  // ─────────────────────────────────────────────────────────────────────────────
  // Skill Type Breakdown
  // ─────────────────────────────────────────────────────────────────────────────

  lines.push('───────────────────────────────────────');
  lines.push('');
  lines.push('**By Type:**');
  lines.push('');

  const { skillTypeBreakdown: types } = progress;
  lines.push(`🧱 Foundation: ${types.foundation.mastered}/${types.foundation.total}`);
  lines.push(`🔨 Building: ${types.building.mastered}/${types.building.total}`);
  lines.push(`🔗 Compound: ${types.compound.mastered}/${types.compound.total}`);
  lines.push(`⭐ Synthesis: ${types.synthesis.mastered}/${types.synthesis.total}`);
  lines.push('');

  // ─────────────────────────────────────────────────────────────────────────────
  // Streaks & Pass Rate
  // ─────────────────────────────────────────────────────────────────────────────

  lines.push('───────────────────────────────────────');
  lines.push('');

  if (progress.currentStreak > 0) {
    lines.push(`🔥 **Streak:** ${progress.currentStreak} day${progress.currentStreak > 1 ? 's' : ''}`);
  }
  if (progress.longestStreak > progress.currentStreak) {
    lines.push(`🏆 **Best Streak:** ${progress.longestStreak} days`);
  }

  const passPercent = Math.round(progress.overallPassRate * 100);
  lines.push(`📈 **Pass Rate:** ${passPercent}%`);
  lines.push('');

  // ─────────────────────────────────────────────────────────────────────────────
  // Quest Progress
  // ─────────────────────────────────────────────────────────────────────────────

  if (progress.quests.length > 0) {
    lines.push('───────────────────────────────────────');
    lines.push('');
    lines.push('**Quests:**');
    lines.push('');

    for (const quest of progress.quests) {
      lines.push(formatQuestProgress(quest));
    }
    lines.push('');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Suggested Actions
  // ─────────────────────────────────────────────────────────────────────────────

  if (progress.suggestedActions.length > 0) {
    lines.push('───────────────────────────────────────');
    lines.push('');
    lines.push('**Next:**');
    for (const action of progress.suggestedActions) {
      lines.push(`• ${action}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format quest progress for progress display.
 */
function formatQuestProgress(quest: QuestProgressSummary): string {
  const currentMarker = quest.isCurrent ? ' ← *current*' : '';
  const milestoneEmoji = MILESTONE_STATUS_EMOJI[quest.milestoneStatus] || '';
  const progressBar = generateProgressBar(quest.percentComplete, 5);

  return `${quest.order}. ${quest.title} ${progressBar} ${quest.percentComplete}% ${milestoneEmoji}${currentMarker}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MILESTONE FORMATTER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format milestone for chat display.
 *
 * Produces a detailed markdown message with:
 * - Milestone title and status
 * - Artifact description
 * - Acceptance criteria
 * - Mastery requirements
 * - Blocking skills (if locked)
 */
export function formatMilestoneForChat(milestone: MilestoneDisplay): string {
  const lines: string[] = [];

  // ─────────────────────────────────────────────────────────────────────────────
  // Header
  // ─────────────────────────────────────────────────────────────────────────────

  lines.push(`${milestone.statusEmoji} **Milestone: ${milestone.title}**`);
  lines.push('');
  lines.push(`*${milestone.questTitle}* • Quest ${milestone.questOrder}`);
  lines.push('');

  // Status badge
  lines.push(`**Status:** ${milestone.statusLabel}`);
  lines.push('');

  // ─────────────────────────────────────────────────────────────────────────────
  // Description
  // ─────────────────────────────────────────────────────────────────────────────

  if (milestone.description) {
    lines.push(milestone.description);
    lines.push('');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Artifact
  // ─────────────────────────────────────────────────────────────────────────────

  lines.push('───────────────────────────────────────');
  lines.push('');
  lines.push('📦 **Deliverable:**');
  lines.push(milestone.artifact);
  lines.push('');

  // ─────────────────────────────────────────────────────────────────────────────
  // Acceptance Criteria
  // ─────────────────────────────────────────────────────────────────────────────

  if (milestone.acceptanceCriteria.length > 0) {
    lines.push('───────────────────────────────────────');
    lines.push('');
    lines.push('✅ **Acceptance Criteria:**');
    for (const criterion of milestone.acceptanceCriteria) {
      lines.push(`• ${criterion}`);
    }
    lines.push('');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Time Estimate
  // ─────────────────────────────────────────────────────────────────────────────

  lines.push(`⏱️ **Estimated time:** ${milestone.estimatedMinutes} minutes`);
  lines.push('');

  // ─────────────────────────────────────────────────────────────────────────────
  // Mastery Progress
  // ─────────────────────────────────────────────────────────────────────────────

  lines.push('───────────────────────────────────────');
  lines.push('');

  const masteryBar = generateProgressBar(milestone.currentMasteryPercent, 10);
  lines.push(`**Quest Mastery:** ${masteryBar} ${milestone.currentMasteryPercent}%`);
  lines.push(`*Requires ${milestone.requiredMasteryPercent}% to unlock*`);
  lines.push('');
  lines.push(`Skills: ${milestone.skillsMastered}/${milestone.skillsTotal} mastered`);
  lines.push('');

  // ─────────────────────────────────────────────────────────────────────────────
  // Blocking Skills (if locked)
  // ─────────────────────────────────────────────────────────────────────────────

  if (!milestone.isUnlocked && milestone.blockingSkills && milestone.blockingSkills.length > 0) {
    lines.push('───────────────────────────────────────');
    lines.push('');
    lines.push('🔒 **Skills to Master:**');
    lines.push('');

    for (const skill of milestone.blockingSkills) {
      const passProgress = `${skill.passCount}/${skill.passesNeeded}`;
      const emoji = SKILL_MASTERY_EMOJI[skill.mastery] || '⏳';
      lines.push(`${emoji} ${skill.title} — ${passProgress} passes`);
    }
    lines.push('');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Call to Action
  // ─────────────────────────────────────────────────────────────────────────────

  lines.push('───────────────────────────────────────');
  lines.push('');

  if (milestone.isCompleted) {
    lines.push('🏆 **Congratulations!** You completed this milestone.');
    if (milestone.completedAt) {
      lines.push(`*Completed: ${formatDate(milestone.completedAt)}*`);
    }
  } else if (milestone.isUnlocked) {
    lines.push('🎯 **Ready to attempt!** Say "start milestone" when you\'re ready.');
  } else {
    lines.push(`🔒 Master ${milestone.skillsNeededToUnlock} more skill${milestone.skillsNeededToUnlock > 1 ? 's' : ''} to unlock.`);
  }

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// SKILL TREE FORMATTER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format skill tree for detailed progress view.
 *
 * Groups skills by type and shows dependencies.
 */
export function formatSkillTreeForChat(skills: readonly SkillTreeNodeDisplay[]): string {
  const lines: string[] = [];

  lines.push('🌳 **Skill Tree**');
  lines.push('');

  // Group by skill type
  const foundation = skills.filter(s => s.skillType === 'foundation');
  const building = skills.filter(s => s.skillType === 'building');
  const compound = skills.filter(s => s.skillType === 'compound');
  const synthesis = skills.filter(s => s.skillType === 'synthesis');

  if (foundation.length > 0) {
    lines.push('**🧱 Foundation**');
    for (const skill of foundation) {
      lines.push(formatSkillNode(skill));
    }
    lines.push('');
  }

  if (building.length > 0) {
    lines.push('**🔨 Building**');
    for (const skill of building) {
      lines.push(formatSkillNode(skill));
    }
    lines.push('');
  }

  if (compound.length > 0) {
    lines.push('**🔗 Compound**');
    for (const skill of compound) {
      lines.push(formatSkillNode(skill));
    }
    lines.push('');
  }

  if (synthesis.length > 0) {
    lines.push('**⭐ Synthesis**');
    for (const skill of synthesis) {
      lines.push(formatSkillNode(skill));
    }
  }

  return lines.join('\n');
}

/**
 * Format a single skill node.
 */
function formatSkillNode(skill: SkillTreeNodeDisplay): string {
  const statusEmoji = skill.statusEmoji || SKILL_STATUS_EMOJI[skill.status];
  const masteryEmoji = skill.masteryEmoji || SKILL_MASTERY_EMOJI[skill.mastery];

  let line = `  ${statusEmoji} ${skill.title}`;

  if (skill.status === 'mastered') {
    line += ` ${masteryEmoji}`;
  } else if (skill.status === 'in_progress') {
    line += ` — ${skill.passCount}/${skill.consecutivePasses + 2} passes`;
  } else if (skill.status === 'locked' && skill.prerequisiteTitles && skill.prerequisiteTitles.length > 0) {
    line += ` ← needs: ${skill.prerequisiteTitles.slice(0, 2).join(', ')}`;
    if (skill.prerequisiteTitles.length > 2) {
      line += ` +${skill.prerequisiteTitles.length - 2} more`;
    }
  }

  return line;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPACT FORMATTERS (for brief responses)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format a compact drill summary (for reminders).
 */
export function formatDrillCompact(drill: TodayDrillDisplay): string {
  const typeEmoji = SKILL_TYPE_EMOJI[drill.skillType];
  return `${typeEmoji} **${drill.skillTitle}** — ${drill.action.slice(0, 100)}${drill.action.length > 100 ? '...' : ''} (~${drill.totalMinutes} min)`;
}

/**
 * Format a compact progress summary.
 */
export function formatProgressCompact(progress: GoalProgressDisplay): string {
  const bar = generateProgressBar(progress.percentComplete, 8);
  return `${bar} ${progress.percentComplete}% • ${progress.skillsMastered}/${progress.skillsTotal} skills • 🔥 ${progress.currentStreak} day streak`;
}

/**
 * Format a compact week summary.
 */
export function formatWeekCompact(week: WeekSummaryDisplay): string {
  const bar = generateProgressBar(week.progressPercent, 8);
  return `Week ${week.weekNumber}: ${bar} ${week.progressPercent}% • ${week.drillsCompleted}/${week.drillsTotal} drills`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format a date string for display.
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}
