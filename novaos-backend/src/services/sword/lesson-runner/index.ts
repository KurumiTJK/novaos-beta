// ═══════════════════════════════════════════════════════════════════════════════
// LESSON RUNNER SERVICE
// Orchestrates daily learning experience
// ═══════════════════════════════════════════════════════════════════════════════

// Re-export all runner services
export { TodayService, getToday } from './today.js';
export { DailyPlanGenerator, generateDailyPlan } from './daily-plan.js';
export {
  ProgressService,
  startSession,
  completeSession,
  completeAsset,
  completeSpark,
  completeNode,
} from './progress.js';
export { checkNeedsRefresh, generateRefreshSession } from './refresh.js';
export { checkNodeSwitch } from './switching.js';
export { checkPrerequisites } from './prerequisites.js';
export { checkMasteryRequirements, submitMasteryReflection } from './mastery.js';
export { getNodeById, getNodesForPlan } from './nodes.js';

import { getToday } from './today.js';
import { generateDailyPlan } from './daily-plan.js';
import {
  startSession,
  completeSession,
  completeAsset,
  completeSpark,
  completeNode,
  getLearningStats,
} from './progress.js';
import { checkNeedsRefresh } from './refresh.js';
import { checkNodeSwitch } from './switching.js';
import { checkPrerequisites } from './prerequisites.js';
import { checkMasteryRequirements, submitMasteryReflection } from './mastery.js';
import { getNodeById, getNodesForPlan, getNodeProgress } from './nodes.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONSOLIDATED API
// ─────────────────────────────────────────────────────────────────────────────────

export const LessonRunner = {
  // Main entry point
  getToday,

  // Session management
  startSession,
  completeSession,
  
  // Asset/Spark completion
  completeAsset,
  completeSpark,
  
  // Node completion
  checkMastery: checkMasteryRequirements,
  submitMastery: submitMasteryReflection,
  completeNode,
  
  // Navigation
  checkSwitch: checkNodeSwitch,
  checkPrereqs: checkPrerequisites,
  
  // Refresh
  checkRefresh: checkNeedsRefresh,
  
  // Data access
  getNode: getNodeById,
  getNodes: getNodesForPlan,
  getProgress: getNodeProgress,
  getStats: getLearningStats,
  
  // Daily plan generation
  generatePlan: generateDailyPlan,
};

export default LessonRunner;
