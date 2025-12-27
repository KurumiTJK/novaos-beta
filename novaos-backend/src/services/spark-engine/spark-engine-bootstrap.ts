// ═══════════════════════════════════════════════════════════════════════════════
// SPARK ENGINE BOOTSTRAP — Complete Wiring for ExecutionPipeline
// NovaOS Spark Engine — Phase 17: Full StepGenerator Integration
// ═══════════════════════════════════════════════════════════════════════════════
//
// This module provides complete SparkEngine wiring for the ExecutionPipeline:
//   - Store adapter bridging SparkEngineStoreManager → ISparkEngineStore
//   - Full StepGenerator with resource discovery and curriculum generation
//   - Stub implementations for optional features (ReminderService)
//   - Enhanced TopicTaxonomy with real topic data
//   - Factory functions for both sync (stub) and async (full) initialization
//
// Usage:
//   // Stub mode (sync, no external dependencies)
//   import { bootstrapSparkEngine } from './spark-engine-bootstrap.js';
//   const result = bootstrapSparkEngine(kvStore);
//
//   // Full mode (async, with resource discovery + curriculum generation)
//   import { bootstrapSparkEngineAsync } from './spark-engine-bootstrap.js';
//   const result = await bootstrapSparkEngineAsync(kvStore, redis, providerManager);
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { Redis } from 'ioredis';

import type { KeyValueStore } from '../../storage/index.js';
import { ok, err, type AsyncAppResult } from '../../types/result.js';
import type {
  GoalId,
  QuestId,
  StepId,
  SparkId,
  UserId,
} from '../../types/branded.js';

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
} from './index.js';

// Store layer
import {
  createStoreManager as createSparkEngineStoreManager,
  type SparkEngineStoreManager,
} from './store/index.js';

// SparkGenerator (full implementation)
import { createSparkGenerator } from './spark-generator/generator.js';

// StepGenerator (full implementation)
import {
  StepGenerator,
  createStepGenerator,
  type StepGeneratorConfig,
} from './step-generator/index.js';

// Resource Discovery
import {
  ResourceDiscoveryOrchestrator,
  initResourceDiscovery,
  resetResourceDiscovery,
  getResourceDiscoveryOrchestrator,
  initResourceDiscoveryOrchestrator,
  type OrchestratorConfig,
} from './resource-discovery/index.js';

// Curriculum LLM Adapter
import {
  initSecureLLMClientFromManager,
  resetSecureLLMClient,
} from './curriculum-llm-adapter.js';

// Encryption
import { getEncryptionService } from '../../security/encryption/service.js';

// Gap remediation types (for TopicTaxonomy)
import type { TopicId } from './resource-discovery/types.js';
import type { ITopicTaxonomy, TopicMetadata } from './step-generator/gap-remediation.js';

// Provider manager for LLM
import type { ProviderManager } from '../../providers/index.js';

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
// TOPIC TAXONOMY — Dynamic Topic Metadata with Inference
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Topic data structure for custom topics.
 */
export interface TopicData {
  readonly name: string;
  readonly priority: number;
  readonly estimatedMinutes: number;
  readonly prerequisites: readonly string[];
  readonly officialDocsUrl?: string;
}

/**
 * TopicTaxonomy with intelligent inference.
 *
 * This taxonomy does NOT contain hardcoded topics. Instead it:
 *   - Accepts custom topics via constructor
 *   - Infers topic names from ID structure (e.g., "language:rust:ownership" → "Rust Ownership")
 *   - Infers parent as prerequisite for subtopics
 *   - Returns sensible defaults for unknown topics
 *
 * Topic ID conventions:
 *   - Use colons to separate hierarchy: "category:subject:subtopic"
 *   - Use hyphens for multi-word segments: "language:rust:error-handling"
 *
 * @example
 * ```typescript
 * // With custom topics
 * const taxonomy = new TopicTaxonomy({
 *   'company:internal-api': {
 *     name: 'Internal API',
 *     priority: 1,
 *     estimatedMinutes: 60,
 *     prerequisites: [],
 *     officialDocsUrl: 'https://docs.internal.example.com',
 *   },
 * });
 *
 * // Inference for unknown topics
 * taxonomy.getTopicName('language:rust:ownership');
 * // → "Rust Ownership" (inferred from ID)
 * ```
 */
