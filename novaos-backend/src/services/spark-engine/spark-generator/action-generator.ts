// ═══════════════════════════════════════════════════════════════════════════════
// ACTION GENERATION — Generate Action Text for Sparks
// NovaOS Spark Engine — Phase 10: Spark Generation
// ═══════════════════════════════════════════════════════════════════════════════
//
// This module generates human-readable action text for sparks:
//   - generateFullAction: Complete activity action
//   - generateReducedAction: Partial activity action
//   - generateMinimalAction: Just-start action
//   - generateAction: Unified action generator
//
// Action text follows the pattern:
//   "[Verb] [section/task] in [resource title]"
//
// Examples:
//   Full:    "Read Chapter 4.1 in The Rust Programming Language"
//   Reduced: "Skim the first section of Chapter 4.1 in The Rust Programming Language"
//   Minimal: "Open The Rust Programming Language"
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { Activity, StepResource, SparkVariant } from '../types.js';
import type { GeneratedAction, SparkGenerationConfig } from './types.js';
import { ACTION_VERBS, DEFAULT_SPARK_GENERATION_CONFIG } from './types.js';
import { getVariantForLevel, estimateMinutes, shouldShowSkipOption } from './escalation.js';

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION TEXT GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a full action text for an activity.
 *
 * Pattern: "[Verb] [section/task] in [resource]"
 * Example: "Read Chapter 4.1 in The Rust Programming Language"
 *
 * @param activity - The activity to generate action for
 * @param resource - The resource associated with the activity
 * @returns Action text string
 */
export function generateFullAction(
  activity: Activity,
  resource: StepResource | undefined
): string {
  const verb = ACTION_VERBS[activity.type]?.full ?? 'Complete';
  const resourceTitle = resource?.title ?? 'the resource';

  // Build the action text
  const parts: string[] = [verb];

  // Add section if specified
  if (activity.section) {
    parts.push(activity.section);
    parts.push('in');
  }

  // Add task if specified (and no section)
  if (activity.task && !activity.section) {
    parts.push(activity.task);
    parts.push('in');
  }

  parts.push(resourceTitle);

  return parts.join(' ');
}

/**
 * Generate a reduced action text for an activity.
 *
 * Pattern: "[Reduced verb] [partial description] in [resource]"
 * Example: "Skim the first section of Chapter 4.1 in The Rust Programming Language"
 *
 * @param activity - The activity to generate action for
 * @param resource - The resource associated with the activity
 * @returns Action text string
 */
export function generateReducedAction(
  activity: Activity,
  resource: StepResource | undefined
): string {
  const verb = ACTION_VERBS[activity.type]?.reduced ?? 'Start';
  const resourceTitle = resource?.title ?? 'the resource';

  // Build the action text
  const parts: string[] = [verb];

  // Add partial section reference if available
  if (activity.section) {
    // For reduced, we add "the first part of" modifier
    parts.push('the first part of');
    parts.push(activity.section);
    parts.push('in');
  } else if (activity.task) {
    // For tasks, suggest starting the task
    parts.push('the first step of');
    parts.push(activity.task);
    parts.push('in');
  }

  parts.push(resourceTitle);

  return parts.join(' ');
}

/**
 * Generate a minimal action text for an activity.
 *
 * Pattern: "[Minimal verb] [resource]"
 * Example: "Open The Rust Programming Language"
 *
 * @param activity - The activity to generate action for
 * @param resource - The resource associated with the activity
 * @returns Action text string
 */
