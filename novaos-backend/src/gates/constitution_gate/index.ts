// ═══════════════════════════════════════════════════════════════════════════════
// CONSTITUTION GATE — Barrel Export
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Gate function
  executeConstitutionGateAsync,
  buildRegenerationMessage,
} from './constitution-gate.js';

// Types
export type {
  ConstitutionGateOutput,
  ConstitutionGateConfig,
  ConstitutionalCheckResult,
} from './types.js';

// Constitution (edit constitution_text.ts to change the constitution)
export {
  NOVA_CONSTITUTION,
  CONSTITUTIONAL_CHECK_PROMPT,
} from './constitution.js';

// Editable constitution text
export { CONSTITUTION_TEXT } from './constitution_text.js';
