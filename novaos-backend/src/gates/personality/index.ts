// ═══════════════════════════════════════════════════════════════════════════════
// PERSONALITY GATE — Barrel Export
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Gate functions
  executePersonalityGate,
  executePersonalityGateAsync,
  buildRegenerationMessage,
  
  // Types
  type ConstitutionalCheckResult,
  type PersonalityGateOutput,
  type PersonalityGateConfig,
} from './personality-gate.js';

// Constitution (edit constitution_text.ts to change the constitution)
export {
  NOVA_CONSTITUTION,
  CONSTITUTIONAL_CHECK_PROMPT,
} from './constitution.js';

// Editable constitution text
export { CONSTITUTION_TEXT } from './constitution_text.js';
