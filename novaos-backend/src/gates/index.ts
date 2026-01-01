// ═══════════════════════════════════════════════════════════════════════════════
// NOVAOS GATES — All Gate Implementations
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// INTENT GATE — LLM-Powered Intent Classification
// ─────────────────────────────────────────────────────────────────────────────────

export {
  executeIntentGateAsync,
  type IntentSummary,
  type PrimaryRoute,
  type SafetySignal,
  type Urgency,
  type Stance,
} from './intent_gate/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// SHIELD GATE — Router to Shield Engine
// ─────────────────────────────────────────────────────────────────────────────────

export {
  executeShieldGate,
  type ShieldGateOutput,
  type ShieldRoute,
} from './shield_gate/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TOOLS GATE — Router to External Tools Engine
// ─────────────────────────────────────────────────────────────────────────────────

export {
  executeToolsGate,
  type ToolsGateOutput,
  type ToolsRoute,
} from './tools_gate/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// STANCE GATE — Router to Sword or Lens Engine
// ─────────────────────────────────────────────────────────────────────────────────

export {
  executeStanceGate,
  type StanceGateOutput,
  type StanceRoute,
} from './stance_gate/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CAPABILITY GATE — Live Data Fetching
// ─────────────────────────────────────────────────────────────────────────────────

export {
  executeCapabilityGate,
  executeCapabilityGateAsync,
  getCapabilityRegistry,
  initializeCapabilities,
  setupCapabilities,
  type CapabilityGateOutput,
  type Capability,
  type EvidenceItem,
} from './capability_gate/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// RESPONSE GATE — The Stitcher
// ─────────────────────────────────────────────────────────────────────────────────

export {
  executeResponseGateAsync,
  stitchPrompt,
  DEFAULT_PERSONALITY,
  type ResponseGateOutput,
  type ResponseGateConfig,
  type Personality,
  type StitchedPrompt,
} from './response_gate/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTITUTION GATE — Constitutional Compliance Check
// ─────────────────────────────────────────────────────────────────────────────────

export {
  executeConstitutionGateAsync,
  buildRegenerationMessage,
  NOVA_CONSTITUTION,
  type ConstitutionGateOutput,
  type ConstitutionGateConfig,
  type ConstitutionalCheckResult,
} from './constitution_gate/index.js';
