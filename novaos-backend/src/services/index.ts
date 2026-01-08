// ═══════════════════════════════════════════════════════════════════════════════
// SERVICES MODULE — Business Logic Layer
// ═══════════════════════════════════════════════════════════════════════════════

export {
  findUserByExternalId,
  createUser,
  getOrCreateUser,
  getSettings,
  updateSettings,
  deleteSettings,
} from './settings.js';

// ─────────────────────────────────────────────────────────────────────────────────
// SHIELD SERVICE
// ─────────────────────────────────────────────────────────────────────────────────

export {
  ShieldService,
  getShieldService,
  resetShieldService,
  assessRisk,
  getActiveCrisisSession,
  createCrisisSession,
  resolveCrisisSession,
  getCrisisSession,
  type ShieldAction,
  type ShieldEvaluation,
  type RiskAssessment,
  type CrisisSession,
  type ShieldActivation,
} from './shield/index.js';
