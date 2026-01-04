// ═══════════════════════════════════════════════════════════════════════════════
// ABUSE MODULE — Barrel Exports
// NovaOS Security Module
// ═══════════════════════════════════════════════════════════════════════════════

// Types
export type {
  AbuseType,
  AbuseSeverity,
  AbuseAction,
  AbusePattern,
  AbuseCheckResult,
  BlockStatus,
  VetoStatus,
  AbuseConfig,
  AbuseEventType,
  AbuseEvent,
} from './types.js';

export { DEFAULT_ABUSE_CONFIG } from './types.js';

// Patterns
export {
  PROMPT_INJECTION_PATTERNS,
  HARASSMENT_PATTERNS,
  SPAM_PATTERNS,
  getPromptInjectionPatterns,
  getHarassmentPatterns,
  getSpamPatterns,
  getAllPatterns,
} from './patterns.js';

// Detector
export {
  AbuseDetector,
  BlockStore,
  VetoHistoryStore,
  initAbuseDetector,
  getAbuseDetector,
  initBlockStore,
  getBlockStore,
  initVetoHistoryStore,
  getVetoHistoryStore,
  checkForAbuse,
  blockUser,
  unblockUser,
  isUserBlocked,
  trackVeto,
  getRecentVetoCount,
  onAbuseEvent,
  clearAbuseEventHandlers,
} from './detector.js';

// Middleware
export {
  blockCheck,
  abuseDetection,
  abuseProtection,
  AbuseErrorCode,
  type AbuseMiddlewareOptions,
} from './middleware.js';
