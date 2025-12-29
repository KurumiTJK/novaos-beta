// ═══════════════════════════════════════════════════════════════════════════════
// DELIBERATE PRACTICE STORE — Public Exports
// NovaOS Deliberate Practice Engine — Phase 18: Storage Layer
// Phase 19B: GoalStore integration for multi-goal support
// ═══════════════════════════════════════════════════════════════════════════════
//
// This module exports the storage layer for the Deliberate Practice Engine.
//
// Usage:
//   import {
//     createSkillStore,
//     createDrillStore,
//     createWeekPlanStore,
//     createLearningPlanStore,
//     createDeliberatePracticeStores,
//   } from './store/index.js';
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { KeyValueStore } from '../../../storage/index.js';
import type { EncryptionService } from '../../../security/encryption/service.js';
import type { SecureStoreConfig } from '../../spark-engine/store/types.js';
import type { IDeliberatePracticeStores } from '../interfaces.js';

// ─────────────────────────────────────────────────────────────────────────────────
// STORE EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export { SkillStore, createSkillStore } from './skill-store.js';
export { DrillStore, createDrillStore } from './drill-store.js';
export { WeekPlanStore, createWeekPlanStore } from './week-plan-store.js';
export { LearningPlanStore, createLearningPlanStore } from './learning-plan-store.js';

// ─────────────────────────────────────────────────────────────────────────────────
// COMBINED STORE FACTORY
// ─────────────────────────────────────────────────────────────────────────────────

import { createSkillStore } from './skill-store.js';
import { createDrillStore } from './drill-store.js';
import { createWeekPlanStore } from './week-plan-store.js';
import { createLearningPlanStore } from './learning-plan-store.js';
// Phase 19B: Import GoalStore for multi-goal support
import { createGoalStore } from '../../spark-engine/store/goal-store.js';

/**
 * Create all Deliberate Practice stores.
 *
 * @param store - The underlying key-value store (Redis)
 * @param config - Optional store configuration
 * @param encryption - Optional encryption service
 * @returns All stores in a single object
 */
export function createDeliberatePracticeStores(
  store: KeyValueStore,
  config?: Partial<SecureStoreConfig>,
  encryption?: EncryptionService
): IDeliberatePracticeStores {
  return {
    skills: createSkillStore(store, config, encryption),
    drills: createDrillStore(store, config, encryption),
    weekPlans: createWeekPlanStore(store, config, encryption),
    learningPlans: createLearningPlanStore(store, config, encryption),
    // Phase 19B: Add goals store for multi-goal support
    goals: createGoalStore(store, config, encryption),
  };
}
