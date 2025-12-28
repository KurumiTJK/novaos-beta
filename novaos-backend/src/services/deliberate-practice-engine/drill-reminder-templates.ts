// ═══════════════════════════════════════════════════════════════════════════════
// DRILL REMINDER TEMPLATES — Escalation-Aware Practice Reminders
// NovaOS Deliberate Practice Engine — Phase 19G: Spark Reminder Integration
// ═══════════════════════════════════════════════════════════════════════════════
//
// Generates drill-aware reminder messages based on:
//   - Escalation level (0-3)
//   - Spark variant (full/reduced/minimal)
//   - Skill type (foundation/building/compound/synthesis)
//   - Retry context
//
// Escalation Pattern:
//   Level 0 (9 AM): Encouraging, full details
//   Level 1 (12 PM): Gentle nudge, action-focused
//   Level 2 (3 PM): Urgent, simplified task
//   Level 3 (6 PM): Last chance, just start
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { SparkVariant } from '../../services/spark-engine/types.js';
import type { DailyDrill, Skill, SkillType } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Escalation level for reminder progression.
 */
export type EscalationLevel = 0 | 1 | 2 | 3;

/**
 * Context for generating drill reminder messages.
 */
export interface DrillReminderContext {
  /** The drill to remind about */
  readonly drill: DailyDrill;

  /** The skill being practiced */
  readonly skill: Skill | null;

  /** Goal title for context */
  readonly goalTitle: string;

  /** Escalation level (0-3) */
  readonly escalationLevel: EscalationLevel;

  /** Spark variant for this reminder */
  readonly variant: SparkVariant;

  /** User's name (optional) */
  readonly userName?: string;

  /** Current streak (optional) */
  readonly currentStreak?: number;
}

/**
 * Generated reminder message.
 */
export interface DrillReminderMessage {
  /** Main message text */
  readonly text: string;

  /** Subject line (for email) */
  readonly subject: string;

  /** Short message (for SMS/push) */
  readonly shortText: string;

  /** Action URL or deep link */
  readonly actionUrl?: string;

  /** Escalation level used */
  readonly escalationLevel: EscalationLevel;

