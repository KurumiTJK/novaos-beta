// ═══════════════════════════════════════════════════════════════════════════════
// DELIBERATE PRACTICE BOOTSTRAP — Standalone Initialization
// NovaOS Bootstrap — Phase 18: Deliberate Practice Engine
// ═══════════════════════════════════════════════════════════════════════════════
//
// This module provides standalone initialization for the Deliberate Practice
// Engine when needed outside of ExecutionPipeline.
//
// Usage:
//   const { engine, stores } = await bootstrapDeliberatePractice({
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
}

/**
 * Result of bootstrapping Deliberate Practice.
 */
export interface DeliberatePracticeBootstrapResult {
  /** The practice engine */
  engine: IDeliberatePracticeEngine;
  /** The stores */
  stores: IDeliberatePracticeStores;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOOTSTRAP FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Bootstrap the Deliberate Practice Engine.
 *
 * Creates stores and engine.
 * 
 * Note: To create a PracticeOrchestrator, you need to do that separately
 * after this bootstrap, providing the sparkIntegration and sparkStore
 * from your SparkEngine setup.
 */
export async function bootstrapDeliberatePractice(
  options: DeliberatePracticeBootstrapOptions
): Promise<DeliberatePracticeBootstrapResult> {
  const {
    kvStore,
    encryptionService,
    config,
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

  console.log('[BOOTSTRAP] Deliberate Practice Engine ready');

  return {
    engine,
    stores,
  };
}
