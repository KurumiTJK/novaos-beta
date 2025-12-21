// ═══════════════════════════════════════════════════════════════════════════════
// OWNERSHIP CHECKER — Resource Ownership Verification
// NovaOS Security Module — Phase 2
// ═══════════════════════════════════════════════════════════════════════════════

import type { UserId, GoalId, QuestId, StepId, SparkId, ReminderId, ResourceId } from '../../types/branded.js';
import { getStore, type KeyValueStore } from '../../storage/index.js';
import { getLogger } from '../../logging/index.js';
import {
  type ResourceType,
  type ResourceIdMap,
  type OwnershipRegistry,
  type AuthorizationResult,
  allowed,
  denied,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────────

const logger = getLogger({ component: 'ownership' });

// ─────────────────────────────────────────────────────────────────────────────────
// STORAGE KEY PATTERNS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Storage key patterns for resources.
 * These match the patterns used by the Sword system.
 */
const KEY_PATTERNS = {
  goal: (id: string) => `goal:${id}`,
  quest: (id: string) => `quest:${id}`,
  step: (id: string) => `step:${id}`,
  spark: (id: string) => `spark:${id}`,
  reminder: (id: string) => `reminder:${id}`,
  memory: (id: string) => `memory:${id}`,
  conversation: (id: string) => `conversation:${id}`,
  profile: (userId: string) => `profile:${userId}`,
  preference: (userId: string) => `preferences:${userId}`,
} as const;

// ─────────────────────────────────────────────────────────────────────────────────
// RESOURCE LOADERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generic resource loader from storage.
 */
async function loadResource<T>(store: KeyValueStore, key: string): Promise<T | null> {
  try {
    const data = await store.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (error) {
    logger.error('Failed to load resource', error instanceof Error ? error : undefined, { key });
    return null;
  }
}

/**
 * Resource structure interfaces (minimal, for ownership check).
 */
interface GoalRecord {
  id: string;
  userId: string;
}

interface QuestRecord {
  id: string;
  goalId: string;
}

interface StepRecord {
  id: string;
  questId: string;
}

interface SparkRecord {
  id: string;
  stepId: string;
}

interface ReminderRecord {
  id: string;
  userId: string;
}

interface MemoryRecord {
  id: string;
  userId: string;
}

interface ConversationRecord {
  id: string;
  userId: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// OWNERSHIP LOOKUP FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get owner of a goal (direct lookup).
 */
async function getGoalOwner(store: KeyValueStore, goalId: GoalId): Promise<UserId | null> {
  const goal = await loadResource<GoalRecord>(store, KEY_PATTERNS.goal(goalId));
  return goal?.userId as UserId | null;
}

/**
 * Get owner of a quest (via goal).
 */
async function getQuestOwner(store: KeyValueStore, questId: QuestId): Promise<UserId | null> {
  const quest = await loadResource<QuestRecord>(store, KEY_PATTERNS.quest(questId));
  if (!quest?.goalId) return null;
  return getGoalOwner(store, quest.goalId as GoalId);
}

/**
 * Get owner of a step (via quest → goal).
 */
async function getStepOwner(store: KeyValueStore, stepId: StepId): Promise<UserId | null> {
  const step = await loadResource<StepRecord>(store, KEY_PATTERNS.step(stepId));
  if (!step?.questId) return null;
  return getQuestOwner(store, step.questId as QuestId);
}

/**
 * Get owner of a spark (via step → quest → goal).
 */
async function getSparkOwner(store: KeyValueStore, sparkId: SparkId): Promise<UserId | null> {
  const spark = await loadResource<SparkRecord>(store, KEY_PATTERNS.spark(sparkId));
  if (!spark?.stepId) return null;
  return getStepOwner(store, spark.stepId as StepId);
}

/**
 * Get owner of a reminder (direct lookup).
 */
async function getReminderOwner(store: KeyValueStore, reminderId: ReminderId): Promise<UserId | null> {
  const reminder = await loadResource<ReminderRecord>(store, KEY_PATTERNS.reminder(reminderId));
  return reminder?.userId as UserId | null;
}

/**
 * Get owner of a memory (direct lookup).
 */
async function getMemoryOwner(store: KeyValueStore, memoryId: ResourceId): Promise<UserId | null> {
  const memory = await loadResource<MemoryRecord>(store, KEY_PATTERNS.memory(memoryId));
  return memory?.userId as UserId | null;
}

/**
 * Get owner of a conversation (direct lookup).
 */
async function getConversationOwner(store: KeyValueStore, conversationId: ResourceId): Promise<UserId | null> {
  const conversation = await loadResource<ConversationRecord>(store, KEY_PATTERNS.conversation(conversationId));
  return conversation?.userId as UserId | null;
}

/**
 * Profile owner is the user themselves.
 */
async function getProfileOwner(_store: KeyValueStore, userId: UserId): Promise<UserId | null> {
  return userId;
}

/**
 * Preference owner is the user themselves.
 */
async function getPreferenceOwner(_store: KeyValueStore, userId: UserId): Promise<UserId | null> {
  return userId;
}

// ─────────────────────────────────────────────────────────────────────────────────
// OWNERSHIP CHECKER CLASS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Ownership checker for resource authorization.
 */
export class OwnershipChecker {
  private readonly store: KeyValueStore;
  private readonly registry: OwnershipRegistry;

  constructor(store?: KeyValueStore, customRegistry?: Partial<OwnershipRegistry>) {
    this.store = store ?? getStore();
    
    // Build registry with defaults and overrides
    this.registry = {
      goal: (id) => getGoalOwner(this.store, id),
      quest: (id) => getQuestOwner(this.store, id),
      step: (id) => getStepOwner(this.store, id),
      spark: (id) => getSparkOwner(this.store, id),
      reminder: (id) => getReminderOwner(this.store, id),
      memory: (id) => getMemoryOwner(this.store, id),
      conversation: (id) => getConversationOwner(this.store, id),
      profile: (id) => getProfileOwner(this.store, id),
      preference: (id) => getPreferenceOwner(this.store, id),
      ...customRegistry,
    };
  }

  /**
   * Check if a user owns a resource.
   */
  async check<T extends ResourceType>(
    userId: UserId,
    resourceType: T,
    resourceId: ResourceIdMap[T]
  ): Promise<AuthorizationResult> {
    const lookup = this.registry[resourceType] as ((id: ResourceIdMap[T]) => Promise<UserId | null>) | undefined;
    if (!lookup) {
      return denied({
        code: 'RESOURCE_NOT_FOUND',
        message: `Unknown resource type: ${resourceType}`,
        resourceType,
        resourceId: resourceId as string,
      });
    }

    const ownerId = await lookup(resourceId);

    if (ownerId === null) {
      return denied({
        code: 'RESOURCE_NOT_FOUND',
        message: `Resource not found: ${resourceType}/${resourceId}`,
        resourceType,
        resourceId: resourceId as string,
      });
    }

    if (ownerId !== userId) {
      return denied({
        code: 'NOT_OWNER',
        message: `User does not own this ${resourceType}`,
        resourceType,
        resourceId: resourceId as string,
      });
    }

    return allowed();
  }

  /**
   * Check ownership with string IDs (for middleware use).
   */
  async checkByString(
    userId: string,
    resourceType: ResourceType,
    resourceId: string
  ): Promise<AuthorizationResult> {
    return this.check(
      userId as UserId,
      resourceType,
      resourceId as ResourceIdMap[typeof resourceType]
    );
  }

  /**
   * Get the owner of a resource.
   */
  async getOwner<T extends ResourceType>(
    resourceType: T,
    resourceId: ResourceIdMap[T]
  ): Promise<UserId | null> {
    const lookup = this.registry[resourceType] as ((id: ResourceIdMap[T]) => Promise<UserId | null>) | undefined;
    if (!lookup) return null;
    return lookup(resourceId);
  }

  /**
   * Check if a resource exists.
   */
  async exists<T extends ResourceType>(
    resourceType: T,
    resourceId: ResourceIdMap[T]
  ): Promise<boolean> {
    const owner = await this.getOwner(resourceType, resourceId);
    return owner !== null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON INSTANCE
// ─────────────────────────────────────────────────────────────────────────────────

let ownershipCheckerInstance: OwnershipChecker | null = null;

/**
 * Get the ownership checker singleton.
 */
export function getOwnershipChecker(): OwnershipChecker {
  if (!ownershipCheckerInstance) {
    ownershipCheckerInstance = new OwnershipChecker();
  }
  return ownershipCheckerInstance;
}

/**
 * Initialize ownership checker with custom config.
 */
export function initOwnershipChecker(
  store?: KeyValueStore,
  customRegistry?: Partial<OwnershipRegistry>
): OwnershipChecker {
  ownershipCheckerInstance = new OwnershipChecker(store, customRegistry);
  return ownershipCheckerInstance;
}

/**
 * Reset ownership checker (for testing).
 * @internal
 */
export function resetOwnershipChecker(): void {
  ownershipCheckerInstance = null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONVENIENCE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check if user owns a goal.
 */
export async function userOwnsGoal(userId: UserId, goalId: GoalId): Promise<boolean> {
  const result = await getOwnershipChecker().check(userId, 'goal', goalId);
  return result.allowed;
}

/**
 * Check if user owns a quest.
 */
export async function userOwnsQuest(userId: UserId, questId: QuestId): Promise<boolean> {
  const result = await getOwnershipChecker().check(userId, 'quest', questId);
  return result.allowed;
}

/**
 * Check if user owns a step.
 */
export async function userOwnsStep(userId: UserId, stepId: StepId): Promise<boolean> {
  const result = await getOwnershipChecker().check(userId, 'step', stepId);
  return result.allowed;
}

/**
 * Check if user owns a spark.
 */
export async function userOwnsSpark(userId: UserId, sparkId: SparkId): Promise<boolean> {
  const result = await getOwnershipChecker().check(userId, 'spark', sparkId);
  return result.allowed;
}

/**
 * Check if user owns a reminder.
 */
export async function userOwnsReminder(userId: UserId, reminderId: ReminderId): Promise<boolean> {
  const result = await getOwnershipChecker().check(userId, 'reminder', reminderId);
  return result.allowed;
}
