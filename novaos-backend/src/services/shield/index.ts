// ═══════════════════════════════════════════════════════════════════════════════
// SHIELD SERVICE — Exports
// ═══════════════════════════════════════════════════════════════════════════════

export {
  ShieldService,
  getShieldService,
  resetShieldService,
} from './shield-service.js';

export { assessRisk } from './risk-assessor.js';

export {
  getActiveCrisisSession,
  createCrisisSession,
  resolveCrisisSession,
  getCrisisSession,
} from './crisis-session.js';

export type {
  ShieldAction,
  ShieldEvaluation,
  RiskAssessment,
  CrisisSession,
  ShieldActivation,
} from './types.js';
