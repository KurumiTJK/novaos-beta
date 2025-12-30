// ═══════════════════════════════════════════════════════════════════════════════
// TYPES — Main Type Exports (CORRECTED to match actual code usage)
// ═══════════════════════════════════════════════════════════════════════════════

// Re-exports
export * from './categories.js';
export * from './data-need.js';
export * from './constraints.js';
export * from './entities.js';
export * from './provider-results.js';
// NOTE: LensResult now defined in this file (was './lens.js')
export * from './search.js';

// ─────────────────────────────────────────────────────────────────────────────────
// STANCE
// ─────────────────────────────────────────────────────────────────────────────────

export type Stance = 'control' | 'shield' | 'lens' | 'sword';

// ─────────────────────────────────────────────────────────────────────────────────
// RISK LEVEL (includes 'safe' and 'elevated' used in code)
// ─────────────────────────────────────────────────────────────────────────────────

export type RiskLevel = 'safe' | 'low' | 'medium' | 'elevated' | 'high' | 'critical';

// ─────────────────────────────────────────────────────────────────────────────────
// STAKES LEVEL
// ─────────────────────────────────────────────────────────────────────────────────

export type StakesLevel = 'low' | 'medium' | 'high';

// ─────────────────────────────────────────────────────────────────────────────────
// CONVERSATION MESSAGE
// ─────────────────────────────────────────────────────────────────────────────────

