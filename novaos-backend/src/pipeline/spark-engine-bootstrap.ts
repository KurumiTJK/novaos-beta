// ═══════════════════════════════════════════════════════════════════════════════
// SPARK ENGINE BOOTSTRAP — Complete Wiring for ExecutionPipeline
// NovaOS Spark Engine — Production Integration
// ═══════════════════════════════════════════════════════════════════════════════
//
// This module provides complete SparkEngine wiring for the ExecutionPipeline:
//   - Store adapter bridging SparkEngineStoreManager → ISparkEngineStore
//   - Stub implementations for deferred features (StepGenerator, ReminderService)
//   - Simple TopicTaxonomy stub
//   - Factory function to create fully-wired SparkEngine
//
// Usage:
//   import { bootstrapSparkEngine } from './spark-engine-bootstrap.js';
//   const sparkEngine = bootstrapSparkEngine(kvStore);
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { KeyValueStore } from '../storage/index.js';
import { ok, err, type AsyncAppResult } from '../types/result.js';
import type {
  GoalId,
  QuestId,
  StepId,
  SparkId,
  UserId,
} from '../types/branded.js';

// SparkEngine core
import {
  SparkEngine,
  type ISparkEngine,
  type ISparkEngineStore,
  type IStepGenerator,
  type ISparkGenerator,
  type IReminderService,
  type Goal,
  type Quest,
  type Step,
  type Spark,
  type ReminderSchedule,
} from '../services/spark-engine/index.js';

// Store layer
import {
  createStoreManager as createSparkEngineStoreManager,
  type SparkEngineStoreManager,
} from '../services/spark-engine/store/index.js';

// SparkGenerator (full implementation)
import { createSparkGenerator } from '../services/spark-engine/spark-generator/generator.js';

// Encryption
import { getEncryptionService } from '../security/encryption/service.js';

// Gap remediation types (for stub TopicTaxonomy)
import type { TopicId } from '../services/spark-engine/resource-discovery/types.js';
import type { ITopicTaxonomy, TopicMetadata } from '../services/spark-engine/step-generator/gap-remediation.js';

// ═══════════════════════════════════════════════════════════════════════════════
// STORE ADAPTER — Bridges SparkEngineStoreManager to ISparkEngineStore
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Adapter that bridges SparkEngineStoreManager (Phase 12 stores) to
 * ISparkEngineStore interface (Phase 8 SparkEngine interface).
 *
 * The Phase 12 stores use a different API pattern:
 *   manager.goals.save(goal) → { entity, version, created }
 *
 * The Phase 8 interface expects:
 *   store.saveGoal(goal) → Goal
 *
 * This adapter translates between them.
 */
export class SparkEngineStoreAdapter implements ISparkEngineStore {
  constructor(private readonly manager: SparkEngineStoreManager) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // Goals
  // ─────────────────────────────────────────────────────────────────────────────

  async saveGoal(goal: Goal): AsyncAppResult<Goal> {
    const result = await this.manager.goals.save(goal);
    if (!result.ok) {
      return err(result.error);
    }
    return ok(result.value.entity);
  }

  async getGoal(goalId: GoalId): AsyncAppResult<Goal | null> {
    return this.manager.goals.get(goalId);
  }

  async getGoalsByUser(userId: UserId): AsyncAppResult<readonly Goal[]> {
    const result = await this.manager.goals.getByUser(userId, { limit: 100 });
    if (!result.ok) {
      return err(result.error);
    }
    return ok(result.value.items);
  }