export class TopicTaxonomy implements ITopicTaxonomy {
  private readonly registry: Record<string, TopicData>;

  constructor(topics?: Record<string, TopicData>) {
    this.registry = topics ?? {};
  }

  getTopic(id: TopicId): TopicMetadata | undefined {
    // Check explicit registry first
    const data = this.registry[id];
    if (data) {
      return {
        id,
        name: data.name,
        priority: data.priority,
        estimatedMinutes: data.estimatedMinutes,
        prerequisites: data.prerequisites as TopicId[],
        officialDocsUrl: data.officialDocsUrl,
      };
    }

    // Try parent topic for inheritance
    const parentId = this.getParentTopicId(id);
    if (parentId) {
      const parentData = this.registry[parentId];
      if (parentData) {
        // Inherit from parent with adjustments
        return {
          id,
          name: this.inferTopicName(id),
          priority: parentData.priority + 1,
          estimatedMinutes: 30,
          prerequisites: [parentId] as TopicId[],
          officialDocsUrl: parentData.officialDocsUrl,
        };
      }
    }

    // Generate default metadata via inference
    return {
      id,
      name: this.inferTopicName(id),
      priority: 5,
      estimatedMinutes: 30,
      prerequisites: this.inferPrerequisites(id),
    };
  }

  getTopicName(id: TopicId): string {
    const data = this.registry[id];
    if (data) {
      return data.name;
    }
    return this.inferTopicName(id);
  }

  getPrerequisites(id: TopicId): readonly TopicId[] {
    const data = this.registry[id];
    if (data) {
      return data.prerequisites as TopicId[];
    }
    return this.inferPrerequisites(id);
  }

  getOfficialDocsUrl(id: TopicId): string | undefined {
    const data = this.registry[id];
    if (data?.officialDocsUrl) {
      return data.officialDocsUrl;
    }

    // Try parent for inherited docs URL
    const parentId = this.getParentTopicId(id);
    if (parentId) {
      return this.registry[parentId]?.officialDocsUrl;
    }

    return undefined;
  }

  /**
   * Get parent topic ID from a hierarchical topic ID.
   * Example: "language:rust:ownership" → "language:rust"
   */
  private getParentTopicId(id: TopicId): TopicId | null {
    const parts = String(id).split(':');
    if (parts.length > 2) {
      return parts.slice(0, -1).join(':') as TopicId;
    }
    return null;
  }

  /**
   * Infer prerequisites from topic ID structure.
   * If topic has a parent (e.g., "a:b:c" has parent "a:b"), parent is prerequisite.
   */
  private inferPrerequisites(id: TopicId): TopicId[] {
    const parentId = this.getParentTopicId(id);
    if (parentId) {
      return [parentId] as TopicId[];
    }
    return [];
  }

