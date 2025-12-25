// ═══════════════════════════════════════════════════════════════════════════════
// SWORD MODULE — Path/Spark Engine (Nova Constitution §2.3)
// ═══════════════════════════════════════════════════════════════════════════════
//
// "Sword enables progress through directed action, combining long-term
// guidance with immediate execution."
//
// Components:
// - Path: defines the route from current state to desired future state
// - Spark: produces minimal, low-friction action for immediate forward motion
//
// ═══════════════════════════════════════════════════════════════════════════════

// Types
export type {
  InterestLevel,
  GoalStatus,
  Goal,
  QuestStatus,
  QuestPriority,
  Quest,
  StepStatus,
  StepType,
  ActionType,
  Step,
  SparkStatus,
  SparkVariant,
  Spark,
  Path,
  PathBlocker,
  CreateGoalRequest,
  CreateQuestRequest,
  CreateStepRequest,
  GenerateSparkRequest,
  GoalEvent,
  QuestEvent,
  StepEvent,
  SparkEvent,
  // String event types (for routes)
  GoalEventType,
  QuestEventType,
  StepEventType,
  SparkEventType,
} from './types.js';

export {
  INTEREST_PRIORITY,
  // Event converters (string → object)
  toGoalEvent,
  toQuestEvent,
  toStepEvent,
  toSparkEvent,
} from './types.js';

// State Machine
export {
  transitionGoal,
  transitionQuest,
  transitionStep,
  transitionSpark,
  canTransitionGoal,
  canTransitionQuest,
  canTransitionStep,
  canTransitionSpark,
  getAvailableGoalTransitions,
  getAvailableQuestTransitions,
  getAvailableStepTransitions,
  getAvailableSparkTransitions,
  type TransitionResult,
  type SideEffect,
} from './state-machine.js';

// Store
export {
  SwordStore,
  getSwordStore,
  resetSwordStore,
} from './store.js';

// Spark Generator
export {
  SparkGenerator,
  getSparkGenerator,
  createSparkGenerator,
} from './spark-generator.js';

// ─────────────────────────────────────────────────────────────────────────────────
// REMINDER SERVICE ACCESSOR
// ─────────────────────────────────────────────────────────────────────────────────

// Lazy import and singleton management
let reminderServiceInstance: unknown = null;
let reminderServiceModule: unknown = null;

/**
 * Get the reminder service singleton.
 * Creates the service on first call.
 * Returns null if the service cannot be created.
 */
export async function getReminderService(): Promise<unknown> {
  if (!reminderServiceInstance) {
    try {
      if (!reminderServiceModule) {
        reminderServiceModule = await import('../../services/spark-engine/reminder-service/index.js');
      }
      const mod = reminderServiceModule as { createReminderService: () => unknown };
      reminderServiceInstance = mod.createReminderService();
    } catch {
      return null;
    }
  }
  return reminderServiceInstance;
}

/**
 * Reset the reminder service singleton (for testing).
 */
export function resetReminderService(): void {
  reminderServiceInstance = null;
}