  async deleteGoal(goalId: GoalId): AsyncAppResult<void> {
    const result = await this.manager.goals.delete(goalId);
    if (!result.ok) {
      return err(result.error);
    }
    return ok(undefined);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Quests
  // ─────────────────────────────────────────────────────────────────────────────

  async saveQuest(quest: Quest): AsyncAppResult<Quest> {
    const result = await this.manager.quests.save(quest);
    if (!result.ok) {
      return err(result.error);
    }
    return ok(result.value.entity);
  }

  async getQuest(questId: QuestId): AsyncAppResult<Quest | null> {
    return this.manager.quests.get(questId);
  }

  async getQuestsByGoal(goalId: GoalId): AsyncAppResult<readonly Quest[]> {
    const result = await this.manager.quests.getByGoal(goalId, { limit: 100 });
    if (!result.ok) {
      return err(result.error);
    }
    return ok(result.value.items);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Steps
  // ─────────────────────────────────────────────────────────────────────────────

  async saveStep(step: Step): AsyncAppResult<Step> {
    const result = await this.manager.steps.save(step);
    if (!result.ok) {
      return err(result.error);
    }
    return ok(result.value.entity);
  }

  async getStep(stepId: StepId): AsyncAppResult<Step | null> {
    return this.manager.steps.get(stepId);
  }

  async getStepsByQuest(questId: QuestId): AsyncAppResult<readonly Step[]> {
    const result = await this.manager.steps.getByQuest(questId, { limit: 100 });
    if (!result.ok) {
      return err(result.error);
    }
    return ok(result.value.items);
  }

  async getStepByDate(userId: UserId, date: string): AsyncAppResult<Step | null> {
    return this.manager.steps.getByDate(userId, date);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Sparks
  // ─────────────────────────────────────────────────────────────────────────────

  async saveSpark(spark: Spark): AsyncAppResult<Spark> {
    const result = await this.manager.sparks.save(spark);
    if (!result.ok) {
      return err(result.error);
    }
    return ok(result.value.entity);
  }

  async getSpark(sparkId: SparkId): AsyncAppResult<Spark | null> {
    return this.manager.sparks.get(sparkId);
  }

  async getSparksByStep(stepId: StepId): AsyncAppResult<readonly Spark[]> {
    const result = await this.manager.sparks.getByStep(stepId, { limit: 100 });
    if (!result.ok) {
      return err(result.error);
    }
    return ok(result.value.items);
  }

  async getActiveSparkForStep(stepId: StepId): AsyncAppResult<Spark | null> {
    return this.manager.sparks.getActiveForStep(stepId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STUB STEP GENERATOR — Returns empty steps (deferred implementation)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Stub StepGenerator that returns empty steps array.
 *
 * The full StepGenerator requires:
 *   - ResourceDiscoveryOrchestrator (external API calls)
 *   - ITopicTaxonomy (curriculum knowledge base)
 *   - Redis (for distributed locking)
 *   - LLM (for curriculum generation)
 *
 * For initial wiring, we defer step generation. Goals and quests are created
 * and persisted, but steps can be generated later via:
 *   1. Background job
 *   2. Explicit API call
 *   3. First access to "today's content"
 *
 * This allows the refinement flow to complete successfully.
 */
class StubStepGenerator implements IStepGenerator {
  async generateSteps(quest: Quest, goal: Goal): AsyncAppResult<readonly Step[]> {
    console.log('[STUB_STEP_GENERATOR] Step generation deferred', {
      questId: quest.id,
      goalId: goal.id,
      questTitle: quest.title,
    });
    // Return empty array - steps will be generated later
    return ok([]);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STUB REMINDER SERVICE — Acknowledges but doesn't schedule
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Stub ReminderService that acknowledges calls but doesn't schedule.
 *
 * The full implementation would:
 *   - Schedule push notifications
 *   - Handle email/SMS reminders
 *   - Integrate with job scheduler
 *   - Store reminders in ReminderStore
 *
 * For initial wiring, reminders are acknowledged but not scheduled.
 */
class StubReminderService implements IReminderService {
  async scheduleReminders(spark: Spark, goal: Goal): AsyncAppResult<readonly ReminderSchedule[]> {
    console.log('[STUB_REMINDER_SERVICE] Reminder scheduling acknowledged', {
      sparkId: spark.id,
      goalId: goal.id,
    });
    return ok([]);
  }

  async cancelReminders(sparkId: SparkId): AsyncAppResult<void> {
    console.log('[STUB_REMINDER_SERVICE] Cancel reminders acknowledged', { sparkId });
    return ok(undefined);
  }

  async getPendingReminders(userId: UserId): AsyncAppResult<readonly ReminderSchedule[]> {
    return ok([]);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STUB TOPIC TAXONOMY — Basic metadata for gap remediation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Stub TopicTaxonomy that returns basic metadata.
 *
 * The full implementation would:
 *   - Load topic hierarchy from curriculum database
 *   - Track prerequisites and dependencies
 *   - Link to official documentation
 *
 * For initial wiring, returns placeholder data.
 */
class StubTopicTaxonomy implements ITopicTaxonomy {
  getTopic(id: TopicId): TopicMetadata | undefined {
    return {
      id,
      name: id, // Use ID as name
      priority: 5,
      estimatedMinutes: 30,
      prerequisites: [],
    };
  }

  getTopicName(id: TopicId): string {
    return id;
  }

  getPrerequisites(id: TopicId): readonly TopicId[] {
    return [];
  }

  getOfficialDocsUrl(id: TopicId): string | undefined {
    return undefined;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOOTSTRAP CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Configuration for SparkEngine bootstrap.
 */
export interface SparkEngineBootstrapConfig {
  /** Enable encryption at rest (default: true) */
  readonly encryptionEnabled?: boolean;

  /** Use stub step generator (default: true) */
  readonly useStubStepGenerator?: boolean;

  /** Use stub reminder service (default: true) */
  readonly useStubReminderService?: boolean;

  /** SparkGenerator config */
  readonly sparkGeneratorConfig?: {
    maxEscalationLevel?: number;
    minSparkMinutes?: number;
    maxSparkMinutes?: number;
  };
}

/**
 * Default bootstrap configuration.
 */
export const DEFAULT_BOOTSTRAP_CONFIG: Required<SparkEngineBootstrapConfig> = {
  encryptionEnabled: true,
  useStubStepGenerator: true,
  useStubReminderService: true,
  sparkGeneratorConfig: {},
};

// ═══════════════════════════════════════════════════════════════════════════════
// BOOTSTRAP RESULT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Result of SparkEngine bootstrap.
 */
export interface SparkEngineBootstrapResult {
  /** The wired SparkEngine instance */
  readonly sparkEngine: ISparkEngine;

  /** The underlying store manager (for direct store access if needed) */
  readonly storeManager: SparkEngineStoreManager;

  /** The store adapter (implements ISparkEngineStore) */
  readonly storeAdapter: ISparkEngineStore;

  /** Configuration used */
  readonly config: Required<SparkEngineBootstrapConfig>;

  /** What's stubbed vs real */
  readonly status: {
    stepGenerator: 'stub' | 'full';
    sparkGenerator: 'stub' | 'full';
    reminderService: 'stub' | 'full';
    storage: 'redis' | 'memory';
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOOTSTRAP FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Bootstrap a fully-wired SparkEngine instance.
 *
 * This creates all required dependencies and wires them together:
 *   1. SparkEngineStoreManager (Phase 12 secure stores)
 *   2. Store Adapter (bridges to ISparkEngineStore)
 *   3. SparkGenerator (full implementation)
 *   4. StepGenerator (stub - deferred)
 *   5. ReminderService (stub - deferred)
 *   6. SparkEngine (main orchestrator)
 *
 * @param kvStore - The underlying KeyValueStore (from storeManager.getStore())
 * @param config - Optional configuration
 * @returns Fully-wired SparkEngine with metadata
 *
 * @example
 * ```typescript
 * import { storeManager } from '../storage/index.js';
 * import { bootstrapSparkEngine } from './spark-engine-bootstrap.js';
 *
 * const result = bootstrapSparkEngine(storeManager.getStore());
 * const sparkEngine = result.sparkEngine;
 *
 * // Create a goal
 * const goalResult = await sparkEngine.createGoal({
 *   userId: createUserId('user-123'),
 *   title: 'Learn Rust',
 *   ...
 * });
 * ```
 */
export function bootstrapSparkEngine(
  kvStore: KeyValueStore,
  config: SparkEngineBootstrapConfig = {}
): SparkEngineBootstrapResult {
  const finalConfig: Required<SparkEngineBootstrapConfig> = {
    ...DEFAULT_BOOTSTRAP_CONFIG,
    ...config,
  };

  console.log('[SPARK_ENGINE_BOOTSTRAP] Starting bootstrap...');

  // 1. Create SparkEngineStoreManager (Phase 12 secure stores)
  const storeManager = createSparkEngineStoreManager(
    kvStore,
    { encryptionEnabled: finalConfig.encryptionEnabled },
    getEncryptionService()
  );
  console.log('[SPARK_ENGINE_BOOTSTRAP] StoreManager created');

  // 2. Create Store Adapter (bridges to ISparkEngineStore)
  const storeAdapter = new SparkEngineStoreAdapter(storeManager);
  console.log('[SPARK_ENGINE_BOOTSTRAP] StoreAdapter created');

  // 3. Create SparkGenerator (full implementation)
  const sparkGenerator = createSparkGenerator(finalConfig.sparkGeneratorConfig);
  console.log('[SPARK_ENGINE_BOOTSTRAP] SparkGenerator created (full)');

  // 4. Create StepGenerator (stub or full)
  let stepGenerator: IStepGenerator;
  let stepGeneratorStatus: 'stub' | 'full';

  if (finalConfig.useStubStepGenerator) {
    stepGenerator = new StubStepGenerator();
    stepGeneratorStatus = 'stub';
    console.log('[SPARK_ENGINE_BOOTSTRAP] StepGenerator created (stub)');
  } else {
    // Full StepGenerator would require:
    // - ResourceDiscoveryOrchestrator
    // - Redis client
    // - ITopicTaxonomy
    // For now, always use stub
    stepGenerator = new StubStepGenerator();
    stepGeneratorStatus = 'stub';
    console.log('[SPARK_ENGINE_BOOTSTRAP] StepGenerator created (stub - full not yet wired)');
  }

  // 5. Create ReminderService (stub or full)
  let reminderService: IReminderService;
  let reminderServiceStatus: 'stub' | 'full';

  if (finalConfig.useStubReminderService) {
    reminderService = new StubReminderService();
    reminderServiceStatus = 'stub';
    console.log('[SPARK_ENGINE_BOOTSTRAP] ReminderService created (stub)');
  } else {
    // Full ReminderService would require job scheduler integration
    reminderService = new StubReminderService();
    reminderServiceStatus = 'stub';
    console.log('[SPARK_ENGINE_BOOTSTRAP] ReminderService created (stub - full not yet wired)');
  }

  // 6. Create SparkEngine with all dependencies
  const sparkEngine = new SparkEngine(
    storeAdapter,
    stepGenerator,
    sparkGenerator,
    reminderService
  );
  console.log('[SPARK_ENGINE_BOOTSTRAP] SparkEngine created');

  // Determine storage type
  const storageStatus = kvStore.isConnected() ? 'redis' : 'memory';

  const result: SparkEngineBootstrapResult = {
    sparkEngine,
    storeManager,
    storeAdapter,
    config: finalConfig,
    status: {
      stepGenerator: stepGeneratorStatus,
      sparkGenerator: 'full',
      reminderService: reminderServiceStatus,
      storage: storageStatus,
    },
  };

  console.log('[SPARK_ENGINE_BOOTSTRAP] Bootstrap complete:', result.status);

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON HELPER
// ═══════════════════════════════════════════════════════════════════════════════

let sparkEngineInstance: SparkEngineBootstrapResult | null = null;

/**
 * Get or create the singleton SparkEngine instance.
 *
 * @param kvStore - Required on first call
 * @param config - Optional configuration (only used on first call)
 */
export function getSparkEngine(
  kvStore?: KeyValueStore,
  config?: SparkEngineBootstrapConfig
): SparkEngineBootstrapResult {
  if (!sparkEngineInstance) {
    if (!kvStore) {
      throw new Error('KeyValueStore is required for initial SparkEngine creation');
    }
    sparkEngineInstance = bootstrapSparkEngine(kvStore, config);
  }
  return sparkEngineInstance;
}

/**
 * Reset the singleton (for testing).
 */
export function resetSparkEngine(): void {
  sparkEngineInstance = null;
}
