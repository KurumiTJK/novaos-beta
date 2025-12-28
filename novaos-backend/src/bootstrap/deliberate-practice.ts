// ═══════════════════════════════════════════════════════════════════════════════
// DELIBERATE PRACTICE BOOTSTRAP — Standalone Initialization
// NovaOS Bootstrap — Phase 18: Deliberate Practice Engine
// ═══════════════════════════════════════════════════════════════════════════════
//
// This module provides standalone initialization for the Deliberate Practice
// Engine when needed outside of ExecutionPipeline.
//
// Usage:
//   const { engine, stores, orchestrator } = await bootstrapDeliberatePractice({
//     kvStore,
//     encryptionService,
//     config: { openaiApiKey: '...' }
//   });
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { KeyValueStore } from '../storage/index.js';
import type { EncryptionService } from '../security/encryption/service.js';
import type { IDeliberatePracticeEngine, IDeliberatePracticeStores } from '../services/deliberate-practice-engine/interfaces.js';
import { createDeliberatePracticeStores } from '../services/deliberate-practice-engine/store/index.js';
import {
  DeliberatePracticeEngine,
  type DeliberatePracticeEngineConfig,
} from '../services/deliberate-practice-engine/deliberate-practice-engine.js';
import {
  PracticeOrchestrator,
  type PracticeOrchestratorConfig,
} from '../services/deliberate-practice-engine/practice-orchestrator.js';
import type { ISparkEngineStore } from '../services/spark-engine/interfaces.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Options for bootstrapping Deliberate Practice.
 */
export interface DeliberatePracticeBootstrapOptions {
  /** Key-value store (Redis) */
  kvStore: KeyValueStore;
  /** Encryption service for secure storage */
  encryptionService?: EncryptionService;
  /** Engine configuration */
  config?: DeliberatePracticeEngineConfig;
  /** SparkEngine store (for orchestrator) */
  sparkEngineStore?: ISparkEngineStore;
  /** Orchestrator configuration */
  orchestratorConfig?: PracticeOrchestratorConfig;
}

/**
 * Result of bootstrapping Deliberate Practice.
 */
export interface DeliberatePracticeBootstrapResult {
  /** The practice engine */
  engine: IDeliberatePracticeEngine;
  /** The stores */
  stores: IDeliberatePracticeStores;
  /** The orchestrator (if SparkEngine store provided) */
  orchestrator: PracticeOrchestrator | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOOTSTRAP FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Bootstrap the Deliberate Practice Engine.
 *
 * Creates stores, engine, and optionally orchestrator.
 */
export async function bootstrapDeliberatePractice(
  options: DeliberatePracticeBootstrapOptions
): Promise<DeliberatePracticeBootstrapResult> {
  const {
    kvStore,
    encryptionService,
    config,
    sparkEngineStore,
    orchestratorConfig,
  } = options;

  console.log('[BOOTSTRAP] Initializing Deliberate Practice Engine...');

  // Create stores
  const stores = createDeliberatePracticeStores(
    kvStore,
    undefined, // Use default config
    encryptionService
  );

  console.log('[BOOTSTRAP] Stores created');

  // Create engine
  const engine = new DeliberatePracticeEngine({
    stores,
    config,
  });

  console.log('[BOOTSTRAP] Engine created');

  // Create orchestrator if SparkEngine store is provided
  let orchestrator: PracticeOrchestrator | null = null;

  if (sparkEngineStore) {
    orchestrator = new PracticeOrchestrator({
      practiceEngine: engine,
      sparkEngineStore,
      config: orchestratorConfig,
    });

    console.log('[BOOTSTRAP] Orchestrator created');
  }

  console.log('[BOOTSTRAP] Deliberate Practice Engine ready');

  return {
    engine,
    stores,
    orchestrator,
  };
}
