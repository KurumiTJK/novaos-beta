// ═══════════════════════════════════════════════════════════════════════════════
// NOVAOS GATES — All Gate Implementations
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  PipelineState,
  PipelineContext,
  GateResult,
  CapabilityResult,
  Generation,
  ValidatedOutput,
  SparkResult,
  Spark,
  ActionSource,
  GenerationConstraints,
} from '../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LLM-POWERED INTENT GATE
// ─────────────────────────────────────────────────────────────────────────────────

export {
  executeIntentGate,
  executeIntentGateAsync,
  type IntentSummary,
  type PrimaryRoute,
  type SafetySignal,
  type Urgency,
} from './intent_gate/index.js';

// Re-export Stance from intent (it's now the source of truth)
export type { Stance } from './intent_gate/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────────
// STANCE GATE — Router to Sword or Lens Engine
// ─────────────────────────────────────────────────────────────────────────────────

export {
  executeStanceGate,
  executeStanceGateAsync,
  type StanceGateOutput,
  type StanceRoute,
} from './stance_gate/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MODEL GATE — The Stitcher
// ─────────────────────────────────────────────────────────────────────────────────

export {
  executeModelGate,
  executeModelGateAsync,
  stitchPrompt,
  DEFAULT_PERSONALITY,
  type ModelGateOutput,
  type ModelGateConfig,
  type Personality,
  type StitchedPrompt,
} from './model/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// PERSONALITY GATE — Constitutional Compliance Check
// ─────────────────────────────────────────────────────────────────────────────────

export {
  executePersonalityGate,
  executePersonalityGateAsync,
  buildRegenerationMessage,
  NOVA_CONSTITUTION,
  type PersonalityGateOutput,
  type PersonalityGateConfig,
  type ConstitutionalCheckResult,
} from './personality/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// SHIELD GATE — Router to Shield Engine
// ─────────────────────────────────────────────────────────────────────────────────

export {
  executeShieldGate,
  executeShieldGateAsync,
  type ShieldGateOutput,
  type ShieldRoute,
} from './shield_gate/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TOOLS GATE — Router to External Tools Engine
// ─────────────────────────────────────────────────────────────────────────────────

export {
  executeToolsGate,
  executeToolsGateAsync,
  type ToolsGateOutput,
  type ToolsRoute,
} from './tools_gate/index.js';

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


// ═══════════════════════════════════════════════════════════════════════════════
// LEGACY CAPABILITY GATE (kept for backwards compatibility)
// ═══════════════════════════════════════════════════════════════════════════════

type LegacyStance = 'control' | 'shield' | 'lens' | 'sword';
const VALID_ACTION_SOURCES = ['explicit', 'ui_button', 'command_parser', 'api_field'] as const;

export function executeLegacyCapabilityGate(
  state: PipelineState,
  context: PipelineContext
): GateResult<CapabilityResult> {
  const start = Date.now();
  const stance = (state.stance ?? 'lens') as LegacyStance;

  const capabilities: Record<LegacyStance, readonly string[]> = {
    control: ['provide_support', 'suggest_resources'],
    shield: ['provide_info', 'suggest_alternatives'],
    lens: ['provide_info', 'explain', 'analyze'],
    sword: ['provide_info', 'recommend', 'plan', 'execute_action'],
  };

  const actionSources = context.actionSources ?? [];
  let explicitActions: readonly ActionSource[] | undefined;
  const deniedCapabilities: string[] = [];

  if (actionSources.length > 0) {
    const validActions = actionSources.filter(a => VALID_ACTION_SOURCES.includes(a.type));
    
    const hasNlInference = actionSources.some(a => a.type === 'nl_inference');
    if (hasNlInference) {
      deniedCapabilities.push('nl_inference_blocked');
    }

    if (validActions.length > 0) {
      explicitActions = validActions;
    }
  }

  return {
    gateId: 'capability',
    status: 'pass',
    output: {
      allowedCapabilities: capabilities[stance] ?? [],
      deniedCapabilities,
      explicitActions,
    },
    action: 'continue',
    executionTimeMs: Date.now() - start,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL CONSTRAINTS BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

export function buildModelConstraints(state: PipelineState): GenerationConstraints {
  const constraints: GenerationConstraints = {
    maxWe: 2,
    bannedPhrases: ['I\'m always here for you', 'You can always count on me'],
    tone: state.stance === 'control' ? 'compassionate' : 'professional',
  };

  // TODO: Add tools intervention logic when Tools Engine is implemented
  // if (state.toolsResult?.route === 'tools') { ... }

  // TODO: Add shield intervention logic when Shield Engine is implemented
  // if (state.shieldResult?.route === 'shield') { ... }

  return constraints;
}


// ═══════════════════════════════════════════════════════════════════════════════
// SPARK GATE
// ═══════════════════════════════════════════════════════════════════════════════

interface SparkTemplate {
  action: string;
  rationale: string;
}

const SPARK_TEMPLATES = {
  exercise: {
    action: 'Put on your workout clothes right now',
    rationale: 'Starting with the smallest physical step reduces activation energy',
  },
  writing: {
    action: 'Open a blank document and write just one sentence',
    rationale: 'One sentence breaks the blank page barrier',
  },
  default: {
    action: 'Take 2 minutes to write down your next concrete step',
    rationale: 'Externalizing the task reduces cognitive load',
  },
} as const satisfies Record<string, SparkTemplate>;

export function executeSparkGate(
  state: PipelineState,
  _context: PipelineContext
): GateResult<SparkResult> {
  const start = Date.now();

  if (state.stance !== 'sword') {
    return {
      gateId: 'spark',
      status: 'pass',
      output: {
        eligible: false,
        ineligibilityReason: 'not_sword_stance',
      },
      action: 'continue',
      executionTimeMs: Date.now() - start,
    };
  }

  if (state.shieldResult?.route === 'shield') {
    return {
      gateId: 'spark',
      status: 'pass',
      output: {
        eligible: false,
        ineligibilityReason: 'shield_intervention_active',
      },
      action: 'continue',
      executionTimeMs: Date.now() - start,
    };
  }

  const text = state.normalizedInput.toLowerCase();
  let template: { action: string; rationale: string } = SPARK_TEMPLATES.default;

  if (/\b(exercise|workout|gym|fitness|run)\b/.test(text)) {
    template = SPARK_TEMPLATES.exercise;
  } else if (/\b(write|writing|essay|blog|article)\b/.test(text)) {
    template = SPARK_TEMPLATES.writing;
  }

  return {
    gateId: 'spark',
    status: 'pass',
    output: {
      eligible: true,
      spark: {
        action: template.action,
        rationale: template.rationale,
        timeEstimate: '2 minutes',
        category: 'immediate',
      },
    },
    action: 'continue',
    executionTimeMs: Date.now() - start,
  };
}