  /** Variant used */
  readonly variant: SparkVariant;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Skill type emoji for messages.
 */
const SKILL_TYPE_EMOJI: Record<SkillType, string> = {
  foundation: '🧱',
  building: '🔨',
  compound: '🔗',
  synthesis: '⭐',
};

/**
 * Skill type labels.
 */
const SKILL_TYPE_LABELS: Record<SkillType, string> = {
  foundation: 'Foundation',
  building: 'Building',
  compound: 'Compound',
  synthesis: 'Synthesis',
};

/**
 * Opening greetings by time of day (escalation level).
 */
const GREETINGS: Record<EscalationLevel, readonly string[]> = {
  0: ['Good morning!', 'Rise and shine!', 'Ready to learn?', 'Morning!'],
  1: ['Quick reminder:', 'Hey there!', 'Don\'t forget:', 'Checking in:'],
  2: ['Time\'s running out:', 'Still time today:', 'Last call:', 'Quick practice:'],
  3: ['Final reminder:', 'Just do this:', 'One small step:', 'Before day ends:'],
};

/**
 * Closing encouragements by escalation level.
 */
const CLOSINGS: Record<EscalationLevel, readonly string[]> = {
  0: ['You\'ve got this!', 'Let\'s make progress!', 'Small steps, big results!'],
  1: ['Just a few minutes!', 'You can do it!', 'Progress awaits!'],
  2: ['Any progress counts!', 'Just start!', 'Even 5 minutes helps!'],
  3: ['Just open it.', 'Start = win.', 'Tomorrow starts fresh.'],
};

/**
 * Streak encouragements.
 */
const STREAK_MESSAGES: Record<number, string> = {
  3: '🔥 3-day streak! Keep it going!',
  5: '🔥 5 days strong! Impressive!',
  7: '🔥 One week streak! Amazing!',
  14: '🔥 Two weeks! You\'re unstoppable!',
  30: '🔥 30 days! Legendary!',
};

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a drill reminder message based on context.
 */
export function generateDrillReminderMessage(
  context: DrillReminderContext
): DrillReminderMessage {
  const { drill, skill, escalationLevel, variant } = context;

  // Generate components
  const greeting = pickRandom(GREETINGS[escalationLevel]);
  const closing = pickRandom(CLOSINGS[escalationLevel]);
  const skillType = skill?.skillType ?? 'foundation';
  const skillEmoji = SKILL_TYPE_EMOJI[skillType];

  // Build message based on escalation level
  let text: string;
  let shortText: string;
  let subject: string;

  switch (escalationLevel) {
    case 0:
      ({ text, shortText, subject } = generateLevel0Message(context, greeting, closing, skillEmoji));
      break;
    case 1:
      ({ text, shortText, subject } = generateLevel1Message(context, greeting, closing, skillEmoji));
      break;
    case 2:
      ({ text, shortText, subject } = generateLevel2Message(context, greeting, closing, skillEmoji));
      break;
    case 3:
      ({ text, shortText, subject } = generateLevel3Message(context, greeting, closing, skillEmoji));
      break;
  }

  return {
    text,
    subject,
    shortText,
    escalationLevel,
    variant,
  };
}

/**
 * Generate subject line for drill reminder.
 */
export function generateDrillReminderSubject(context: DrillReminderContext): string {
  const { drill, escalationLevel } = context;

  switch (escalationLevel) {
    case 0:
      return `📚 Today's Practice: ${truncate(drill.action, 40)}`;
    case 1:
      return `⏰ Practice Reminder: ${truncate(drill.action, 35)}`;
    case 2:
      return `⚡ Quick Practice (~${Math.ceil(drill.estimatedMinutes / 2)} min)`;
    case 3:
      return `🎯 Just Start: ${truncate(drill.action, 30)}`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEVEL-SPECIFIC GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Level 0 (Morning): Full details, encouraging tone.
 */
function generateLevel0Message(
  context: DrillReminderContext,
  greeting: string,
  closing: string,
  skillEmoji: string
): { text: string; shortText: string; subject: string } {
  const { drill, skill, goalTitle, currentStreak, userName } = context;

  const lines: string[] = [];

  // Greeting with name
  if (userName) {
    lines.push(`${greeting} ${userName}`);
  } else {
    lines.push(greeting);
  }
  lines.push('');

  // Goal context
  lines.push(`📚 **${goalTitle}**`);
  lines.push('');

  // Skill info
  if (skill) {
    lines.push(`${skillEmoji} **${skill.action}**`);
    lines.push('');
  }

  // Today's task
  lines.push('**Your task:**');
  lines.push(drill.action);
  lines.push('');

  // Pass signal
  lines.push('**Success signal:**');
  lines.push(drill.passSignal);
  lines.push('');

  // Time estimate
  lines.push(`⏱️ ~${drill.estimatedMinutes} minutes`);
  lines.push('');

  // Streak
  if (currentStreak && currentStreak >= 3) {
    const streakMsg = getStreakMessage(currentStreak);
    if (streakMsg) {
      lines.push(streakMsg);
      lines.push('');
    }
  }

  // Closing
  lines.push(closing);

  // Short text for push
  const shortText = `${skillEmoji} ${truncate(drill.action, 50)} (~${drill.estimatedMinutes} min)`;

  // Subject
  const subject = `📚 Today's Practice: ${truncate(skill?.action ?? drill.action, 40)}`;

  return {
    text: lines.join('\n'),
    shortText,
    subject,
  };
}

/**
 * Level 1 (Midday): Action-focused, gentle nudge.
 */
function generateLevel1Message(
  context: DrillReminderContext,
  greeting: string,
  closing: string,
  skillEmoji: string
): { text: string; shortText: string; subject: string } {
  const { drill, skill } = context;

  const lines: string[] = [];

  lines.push(greeting);
  lines.push('');

  // Direct to action
  lines.push(`${skillEmoji} **${skill?.action ?? 'Practice'}**`);
  lines.push('');
  lines.push(drill.action);
  lines.push('');

  // Pass signal
  lines.push(`✅ Done when: ${drill.passSignal}`);
  lines.push('');

  lines.push(`⏱️ ~${drill.estimatedMinutes} min • ${closing}`);

  // Short text
  const shortText = `${skillEmoji} ${truncate(drill.action, 60)} (~${drill.estimatedMinutes} min)`;

  // Subject
  const subject = `⏰ Practice Reminder: ${truncate(skill?.action ?? drill.action, 35)}`;

  return {
    text: lines.join('\n'),
    shortText,
    subject,
  };
}

/**
 * Level 2 (Afternoon): Urgent, simplified task.
 */
function generateLevel2Message(
  context: DrillReminderContext,
  greeting: string,
  closing: string,
  skillEmoji: string
): { text: string; shortText: string; subject: string } {
  const { drill, skill } = context;

  // Simplify the action
  const simplifiedAction = simplifyAction(drill.action);
  const reducedTime = Math.ceil(drill.estimatedMinutes / 2);

  const lines: string[] = [];

  lines.push(greeting);
  lines.push('');

  lines.push(`${skillEmoji} **Quick practice** (~${reducedTime} min)`);
  lines.push('');
  lines.push(simplifiedAction);
  lines.push('');

  lines.push(closing);

  // Short text
  const shortText = `⚡ ${truncate(simplifiedAction, 50)} (~${reducedTime} min)`;

  // Subject
  const subject = `⚡ Quick Practice (~${reducedTime} min)`;

  return {
    text: lines.join('\n'),
    shortText,
    subject,
  };
}

/**
 * Level 3 (Evening): Last chance, just start.
 */
function generateLevel3Message(
  context: DrillReminderContext,
  greeting: string,
  closing: string,
  skillEmoji: string
): { text: string; shortText: string; subject: string } {
  const { drill } = context;

  // Extract just the first clause
  const minimalAction = getMinimalAction(drill.action);

  const lines: string[] = [];

  lines.push(greeting);
  lines.push('');
  lines.push(`${skillEmoji} **Just do this:**`);
  lines.push(minimalAction);
  lines.push('');
  lines.push('Any progress counts. Skip if you must.');
  lines.push('');
  lines.push(closing);

  // Short text
  const shortText = `🎯 Just: ${truncate(minimalAction, 50)}`;

  // Subject
  const subject = `🎯 Just Start: ${truncate(minimalAction, 30)}`;

  return {
    text: lines.join('\n'),
    shortText,
    subject,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// RETRY-AWARE MESSAGES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate reminder for a retry drill.
 */
export function generateRetryReminderMessage(
  context: DrillReminderContext
): DrillReminderMessage {
  const { drill, skill, escalationLevel, variant } = context;
  const retryCount = drill.retryCount ?? 1;

  // Base message
  const baseMessage = generateDrillReminderMessage(context);

  // Add retry context
  let retryPrefix: string;
  if (retryCount === 1) {
    retryPrefix = '🔄 **Fresh approach** — Same skill, different angle.\n\n';
  } else if (retryCount === 2) {
    retryPrefix = '🔄 **Simplified version** — Focus on the core.\n\n';
  } else {
    retryPrefix = '🔄 **Foundation focus** — Just the basics.\n\n';
  }

  return {
    ...baseMessage,
    text: retryPrefix + baseMessage.text,
    subject: `🔄 Retry: ${baseMessage.subject}`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOUND/SYNTHESIS MESSAGES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate reminder for compound skill drill.
 */
export function generateCompoundSkillMessage(
  context: DrillReminderContext,
  componentSkillTitles: readonly string[]
): DrillReminderMessage {
  const baseMessage = generateDrillReminderMessage(context);

  // Add compound context
  let compoundNote = '';
  if (componentSkillTitles.length > 0) {
    compoundNote = `\n🔗 *Combines: ${componentSkillTitles.slice(0, 3).join(', ')}*\n`;
    if (componentSkillTitles.length > 3) {
      compoundNote += `   (+${componentSkillTitles.length - 3} more)\n`;
    }
  }

  return {
    ...baseMessage,
    text: baseMessage.text.replace(
      /\*\*Your task:\*\*/,
      `${compoundNote}**Your task:**`
    ),
  };
}

/**
 * Generate reminder for synthesis skill (milestone prep).
 */
export function generateSynthesisSkillMessage(
  context: DrillReminderContext,
  milestoneTitle: string
): DrillReminderMessage {
  const baseMessage = generateDrillReminderMessage(context);

  const synthesisNote = `\n⭐ *Milestone Prep: ${milestoneTitle}*\n`;

  return {
    ...baseMessage,
    text: synthesisNote + baseMessage.text,
    subject: `⭐ Milestone Prep: ${baseMessage.subject}`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Pick random element from array.
 */
function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/**
 * Truncate text to max length with ellipsis.
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3).trim() + '...';
}

/**
 * Simplify action text for reduced variant.
 */
function simplifyAction(action: string): string {
  // Take first sentence or up to first semicolon/period
  const firstPart = action.split(/[.;!?]/)[0] ?? action;
  return truncate(firstPart.trim(), 100);
}

/**
 * Get minimal action (first clause) for minimal variant.
 */
function getMinimalAction(action: string): string {
  // Take up to first comma or 50 chars
  const firstClause = action.split(/[,;]/)[0] ?? action;
  return truncate(firstClause.trim(), 60);
}

/**
 * Get streak message for display.
 */
function getStreakMessage(streak: number): string | null {
  // Find highest matching streak threshold
  const thresholds = [30, 14, 7, 5, 3];
  for (const threshold of thresholds) {
    if (streak >= threshold && STREAK_MESSAGES[threshold]) {
      return STREAK_MESSAGES[threshold]!;
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate all escalation messages for a drill (for preview/testing).
 */
export function generateAllEscalationMessages(
  drill: DailyDrill,
  skill: Skill | null,
  goalTitle: string
): DrillReminderMessage[] {
  const variants: SparkVariant[] = ['full', 'full', 'reduced', 'minimal'];
  
  return ([0, 1, 2, 3] as EscalationLevel[]).map((level, index) => {
    return generateDrillReminderMessage({
      drill,
      skill,
      goalTitle,
      escalationLevel: level,
      variant: variants[index]!,
    });
  });
}
