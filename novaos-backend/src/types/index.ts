// ═══════════════════════════════════════════════════════════════════════════════
// TYPES — NovaOS Pipeline Types
// ═══════════════════════════════════════════════════════════════════════════════

export * from './result.js';
export * from './branded.js';
export * from './common.js';

// ─────────────────────────────────────────────────────────────────────────────────
// STANCE & ACTION
// ─────────────────────────────────────────────────────────────────────────────────

export type Stance = 'control' | 'shield' | 'lens' | 'sword';
export type ActionSource = 'chat' | 'command' | 'api' | 'system';

// ─────────────────────────────────────────────────────────────────────────────────
// INTENT GATE
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
// CONVERSATION
// ─────────────────────────────────────────────────────────────────────────────────

export interface ConversationMessage {
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
  readonly timestamp?: number;
  readonly metadata?: { readonly liveData?: boolean };
}

// ─────────────────────────────────────────────────────────────────────────────────
// GATE TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type GateAction = 'continue' | 'stop' | 'halt' | 'await_ack' | 'regenerate' | 'degrade' | 'redirect';
export type GateStatus = 'pass' | 'passed' | 'blocked' | 'awaiting' | 'warning' | 'soft_fail' | 'hard_fail';

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
// GATE OUTPUTS
// ─────────────────────────────────────────────────────────────────────────────────

export type ShieldRoute = 'shield' | 'skip';
export interface ShieldGateOutput {
  route: ShieldRoute;
  safety_signal: SafetySignal;
  urgency: Urgency;
}

export type ToolsRoute = 'tools' | 'skip';
export interface ToolsGateOutput {
  route: ToolsRoute;
  external_tool: boolean;
}

export type StanceRoute = 'sword' | 'lens';

// ═══════════════════════════════════════════════════════════════════════════════
// SWORDGATE REDIRECT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SwordRedirect signals the frontend to navigate to the SwordGate UI
 * instead of receiving a chat response.
 */
export interface SwordRedirect {
  /** Always 'swordgate' */
  target: 'swordgate';
  
  /** 
   * designer: User wants to create a new learning plan
   * runner: User wants to continue an existing plan
   */
  mode: 'designer' | 'runner';
  
  /** If runner mode, which plan to resume */
  planId?: string;
  
  /** If designer mode, the extracted topic */
  topic?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SWORDGATE CONTEXT (Entry A Enrichment - DEPRECATED)
// Now using redirect instead of enrichment
// ═══════════════════════════════════════════════════════════════════════════════

export interface SwordContext {
  hasActivePlan: boolean;
  currentNode?: {
    id: string;
    title: string;
    route: string;
    sessionNumber: number;
    totalSessions: number;
  };
  currentSpark?: {
    id: string;
    task: string;
    estimatedMinutes: number;
  };
  completedNodes?: number;
  totalNodes?: number;
}

export interface StanceGateOutput {
  route: StanceRoute;
  primary_route: PrimaryRoute;
  learning_intent: boolean;
  
  /** 
   * SwordGate redirect - present when route='sword'
   * Frontend should navigate to SwordGate UI instead of showing chat response
   */
  redirect?: SwordRedirect;
  
  /** @deprecated Use redirect instead */
  swordContext?: SwordContext;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CAPABILITY GATE
// ─────────────────────────────────────────────────────────────────────────────────

export interface EvidenceItem {
  readonly type: string;
  readonly formatted: string;
  readonly source: string;
  readonly raw?: unknown;
  readonly fetchedAt: number;
}

export type ProviderName = 'gemini_grounded' | 'openai';

export interface ProviderConfig {
  provider: ProviderName;
  model: string;
  tools?: unknown[];
  temperature?: number;
  maxTokens?: number;
  topic?: string;
}

export interface CapabilityGateOutput {
  readonly provider?: ProviderName;
  readonly config?: ProviderConfig;
  readonly capabilitiesUsed?: string[];
  readonly evidenceItems?: EvidenceItem[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// RESPONSE GATE
// ─────────────────────────────────────────────────────────────────────────────────

export interface Generation {
  text: string;
  readonly model: string;
  readonly tokensUsed: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTITUTION GATE
// ─────────────────────────────────────────────────────────────────────────────────

export interface ValidatedOutput {
  text: string;
  model?: string;
  tokensUsed?: number;
}

export interface ConstitutionalCheckResult {
  violates: boolean;
  reason: string | null;
  fix: string | null;
}

export interface ConstitutionGateOutput extends ValidatedOutput {
  valid: boolean;
  edited: boolean;
  checkRun: boolean;
  skipReason?: string;
  constitutionalCheck?: ConstitutionalCheckResult;
  fixGuidance?: string;
  violations?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// MEMORY GATE
// ─────────────────────────────────────────────────────────────────────────────────

export interface MemoryRecord {
  id: string;
  userId: string;
  userMessage: string;
  generatedResponse: string;
  source: 'regex' | 'llm';
  timestamp: number;
}

export interface MemoryGateOutput {
  text: string;
  memoryDetected: boolean;
  memoryStored: boolean;
  memoryRecord?: MemoryRecord;
  skipReason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// GATE RESULTS
// ─────────────────────────────────────────────────────────────────────────────────

export interface GateResults {
  intent?: GateResult<IntentSummary>;
  shield?: GateResult<ShieldGateOutput>;
  tools?: GateResult<ToolsGateOutput>;
  stance?: GateResult<StanceGateOutput>;
  capability?: GateResult<CapabilityGateOutput>;
  response?: GateResult<Generation>;
  model?: GateResult<Generation>;
  constitution?: GateResult<ConstitutionGateOutput>;
  memory?: GateResult<MemoryGateOutput>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// PIPELINE
// ─────────────────────────────────────────────────────────────────────────────────

export interface PipelineContext {
  readonly requestId?: string;
  readonly userId?: string;
  readonly sessionId?: string;
  readonly conversationId?: string;
  readonly message?: string;
  readonly conversationHistory?: readonly ConversationMessage[];
  readonly userPreferences?: Readonly<Record<string, unknown>>;
  ackTokenValid?: boolean;
  readonly ackToken?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly timezone?: string;
  readonly locale?: string;
  readonly requestedStance?: Stance;
  readonly actionSource?: ActionSource;
  readonly actionSources?: ActionSource[];
  timestamp?: string | number;
}

export interface PipelineState {
  userMessage: string;
  normalizedInput: string;
  gateResults: GateResults;
  flags: Record<string, unknown>;
  timestamps: { pipelineStart: number; [key: string]: number };
  intent_summary?: IntentSummary;
  shieldResult?: ShieldGateOutput;
  toolsResult?: ToolsGateOutput;
  stanceResult?: StanceGateOutput;
  capabilityResult?: CapabilityGateOutput;
  generation?: Generation;
  validatedOutput?: ValidatedOutput;
  stance?: Stance;
}

export type PipelineStatus = 'success' | 'stopped' | 'await_ack' | 'degraded' | 'error' | 'redirect';

export interface PipelineResult {
  readonly status: PipelineStatus;
  readonly response: string;
  readonly stance?: Stance;
  readonly gateResults: GateResults;
  readonly ackToken?: string;
  readonly ackMessage?: string;
  
  /** Present when status='redirect' - frontend should navigate to SwordGate */
  readonly redirect?: SwordRedirect;
  
  readonly metadata: {
    readonly requestId?: string;
    readonly totalTimeMs: number;
    readonly regenerations?: number;
    readonly degradationReason?: string;
    readonly error?: string;
  };
}
