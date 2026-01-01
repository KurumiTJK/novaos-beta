// ═══════════════════════════════════════════════════════════════════════════════
// TYPES — Main Type Exports
// NovaOS Pipeline Types — Cleaned Up
// ═══════════════════════════════════════════════════════════════════════════════

// Re-exports
export * from './result.js';
export * from './branded.js';
export * from './common.js';

// ─────────────────────────────────────────────────────────────────────────────────
// STANCE
// ─────────────────────────────────────────────────────────────────────────────────

export type Stance = 'control' | 'shield' | 'lens' | 'sword';

// ─────────────────────────────────────────────────────────────────────────────────
// INTENT SUMMARY (Intent Gate Output)
// ─────────────────────────────────────────────────────────────────────────────────

export type PrimaryRoute = 'SAY' | 'MAKE' | 'FIX' | 'DO';
export type IntentStance = 'LENS' | 'SWORD' | 'SHIELD';
export type SafetySignal = 'none' | 'low' | 'medium' | 'high';
export type Urgency = 'low' | 'medium' | 'high';

export interface IntentSummary {
  primary_route: PrimaryRoute;
  stance: IntentStance;
  safety_signal: SafetySignal;
  urgency: Urgency;
  live_data: boolean;
  external_tool: boolean;
  learning_intent: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONVERSATION MESSAGE
// ─────────────────────────────────────────────────────────────────────────────────

export interface ConversationMessage {
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
  readonly timestamp?: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// GATE ACTION & STATUS
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
// GATE RESULT
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
// SHIELD GATE OUTPUT (Router)
// ─────────────────────────────────────────────────────────────────────────────────

export type ShieldRoute = 'shield' | 'skip';

export interface ShieldGateOutput {
  route: ShieldRoute;
  safety_signal: SafetySignal;
  urgency: Urgency;
}

// ─────────────────────────────────────────────────────────────────────────────────
// TOOLS GATE OUTPUT (Router)
// ─────────────────────────────────────────────────────────────────────────────────

export type ToolsRoute = 'tools' | 'skip';

export interface ToolsGateOutput {
  route: ToolsRoute;
  external_tool: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// STANCE GATE OUTPUT (Router)
// ─────────────────────────────────────────────────────────────────────────────────

export type StanceRoute = 'sword' | 'lens';

export interface StanceGateOutput {
  route: StanceRoute;
  primary_route: PrimaryRoute;
  learning_intent: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CAPABILITY GATE OUTPUT
// ─────────────────────────────────────────────────────────────────────────────────

export interface EvidenceItem {
  readonly type: string;
  readonly formatted: string;
  readonly source: string;
  readonly raw?: unknown;
  readonly fetchedAt: number;
}

export interface CapabilityGateOutput {
  readonly capabilitiesUsed: string[];
  readonly evidenceItems: EvidenceItem[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// RESPONSE GATE OUTPUT
// ─────────────────────────────────────────────────────────────────────────────────

export interface Generation {
  readonly text: string;
  readonly model: string;
  readonly tokensUsed: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// SPARK (For Sword — Future)
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
// GATE RESULTS COLLECTION
// ─────────────────────────────────────────────────────────────────────────────────

export interface GateResults {
  intent?: GateResult<IntentSummary>;
  shield?: GateResult<ShieldGateOutput>;
  tools?: GateResult<ToolsGateOutput>;
  stance?: GateResult<StanceGateOutput>;
  capability?: GateResult<CapabilityGateOutput>;
  response?: GateResult<Generation>;
  spark?: GateResult<SparkResult>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// PIPELINE CONTEXT
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
  timestamp?: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// PIPELINE STATE
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
  
  // Gate outputs
  intent_summary?: IntentSummary;
  shieldResult?: ShieldGateOutput;
  toolsResult?: ToolsGateOutput;
  stanceResult?: StanceGateOutput;
  capabilityResult?: CapabilityGateOutput;
  generation?: Generation;
  spark?: Spark;
  
  // For pipeline flow control
  stance?: Stance;
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