export function generateMinimalAction(
  activity: Activity,
  resource: StepResource | undefined
): string {
  const verb = ACTION_VERBS[activity.type]?.minimal ?? 'Open';
  const resourceTitle = resource?.title ?? 'the resource';

  // Minimal is just verb + resource
  return `${verb} ${resourceTitle}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UNIFIED ACTION GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate action text for a given variant.
 *
 * @param activity - The activity to generate action for
 * @param resource - The resource associated with the activity
 * @param variant - The spark variant (full, reduced, minimal)
 * @returns Action text string
 */
export function generateActionText(
  activity: Activity,
  resource: StepResource | undefined,
  variant: SparkVariant
): string {
  switch (variant) {
    case 'full':
      return generateFullAction(activity, resource);
    case 'reduced':
      return generateReducedAction(activity, resource);
    case 'minimal':
      return generateMinimalAction(activity, resource);
    default:
      // Fallback to minimal for safety
      return generateMinimalAction(activity, resource);
  }
}

/**
 * Generate a complete action with metadata.
 *
 * @param activity - The activity to generate action for
 * @param resource - The resource associated with the activity
 * @param escalationLevel - Escalation level (0-3)
 * @param config - Spark generation config
 * @returns GeneratedAction with text, variant, time, and skip flag
 */
export function generateAction(
  activity: Activity,
  resource: StepResource | undefined,
  escalationLevel: number,
  config: SparkGenerationConfig = DEFAULT_SPARK_GENERATION_CONFIG
): GeneratedAction {
  const variant = getVariantForLevel(escalationLevel);
  const text = generateActionText(activity, resource, variant);
  const estimatedMinutes = estimateMinutes(activity, variant, config);
  const showSkipOption = shouldShowSkipOption(escalationLevel, config);

  return {
    text,
    variant,
    estimatedMinutes,
    showSkipOption,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION TEXT UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Append a URL to action text if configured.
 *
 * @param actionText - Base action text
 * @param url - Sanitized URL to append
 * @param includeUrl - Whether to include the URL
 * @returns Action text with optional URL
 */
export function appendUrlToAction(
  actionText: string,
  url: string | undefined,
  includeUrl: boolean
): string {
  if (!includeUrl || !url) {
    return actionText;
  }

  return `${actionText} (${url})`;
}

/**
 * Format time estimate as human-readable string.
 *
 * @param minutes - Estimated minutes
 * @returns Formatted time string
 */
export function formatTimeEstimate(minutes: number): string {
  if (minutes < 1) {
    return 'less than a minute';
  }

  if (minutes === 1) {
    return '1 minute';
  }

  if (minutes < 60) {
    return `${minutes} minutes`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }

  const hourPart = hours === 1 ? '1 hour' : `${hours} hours`;
  const minutePart = remainingMinutes === 1 ? '1 minute' : `${remainingMinutes} minutes`;

  return `${hourPart} ${minutePart}`;
}

/**
 * Generate action text with time estimate suffix.
 *
 * @param activity - The activity to generate action for
 * @param resource - The resource associated with the activity
 * @param escalationLevel - Escalation level (0-3)
 * @param config - Spark generation config
 * @returns Action text with time estimate
 */
export function generateActionWithTime(
  activity: Activity,
  resource: StepResource | undefined,
  escalationLevel: number,
  config: SparkGenerationConfig = DEFAULT_SPARK_GENERATION_CONFIG
): string {
  const action = generateAction(activity, resource, escalationLevel, config);
  const timeStr = formatTimeEstimate(action.estimatedMinutes);

  return `${action.text} (~${timeStr})`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FALLBACK ACTION GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a fallback action when no activity is available.
 *
 * Uses step title/description as context.
 *
 * @param stepTitle - Title of the step
 * @param variant - Spark variant
 * @returns Fallback action text
 */
export function generateFallbackAction(
  stepTitle: string,
  variant: SparkVariant
): string {
  switch (variant) {
    case 'full':
      return `Complete today's lesson: ${stepTitle}`;
    case 'reduced':
      return `Start working on: ${stepTitle}`;
    case 'minimal':
      return `Open and review: ${stepTitle}`;
    default:
      return `Review: ${stepTitle}`;
  }
}

/**
 * Generate a fallback action with metadata.
 *
 * @param stepTitle - Title of the step
 * @param escalationLevel - Escalation level (0-3)
 * @param config - Spark generation config
 * @returns GeneratedAction for fallback case
 */
export function generateFallbackActionWithMetadata(
  stepTitle: string,
  escalationLevel: number,
  config: SparkGenerationConfig = DEFAULT_SPARK_GENERATION_CONFIG
): GeneratedAction {
  const variant = getVariantForLevel(escalationLevel);
  const text = generateFallbackAction(stepTitle, variant);
  const showSkipOption = shouldShowSkipOption(escalationLevel, config);

  // Use fixed time estimates for fallback
  const timeByVariant: Record<SparkVariant, number> = {
    full: config.maxSparkMinutes,
    reduced: Math.floor(config.maxSparkMinutes / 2),
    minimal: config.minSparkMinutes,
  };

  return {
    text,
    variant,
    estimatedMinutes: timeByVariant[variant],
    showSkipOption,
  };
}