  /**
   * Infer a human-readable name from a topic ID.
   * 
   * Examples:
   *   - "language:rust" → "Language Rust"
   *   - "language:rust:ownership" → "Rust Ownership"
   *   - "language:rust:error-handling" → "Rust Error Handling"
   *   - "framework:react:hooks" → "React Hooks"
   */
  private inferTopicName(id: TopicId): string {
    const parts = String(id).split(':');
    
    // For deeper hierarchies, skip the category (first part)
    // "language:rust:ownership" → ["rust", "ownership"] → "Rust Ownership"
    const meaningfulParts = parts.length > 2 
      ? parts.slice(1)  // Skip category
      : parts.slice(-1); // Just the last part for shallow IDs
    
    return meaningfulParts
      .map(part => {
        // Convert kebab-case to Title Case
        return part
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      })
      .join(' ');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STUB STEP GENERATOR — Returns empty steps (for backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Stub StepGenerator that returns empty steps array.
 *
 * Used when full StepGenerator dependencies are not available.
 * Goals and quests are created and persisted, but steps can be
 * generated later via background job or explicit API call.
 */
class StubStepGenerator implements IStepGenerator {
  async generateSteps(quest: Quest, goal: Goal): AsyncAppResult<readonly Step[]> {
    console.log('[STUB_STEP_GENERATOR] Step generation deferred', {
      questId: quest.id,
      goalId: goal.id,
      questTitle: quest.title,
    });
    return ok([]);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STUB REMINDER SERVICE — Acknowledges but doesn't schedule
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Stub ReminderService that acknowledges calls but doesn't schedule.
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

  /** StepGenerator config (only used when useStubStepGenerator is false) */
  readonly stepGeneratorConfig?: Partial<StepGeneratorConfig>;

  /** ResourceDiscoveryOrchestrator config */
  readonly resourceDiscoveryConfig?: Partial<OrchestratorConfig>;

  /** Additional topics for taxonomy */
  readonly additionalTopics?: Record<string, TopicData>;
}

/**
 * Default bootstrap configuration.
 */
export const DEFAULT_BOOTSTRAP_CONFIG: Required<Omit<SparkEngineBootstrapConfig, 'stepGeneratorConfig' | 'resourceDiscoveryConfig' | 'additionalTopics'>> & 
  Pick<SparkEngineBootstrapConfig, 'stepGeneratorConfig' | 'resourceDiscoveryConfig' | 'additionalTopics'> = {
  encryptionEnabled: true,
  useStubStepGenerator: true,
  useStubReminderService: true,
  sparkGeneratorConfig: {},
  stepGeneratorConfig: undefined,
  resourceDiscoveryConfig: undefined,
  additionalTopics: undefined,
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

  /** The topic taxonomy (for topic lookups) */
  readonly taxonomy: ITopicTaxonomy;

  /** The resource discovery orchestrator (null if stub mode) */
  readonly resourceDiscovery: ResourceDiscoveryOrchestrator | null;

  /** Configuration used */
  readonly config: SparkEngineBootstrapConfig;

  /** What's stubbed vs real */
  readonly status: {
    stepGenerator: 'stub' | 'full';
    sparkGenerator: 'stub' | 'full';
    reminderService: 'stub' | 'full';
    storage: 'redis' | 'memory';
    resourceDiscovery: 'initialized' | 'not_initialized';
    curriculumLLM: 'initialized' | 'not_initialized';
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYNCHRONOUS BOOTSTRAP (Stub Mode)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Bootstrap a SparkEngine instance with stub StepGenerator (synchronous).
 *
 * This is the backward-compatible version that doesn't require async initialization.
 * Use this when you don't need full resource discovery and curriculum generation.
 *
 * @param kvStore - The underlying KeyValueStore
 * @param config - Optional configuration
 * @returns SparkEngine with stub StepGenerator
 */
export function bootstrapSparkEngine(
  kvStore: KeyValueStore,
  config: SparkEngineBootstrapConfig = {}
): SparkEngineBootstrapResult {
  const finalConfig = { ...DEFAULT_BOOTSTRAP_CONFIG, ...config };

  // Force stub mode in sync bootstrap
  if (!finalConfig.useStubStepGenerator) {
    console.warn(
      '[SPARK_ENGINE_BOOTSTRAP] Full StepGenerator requires async bootstrap. ' +
      'Use bootstrapSparkEngineAsync() instead. Falling back to stub.'
    );
  }

  console.log('[SPARK_ENGINE_BOOTSTRAP] Starting bootstrap (sync/stub mode)...');

  // 1. Create SparkEngineStoreManager
  const storeManager = createSparkEngineStoreManager(
    kvStore,
    { encryptionEnabled: finalConfig.encryptionEnabled },
    getEncryptionService()
  );
  console.log('[SPARK_ENGINE_BOOTSTRAP] StoreManager created');

  // 2. Create Store Adapter
  const storeAdapter = new SparkEngineStoreAdapter(storeManager);
  console.log('[SPARK_ENGINE_BOOTSTRAP] StoreAdapter created');

  // 3. Create SparkGenerator
  const sparkGenerator = createSparkGenerator(finalConfig.sparkGeneratorConfig);
  console.log('[SPARK_ENGINE_BOOTSTRAP] SparkGenerator created (full)');

  // 4. Create stub StepGenerator
  const stepGenerator = new StubStepGenerator();
  console.log('[SPARK_ENGINE_BOOTSTRAP] StepGenerator created (stub)');

  // 5. Create ReminderService
  const reminderService = new StubReminderService();
  console.log('[SPARK_ENGINE_BOOTSTRAP] ReminderService created (stub)');

  // 6. Create taxonomy
  const taxonomy = new TopicTaxonomy(finalConfig.additionalTopics);
  console.log('[SPARK_ENGINE_BOOTSTRAP] TopicTaxonomy created');

  // 7. Create SparkEngine
  const sparkEngine = new SparkEngine(
    storeAdapter,
    stepGenerator,
    sparkGenerator,
    reminderService
  );
  console.log('[SPARK_ENGINE_BOOTSTRAP] SparkEngine created');

  const storageStatus = kvStore.isConnected() ? 'redis' : 'memory';

  const result: SparkEngineBootstrapResult = {
    sparkEngine,
    storeManager,
    storeAdapter,
    taxonomy,
    resourceDiscovery: null,
    config: finalConfig,
    status: {
      stepGenerator: 'stub',
      sparkGenerator: 'full',
      reminderService: 'stub',
      storage: storageStatus,
      resourceDiscovery: 'not_initialized',
      curriculumLLM: 'not_initialized',
    },
  };

  console.log('[SPARK_ENGINE_BOOTSTRAP] Bootstrap complete:', result.status);

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASYNCHRONOUS BOOTSTRAP (Full Mode)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Bootstrap a SparkEngine instance with full StepGenerator (asynchronous).
 *
 * This version initializes all dependencies including:
 *   - Resource discovery system (topic registry, known sources, API keys, cache)
 *   - Curriculum LLM client
 *   - Full StepGenerator with distributed locking
 *
 * @param kvStore - The underlying KeyValueStore
 * @param redis - Redis client for distributed locking (optional, null for no locking)
 * @param providerManager - LLM provider manager for curriculum generation
 * @param config - Optional configuration
 * @returns Fully-wired SparkEngine
 */
export async function bootstrapSparkEngineAsync(
  kvStore: KeyValueStore,
  redis: Redis | null,
  providerManager: ProviderManager,
  config: SparkEngineBootstrapConfig = {}
): Promise<SparkEngineBootstrapResult> {
  const finalConfig = {
    ...DEFAULT_BOOTSTRAP_CONFIG,
    ...config,
    useStubStepGenerator: false, // Force full mode
  };

  console.log('[SPARK_ENGINE_BOOTSTRAP] Starting bootstrap (async/full mode)...');

  // 1. Initialize resource discovery system
  console.log('[SPARK_ENGINE_BOOTSTRAP] Initializing resource discovery...');
  await initResourceDiscovery();
  
  // Initialize orchestrator with config if provided
  const resourceDiscovery = finalConfig.resourceDiscoveryConfig
    ? initResourceDiscoveryOrchestrator(finalConfig.resourceDiscoveryConfig)
    : getResourceDiscoveryOrchestrator();
  console.log('[SPARK_ENGINE_BOOTSTRAP] Resource discovery initialized');

  // 2. Initialize curriculum LLM client
  console.log('[SPARK_ENGINE_BOOTSTRAP] Initializing curriculum LLM client...');
  initSecureLLMClientFromManager(providerManager);
  console.log('[SPARK_ENGINE_BOOTSTRAP] Curriculum LLM client initialized');

  // 3. Create SparkEngineStoreManager
  const storeManager = createSparkEngineStoreManager(
    kvStore,
    { encryptionEnabled: finalConfig.encryptionEnabled },
    getEncryptionService()
  );
  console.log('[SPARK_ENGINE_BOOTSTRAP] StoreManager created');

  // 4. Create Store Adapter
  const storeAdapter = new SparkEngineStoreAdapter(storeManager);
  console.log('[SPARK_ENGINE_BOOTSTRAP] StoreAdapter created');

  // 5. Create SparkGenerator
  const sparkGenerator = createSparkGenerator(finalConfig.sparkGeneratorConfig);
  console.log('[SPARK_ENGINE_BOOTSTRAP] SparkGenerator created (full)');

  // 6. Create TopicTaxonomy
  const taxonomy = new TopicTaxonomy(finalConfig.additionalTopics);
  console.log('[SPARK_ENGINE_BOOTSTRAP] TopicTaxonomy created');

  // 7. Create full StepGenerator
  const stepGenerator = createStepGenerator(
    storeAdapter,
    resourceDiscovery,
    redis,
    taxonomy,
    finalConfig.stepGeneratorConfig
  );
  console.log('[SPARK_ENGINE_BOOTSTRAP] StepGenerator created (full)');

  // 8. Create ReminderService
  let reminderService: IReminderService;
  let reminderServiceStatus: 'stub' | 'full';

  if (finalConfig.useStubReminderService) {
    reminderService = new StubReminderService();
    reminderServiceStatus = 'stub';
    console.log('[SPARK_ENGINE_BOOTSTRAP] ReminderService created (stub)');
  } else {
    // Full implementation not yet available
    reminderService = new StubReminderService();
    reminderServiceStatus = 'stub';
    console.log('[SPARK_ENGINE_BOOTSTRAP] ReminderService created (stub - full not yet wired)');
  }

  // 9. Create SparkEngine
  const sparkEngine = new SparkEngine(
    storeAdapter,
    stepGenerator,
    sparkGenerator,
    reminderService
  );
  console.log('[SPARK_ENGINE_BOOTSTRAP] SparkEngine created');

  const storageStatus = kvStore.isConnected() ? 'redis' : 'memory';

  const result: SparkEngineBootstrapResult = {
    sparkEngine,
    storeManager,
    storeAdapter,
    taxonomy,
    resourceDiscovery,
    config: finalConfig,
    status: {
      stepGenerator: 'full',
      sparkGenerator: 'full',
      reminderService: reminderServiceStatus,
      storage: storageStatus,
      resourceDiscovery: 'initialized',
      curriculumLLM: 'initialized',
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
 * Get or create the singleton SparkEngine instance (stub mode).
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
 * Get or create the singleton SparkEngine instance (full mode).
 *
 * @param kvStore - Required on first call
 * @param redis - Redis client for locking
 * @param providerManager - LLM provider manager
 * @param config - Optional configuration (only used on first call)
 */
export async function getSparkEngineAsync(
  kvStore?: KeyValueStore,
  redis?: Redis | null,
  providerManager?: ProviderManager,
  config?: SparkEngineBootstrapConfig
): Promise<SparkEngineBootstrapResult> {
  if (!sparkEngineInstance) {
    if (!kvStore) {
      throw new Error('KeyValueStore is required for initial SparkEngine creation');
    }
    if (!providerManager) {
      throw new Error('ProviderManager is required for full StepGenerator mode');
    }
    sparkEngineInstance = await bootstrapSparkEngineAsync(
      kvStore,
      redis ?? null,
      providerManager,
      config
    );
  }
  return sparkEngineInstance;
}

/**
 * Reset the singleton (for testing).
 */
export function resetSparkEngine(): void {
  sparkEngineInstance = null;
  // Also reset resource discovery and LLM client
  resetResourceDiscovery();
  resetSecureLLMClient();
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export {
  StubStepGenerator,
  StubReminderService,
};

// Backward compatibility aliases
export { TopicTaxonomy as EnhancedTopicTaxonomy };
export type { SparkEngineBootstrapConfig as SparkEngineConfig };