export interface ConversationMessage {
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
  readonly timestamp?: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// INTENT TYPES (corrected to match actual code usage)
// ─────────────────────────────────────────────────────────────────────────────────

export type IntentType =
  | 'question'
  | 'command'
  | 'action'
  | 'planning'
  | 'discussion'
  | 'conversation'
  | 'creative'
  | 'analysis'
  | 'support'
  | 'rewrite'
  | 'summarize'
  | 'translate'
  | 'unknown';

export type Domain =
  | 'general'
  | 'technical'
  | 'technology'
  | 'financial'
  | 'finance'
  | 'medical'
  | 'health'
  | 'legal'
  | 'creative'
  | 'educational'
  | 'education'
  | 'personal'
  | 'mental_health'
  | 'career'
  | 'relationships';

export interface Intent {
  readonly type: IntentType;
  readonly domain?: Domain;
  readonly primaryDomain?: Domain;
  readonly domains?: readonly Domain[];
  readonly confidence: number;
  readonly keywords?: readonly string[];
  readonly entities?: readonly string[];
  readonly urgency?: 'low' | 'medium' | 'high';
  readonly complexity?: 'simple' | 'moderate' | 'complex' | 'low' | 'medium' | 'high';
  readonly isHypothetical?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// GATE ACTION & STATUS (corrected to match actual code usage)
// ─────────────────────────────────────────────────────────────────────────────────

export type GateAction = 
  | 'continue' 
  | 'stop' 
  | 'halt'
  | 'await_ack' 
  | 'regenerate'
  | 'degrade';

export type GateStatus = 
  | 'pass'
  | 'passed' 
  | 'blocked' 
  | 'awaiting' 
  | 'warning'
  | 'soft_fail'
  | 'hard_fail';

// ─────────────────────────────────────────────────────────────────────────────────
// GATE RESULTS
// ─────────────────────────────────────────────────────────────────────────────────

export interface GateResult<T = unknown> {
  readonly gate?: string;
  readonly gateId?: string;
  readonly action: GateAction;
  readonly status: GateStatus;
  readonly output: T;
  readonly message?: string;
  readonly timestamp?: number;
  readonly latencyMs?: number;
  readonly executionTimeMs?: number;
  readonly failureReason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// SHIELD RESULT (corrected)
// ─────────────────────────────────────────────────────────────────────────────────

export interface ShieldResult {
  readonly safe?: boolean;
  readonly riskLevel: RiskLevel;
  readonly message?: string;
  readonly ackToken?: string;
  readonly controlMode?: boolean | string;
  readonly vetoType?: 'hard' | 'soft';
  readonly blockedCategories?: readonly string[];
  readonly triggers?: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// LENS RESULT (NEW — Simple LLM Data Router)
// ─────────────────────────────────────────────────────────────────────────────────

export type DataType = 'realtime' | 'web_search' | 'none';

export interface LensResult {
  readonly needsExternalData: boolean;
  readonly dataType: DataType;
  readonly reason: string;
  readonly confidence: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// STANCE RESULT (LLM-powered stance gate output)
// ─────────────────────────────────────────────────────────────────────────────────

export interface StanceResult {
  readonly stance: 'lens' | 'sword';
  readonly reason: string;
  readonly confidence: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CAPABILITY RESULT (corrected)
// ─────────────────────────────────────────────────────────────────────────────────

export interface CapabilityResult {
  readonly canProvideInfo?: boolean;
  readonly canTakeAction?: boolean;
  readonly canRecommend?: boolean;
  readonly restrictions?: readonly string[];
  readonly allowedCapabilities?: readonly string[];
  readonly deniedCapabilities?: readonly string[];
  readonly explicitActions?: readonly string[] | readonly ActionSource[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// SPARK
// ─────────────────────────────────────────────────────────────────────────────────

export interface Spark {
  readonly action: string;
  readonly rationale: string;
  readonly timeframe?: string;
  readonly timeEstimate?: string;
  readonly priority?: 'low' | 'medium' | 'high';
  readonly category?: 'immediate' | 'short_term' | 'long_term';
}

export interface SparkResult {
  readonly spark?: Spark | null;
  readonly reason?: string;
  readonly eligible?: boolean;
  readonly ineligibilityReason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// GENERATION CONSTRAINTS (corrected - mutable for code that assigns)
// ─────────────────────────────────────────────────────────────────────────────────

export interface GenerationConstraints {
  numericPrecisionAllowed?: boolean;
  actionRecommendationsAllowed?: boolean;
  mustInclude?: readonly string[];
  mustPrepend?: string;
  bannedPhrases?: readonly string[];
  maxWe?: number;
  tone?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// GENERATION (corrected)
// ─────────────────────────────────────────────────────────────────────────────────

export interface Generation {
  readonly text: string;
  readonly model: string;
  readonly tokensUsed: number;
  readonly constraints?: GenerationConstraints;
  readonly fallbackUsed?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATED OUTPUT (corrected)
// ─────────────────────────────────────────────────────────────────────────────────

export interface ValidatedOutput {
  readonly text: string;
  readonly valid?: boolean;
  readonly edited?: boolean;
  readonly violations?: readonly string[] | readonly {
    type: string;
    phrase: string;
    severity: 'high' | 'medium' | 'low';
    canSurgicalEdit: boolean;
  }[];
  readonly corrections?: readonly string[];
  readonly regenerationConstraints?: {
    readonly bannedPhrases?: readonly string[];
    readonly mustInclude?: readonly string[];
    readonly maxLength?: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// GATE RESULTS COLLECTION
// ─────────────────────────────────────────────────────────────────────────────────

export interface GateResults {
  intent?: GateResult<Intent>;
  shield?: GateResult<ShieldResult>;
  lens?: GateResult<LensResult>;
  stance?: GateResult<StanceResult>;
  capability?: GateResult<CapabilityResult>;
  model?: GateResult<Generation>;
  personality?: GateResult<ValidatedOutput>;
  spark?: GateResult<SparkResult>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// ACTION SOURCE (corrected)
// ─────────────────────────────────────────────────────────────────────────────────

export type ActionSourceType = 
  | 'explicit' 
  | 'implicit' 
  | 'inferred' 
  | 'nl_inference' 
  | 'system'
  | 'ui_button'
  | 'command_parser'
  | 'api_field';

export interface ActionSource {
  readonly type: ActionSourceType;
  readonly action?: string;
  readonly timestamp?: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// PIPELINE CONTEXT (corrected)
// ─────────────────────────────────────────────────────────────────────────────────

export interface PipelineContext {
  readonly requestId?: string;
  readonly userId?: string;
  readonly sessionId?: string;
  readonly conversationId?: string;
  readonly conversationHistory?: readonly ConversationMessage[];
  readonly userPreferences?: Readonly<Record<string, unknown>>;
  ackTokenValid?: boolean;
  readonly ackToken?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly timezone?: string;
  readonly locale?: string;
  readonly actionSources?: readonly ActionSource[];
  timestamp?: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// PIPELINE STATE (corrected - mutable)
// ─────────────────────────────────────────────────────────────────────────────────

export interface PipelineState {
  userMessage: string;
  normalizedInput: string;
  gateResults: GateResults;
  flags: Record<string, unknown>;
  timestamps: {
    pipelineStart: number;
    [key: string]: number;
  };
  
  // Intermediate results (mutable)
  intent?: Intent;
  shieldResult?: ShieldResult;
  lensResult?: LensResult;
  stance?: Stance;
  capabilities?: CapabilityResult;
  generation?: Generation;
  validatedOutput?: ValidatedOutput;
  spark?: Spark;
}

// ─────────────────────────────────────────────────────────────────────────────────
// PIPELINE STATUS & RESULT
// ─────────────────────────────────────────────────────────────────────────────────

export type PipelineStatus =
  | 'success'
  | 'stopped'
  | 'await_ack'
  | 'degraded'
  | 'error';

export interface PipelineResult {
  readonly status: PipelineStatus;
  readonly response: string;
  readonly stance: Stance;
  readonly gateResults: GateResults;
  readonly spark?: Spark;
  readonly ackToken?: string;
  readonly ackMessage?: string;
  readonly metadata: {
    readonly requestId?: string;
    readonly totalTimeMs: number;
    readonly regenerations?: number;
    readonly degradationReason?: string;
    readonly error?: string;
  };
}
