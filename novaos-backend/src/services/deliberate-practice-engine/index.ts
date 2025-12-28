// ═══════════════════════════════════════════════════════════════════════════════
// DELIBERATE PRACTICE ENGINE — Public Exports
// NovaOS Deliberate Practice Engine — Phase 18
// ═══════════════════════════════════════════════════════════════════════════════
//
// This module exports the complete Deliberate Practice Engine system:
//
// Core Engine:
//   - DeliberatePracticeEngine - Main orchestrator
//   - SkillDecomposer - CapabilityStage → Skills transformation
//   - DrillGenerator - Daily drill generation with roll-forward
//   - WeekTracker - Week lifecycle management
//
// Types:
//   - Skill, DailyDrill, WeekPlan, LearningPlan
//   - SkillDifficulty, SkillMastery, DrillOutcome, DrillStatus
//
// Stores:
//   - SkillStore, DrillStore, WeekPlanStore, LearningPlanStore
//
// Usage:
//   import {
//     createDeliberatePracticeEngine,
//     createDeliberatePracticeStores,
//   } from './services/deliberate-practice-engine/index.js';
//
//   const stores = createDeliberatePracticeStores(redisStore, config, encryption);
//   const engine = createDeliberatePracticeEngine({ stores, config });
//
//   // Initialize learning plan
//   await engine.initializePlan(goal, quests, stagesByQuest);
//
//   // Get today's practice
//   const practice = await engine.getTodayPractice(userId, goalId);
//
//   // Record outcome
//   await engine.recordOutcome(drillId, { passSignalMet: true, observation: '...' });
//
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type {
  // Core types
  Skill,
  DailyDrill,
  WeekPlan,
  LearningPlan,
  
  // Enums/Unions
  SkillDifficulty,
  SkillMastery,
  DrillOutcome,
  DrillStatus,
  WeekPlanStatus,
  SparkVariant,
  ReminderTone,
  
  // Configuration
  EscalationLevelConfig,
  
  // Params
  CreateSkillParams,
  CreateDrillParams,
  CreateWeekPlanParams,
  DrillCompletionAnalysis,
  
  // Mappings
  QuestSkillMapping,
  QuestWeekMapping,
} from './types.js';

export {
  // Constants
  SKILL_DIFFICULTIES,
  SKILL_MASTERY_LEVELS,
  DRILL_OUTCOMES,
  DRILL_STATUSES,
  WEEK_PLAN_STATUSES,
  MASTERY_THRESHOLDS,
  ATTEMPTED_OUTCOMES,
  RETRY_OUTCOMES,
  DEFAULT_ESCALATION_CONFIG,
  
  // Type guards
  isSkillDifficulty,
  isSkillMastery,
  isDrillOutcome,
  isDrillStatus,
  isWeekPlanStatus,
  requiresRetry,
  countsAsAttempt,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────────────────────────────────────────

export type {
  // Decomposer
  ISkillDecomposer,
  SkillDecompositionContext,
  SkillDecompositionResult,
  
  // Generator
  IDrillGenerator,
  DrillGenerationContext,
  RollForwardResult,
  
  // Tracker
  IWeekTracker,
  WeekCompletionResult,
  WeekProgressUpdate,
  
  // Engine
  IDeliberatePracticeEngine,
  TodayPracticeResult,
  DrillCompletionParams,
  GoalProgress,
  
  // Stores
  ISkillStore,
  IDrillStore,
  IWeekPlanStore,
  ILearningPlanStore,
  IDeliberatePracticeStores,
} from './interfaces.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CORE ENGINE
// ─────────────────────────────────────────────────────────────────────────────────

export {
  DeliberatePracticeEngine,
  createDeliberatePracticeEngine,
  type DeliberatePracticeEngineConfig,
  type DeliberatePracticeEngineDependencies,
} from './deliberate-practice-engine.js';

export {
  SkillDecomposer,
  createSkillDecomposer,
  type SkillDecomposerConfig,
} from './skill-decomposer.js';

export {
  DrillGenerator,
  createDrillGenerator,
  type DrillGeneratorConfig,
} from './drill-generator.js';

export {
  WeekTracker,
  createWeekTracker,
  type WeekTrackerDependencies,
} from './week-tracker.js';

// ─────────────────────────────────────────────────────────────────────────────────
// STORES
// ─────────────────────────────────────────────────────────────────────────────────

export {
  SkillStore,
  createSkillStore,
} from './store/skill-store.js';

export {
  DrillStore,
  createDrillStore,
} from './store/drill-store.js';

export {
  WeekPlanStore,
  createWeekPlanStore,
} from './store/week-plan-store.js';

export {
  LearningPlanStore,
  createLearningPlanStore,
} from './store/learning-plan-store.js';

export {
  createDeliberatePracticeStores,
} from './store/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// SPARK INTEGRATION (Phase 4)
// ─────────────────────────────────────────────────────────────────────────────────

export type {
  // Extended types
  DrillSpark,
  SkillQuest,
  CreateSparkFromDrillParams,
  DrillSparkCompletionResult,
  DrillSparkMapping,
  SkillQuestMapping,
} from './spark-integration-types.js';

export {
  isDrillSpark,
  isSkillQuest,
} from './spark-integration-types.js';

export {
  SparkIntegration,
  createSparkIntegration,
  type SparkIntegrationConfig,
  type SparkIntegrationDependencies,
} from './spark-integration.js';

export {
  PracticeOrchestrator,
  createPracticeOrchestrator,
  type PracticeOrchestratorConfig,
  type PracticeOrchestratorDependencies,
  type TodayPracticeBundle,
  type PracticeCompletionResult,
  type ReconciliationResult,
} from './practice-orchestrator.js';

// ─────────────────────────────────────────────────────────────────────────────────
// SWORDGATE INTEGRATION (Phase 5)
// ─────────────────────────────────────────────────────────────────────────────────
//
// The SwordGateHook is exported from `src/gates/sword/sword-gate-hook.ts`
// 
// Integration in SwordGate.createGoalFromProposal():
//
// ```typescript
// import { createSwordGateHook, triggerSkillDecomposition } from './sword-gate-hook.js';
//
// // In constructor:
// this.swordGateHook = createSwordGateHook({
//   practiceEngine,
//   config: { openaiApiKey }
// });
//
// // After goal creation:
// const createResult = await this.createGoalFromProposal(...);
// if (createResult.ok && this.swordGateHook) {
//   await triggerSkillDecomposition(
//     this.swordGateHook,
//     createResult.value.goal,
//     createResult.value.quests
//   );
// }
// ```
//
