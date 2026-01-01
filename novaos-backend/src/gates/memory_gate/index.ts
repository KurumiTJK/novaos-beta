// ═══════════════════════════════════════════════════════════════════════════════
// MEMORY GATE — Barrel Export
// ═══════════════════════════════════════════════════════════════════════════════

// Gate function
export { executeMemoryGateAsync } from './memory-gate.js';

// Types
export type {
  MemoryGateOutput,
  MemoryGateConfig,
  MemoryRecord,
  MemoryCheckResult,
} from './types.js';

// Patterns
export {
  hasMemoryKeyword,
  matchStrongPattern,
  MEMORY_KEYWORDS,
  STRONG_PATTERNS,
} from './patterns.js';

// Store
export {
  getMemoryStore,
  initializeMemoryStore,
  isMemoryStoreInitialized,
  generateMemoryId,
  MemoryStore,
} from './store.js';
