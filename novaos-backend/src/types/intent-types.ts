// ═══════════════════════════════════════════════════════════════════════════════
// INTENT CLASSIFICATION TYPES — LLM-Powered Intent Gate
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// CORE ENUMS
// ─────────────────────────────────────────────────────────────────────────────────

export type IntentType =
  | 'question'
  | 'decision'
  | 'action'
  | 'planning'
  | 'venting'
  | 'greeting'
  | 'followup'
  | 'clarification';

export type Domain =
  | 'general'
  | 'health'
  | 'mental_health'
  | 'finance'
  | 'legal'
  | 'career'
  | 'education'
  | 'relationships'
  | 'technical'
  | 'creative';

export type Complexity = 'simple' | 'medium' | 'complex';

export type Urgency = 'low' | 'medium' | 'high';

export type SafetySignal = 'none' | 'watch' | 'high';

export type ReasoningCode =
  | 'INFO_SEEKING'
  | 'DECISION_SUPPORT'
  | 'ACTION_INTENT'
  | 'PLANNING_REQUEST'
  | 'EMOTIONAL_EXPRESSION'
  | 'SOCIAL_GREETING'
  | 'CONTEXT_CONTINUATION'
  | 'REPAIR_REQUEST'
  | 'MULTI_INTENT';

// ─────────────────────────────────────────────────────────────────────────────────
// INTENT CLASSIFICATION OUTPUT
// ─────────────────────────────────────────────────────────────────────────────────

export interface IntentClassification {
  type: IntentType;
  primaryDomain: Domain;
  domains: Domain[];
  complexity: Complexity;
  urgency: Urgency;
  safetySignal: SafetySignal;
  confidence: number;
  reasoningCode: ReasoningCode;
  secondaryType?: IntentType;
}

// ─────────────────────────────────────────────────────────────────────────────────
// TELEMETRY (logged separately, not in output)
// ─────────────────────────────────────────────────────────────────────────────────

export interface IntentTelemetry {
  schemaVersion: '1.0';
  latencyMs: number;
  validationRepairs: string[];
  rawModelOutput?: unknown;
  failedOpen?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// DOMAIN PRIORITY ORDER (for stable sorting)
// ─────────────────────────────────────────────────────────────────────────────────

export const DOMAIN_PRIORITY: Domain[] = [
  'mental_health',
  'health',
  'legal',
  'finance',
  'career',
  'relationships',
  'education',
  'technical',
  'creative',
  'general',
];

// ─────────────────────────────────────────────────────────────────────────────────
// VALID ENUM SETS (for validation)
// ─────────────────────────────────────────────────────────────────────────────────

export const VALID_INTENT_TYPES: Set<IntentType> = new Set([
  'question',
  'decision',
  'action',
  'planning',
  'venting',
  'greeting',
  'followup',
  'clarification',
]);

export const VALID_DOMAINS: Set<Domain> = new Set([
  'general',
  'health',
  'mental_health',
  'finance',
  'legal',
  'career',
  'education',
  'relationships',
  'technical',
  'creative',
]);

export const VALID_COMPLEXITIES: Set<Complexity> = new Set([
  'simple',
  'medium',
  'complex',
]);

export const VALID_URGENCIES: Set<Urgency> = new Set([
  'low',
  'medium',
  'high',
]);

export const VALID_SAFETY_SIGNALS: Set<SafetySignal> = new Set([
  'none',
  'watch',
  'high',
]);

export const VALID_REASONING_CODES: Set<ReasoningCode> = new Set([
  'INFO_SEEKING',
  'DECISION_SUPPORT',
  'ACTION_INTENT',
  'PLANNING_REQUEST',
  'EMOTIONAL_EXPRESSION',
  'SOCIAL_GREETING',
  'CONTEXT_CONTINUATION',
  'REPAIR_REQUEST',
  'MULTI_INTENT',
]);

// ─────────────────────────────────────────────────────────────────────────────────
// HIGH-STAKES DOMAINS (for complexity floor enforcement)
// ─────────────────────────────────────────────────────────────────────────────────

export const HIGH_STAKES_DOMAINS: Set<Domain> = new Set([
  'mental_health',
  'health',
  'legal',
  'finance',
]);
