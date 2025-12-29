// ═══════════════════════════════════════════════════════════════════════════════
// LESSON MODE — Module Exports
// NovaOS Gates — Phase 20: Simplified Lesson Mode
// ═══════════════════════════════════════════════════════════════════════════════

// Types
export type {
  LessonIntent,
  LessonStage,
  LessonModeState,
  LessonModeConfig,
  LessonModeInput,
  LessonModeOutput,
  GoalSummary,
  LessonIntentResult,
} from './types.js';

export {
  LESSON_INTENTS,
  LESSON_STAGES,
  DEFAULT_LESSON_MODE_CONFIG,
  isLessonIntent,
  isInLessonMode,
  allowsQuestions,
  createInitialLessonState,
} from './types.js';

// Store
export { LessonStore, createLessonStore } from './lesson-store.js';

// Classifier
export {
  LessonIntentClassifier,
  createLessonIntentClassifier,
  type LessonIntentContext,
} from './lesson-intent-classifier.js';

// Main handler
export {
  LessonMode,
  createLessonMode,
  type LessonModeDependencies,
} from './lesson-mode.js';
