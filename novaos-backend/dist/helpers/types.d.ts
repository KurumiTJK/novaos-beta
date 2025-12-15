export declare const POLICY_VERSION = "4.0.0";
export declare const CAPABILITY_MATRIX_VERSION = "4.0.0";
export declare const CONSTRAINTS_VERSION = "4.0.0";
export declare const VERIFICATION_POLICY_VERSION = "4.0.0";
export declare const FRESHNESS_POLICY_VERSION = "4.0.0";
export type GateId = 'intent' | 'shield' | 'lens' | 'stance' | 'capability' | 'model' | 'personality' | 'spark';
export type Stance = 'control' | 'shield' | 'lens' | 'sword';
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'inference' | 'speculation';
export type StakesLevel = 'low' | 'medium' | 'high' | 'critical';
export type VetoType = 'soft' | 'hard';
export type InterventionLevel = 'none' | 'nudge' | 'friction' | 'veto';
export type GateAction = 'continue' | 'regenerate' | 'degrade' | 'stop' | 'await_ack';
export type GateStatus = 'pass' | 'soft_fail' | 'hard_fail';
export type ActionSource = 'ui_button' | 'command_parser' | 'api_field';
export type ActionType = 'set_reminder' | 'create_path' | 'generate_spark' | 'search_web' | 'end_conversation' | 'override_veto';
export type ControlTrigger = 'crisis_detected' | 'legal_boundary' | 'self_harm_risk' | 'external_threat' | 'user_requested';
export type VerificationMode = 'web' | 'internal' | 'degraded' | 'blocked' | 'none' | 'stopped' | 'verified' | 'skipped';
export type VerificationStatus = 'pending' | 'complete' | 'partial' | 'skipped' | 'failed' | 'not_required' | 'unavailable';
export type SparkIneligibilityReason = 'high_stakes_decision' | 'information_incomplete' | 'user_declined_activation' | 'rate_limit_reached' | 'recent_spark_ignored' | 'control_mode_active' | 'shield_intervention_active' | 'not_sword_stance';
export interface UserInput {
    userId: string;
    sessionId: string;
    message: string;
    requestedActions?: RequestedAction[];
    ackToken?: string;
    ackText?: string;
    intentHints?: IntentHint[];
}
export interface RequestedAction {
    type: ActionType;
    params: Record<string, unknown>;
    source: ActionSource;
}
export interface IntentHint {
    type: string;
    confidence: number;
}
export interface Intent {
    type: 'question' | 'action' | 'planning' | 'rewrite' | 'summarize' | 'translate' | 'conversation';
    complexity: 'low' | 'medium' | 'high';
    isHypothetical: boolean;
    domains: string[];
}
export interface RiskSummary {
    interventionLevel: InterventionLevel;
    vetoType?: VetoType;
    stakesLevel: StakesLevel;
    reason: string;
    auditId: string;
    controlTrigger?: ControlTrigger;
    requiredPrependResources?: boolean;
    crisisResources?: CrisisResource[];
    pendingAck?: PendingAcknowledgment;
    overrideApplied?: boolean;
}
export interface CrisisResource {
    name: string;
    action: string;
    phone?: string;
    url?: string;
    available?: string;
}
export interface PendingAcknowledgment {
    ackToken: string;
    requiredText: string;
    expiresAt: Date;
    auditId?: string;
}
export interface VerificationPlan {
    required: boolean;
    mode: VerificationMode;
    plan: VerificationPlanDetails | null;
    userOptions?: UserOption[];
}
export interface VerificationPlanDetails {
    verificationStatus: VerificationStatus;
    confidence: ConfidenceLevel;
    verified: boolean;
    freshnessWarning?: string;
    numericPrecisionAllowed: boolean;
    actionRecommendationsAllowed: boolean;
    sourcesToCheck?: string[];
    triggers?: string[];
    citations?: Citation[];
    domain?: string;
}
export interface Citation {
    url: string;
    title: string;
    domain: string;
    excerpt?: string;
    trustScore?: number;
}
export interface UserOption {
    id: string;
    label: string;
    requiresAck?: boolean;
}
export interface CapabilityCheckResult {
    allowed: RequestedAction[];
    violations: CapabilityViolation[];
}
export interface CapabilityViolation {
    action: ActionType;
    stance: Stance;
    reason: string;
    preconditionFailed?: string;
}
export interface GenerationResult {
    text: string;
    model: string;
    tokensUsed: number;
    constraints: GenerationConstraints;
    fallbackUsed?: boolean;
}
export interface ValidatedOutput {
    text: string;
    violations: LinguisticViolation[];
    edited: boolean;
    edits?: Edit[];
    regenerationConstraints?: GenerationConstraints;
}
export interface LinguisticViolation {
    type: string;
    phrase: string;
    severity: 'low' | 'medium' | 'high';
    canSurgicalEdit: boolean;
}
export interface Edit {
    original: string;
    replacement: string;
    reason: string;
}
export interface SparkDecision {
    spark: Spark | null;
    reason: SparkIneligibilityReason | null;
}
export interface Spark {
    action: string;
    duration: string;
    frictionLevel?: number;
    prerequisites?: string[];
}
export interface PipelineState {
    input: UserInput;
    intent?: Intent;
    risk?: RiskSummary;
    verification?: VerificationPlan;
    stance?: Stance;
    capabilities?: CapabilityCheckResult;
    generation?: GenerationResult;
    validated?: ValidatedOutput;
    spark?: SparkDecision;
    pendingAck?: PendingAcknowledgment;
    injections?: Injection[];
    regenerationCount: number;
    degraded: boolean;
    stoppedAt?: GateId;
    stoppedReason?: string;
    crisisResourcesProvided?: boolean;
    sessionEnded?: boolean;
}
export interface Injection {
    type: string;
    content: string;
    position: 'prepend' | 'append';
}
export interface GateResult<T> {
    gateId: GateId;
    status: GateStatus;
    output: T;
    action: GateAction;
    failureReason?: string;
    executionTimeMs: number;
}
export type GateResults = Partial<Record<GateId, GateResult<unknown>>>;
export interface PipelineContext {
    requestId: string;
    userId: string;
    policyVersion: string;
    capabilityMatrixVersion: string;
    constraintsVersion: string;
    verificationPolicyVersion: string;
    freshnessPolicyVersion: string;
}
export interface PipelineResult {
    success: boolean;
    message: string;
    stance?: Stance;
    confidence?: ConfidenceLevel;
    verified?: boolean;
    freshnessWarning?: string;
    spark?: Spark;
    transparency?: TransparencyInfo;
    pendingAck?: PendingAcknowledgment;
    userOptions?: UserOption[];
    stopped?: boolean;
    stoppedAt?: GateId;
    stoppedReason?: string;
    debug?: DebugInfo;
    crisisResourcesProvided?: boolean;
    auditId?: string;
}
export interface TransparencyInfo {
    modelUsed: string;
    fallbackUsed: boolean;
    verificationStatus: VerificationStatus;
    regenerationCount: number;
    degraded: boolean;
    violations: LinguisticViolation[];
    degradeReason?: string;
}
export interface DebugInfo {
    gates: GateDebugInfo[];
    policyVersions: Record<string, string>;
    totalLatencyMs: number;
}
export interface GateDebugInfo {
    gateId: GateId;
    status: GateStatus;
    action: GateAction;
    executionTimeMs: number;
}
export interface GenerationConstraints {
    bannedPhrases: string[];
    maxWe: number;
    tone: 'neutral' | 'direct' | 'warm';
    numericPrecisionAllowed: boolean;
    actionRecommendationsAllowed: boolean;
    mustInclude?: string[];
    mustNotInclude?: string[];
    mustPrepend?: string;
}
export type VerificationTrigger = 'temporal_claim' | 'health_claim' | 'legal_claim' | 'financial_claim' | 'numeric_claim' | 'public_figure_claim' | string;
export interface VerificationTriggerConfig {
    type: string;
    patterns?: RegExp[];
    domains?: string[];
    required: boolean;
}
export interface FreshnessWindow {
    domain: string;
    maxAgeMs: number | null;
    staleness: 'immediate' | 'hours' | 'days' | 'weeks' | 'months' | 'years' | 'never';
}
export type Capability = 'give_advice' | 'generate_spark' | 'ask_followup' | 'block_action' | 'verify_information' | 'access_web' | 'set_reminder' | 'access_memory' | 'provide_resources' | 'end_conversation';
export type CapabilityLevel = 'allowed' | 'limited' | 'blocked' | 'required';
export interface CapabilityRule {
    level: CapabilityLevel;
    precondition?: string;
    timing?: 'before_end' | 'immediate' | 'any';
}
export type CapabilityMatrix = Record<Stance, Record<Capability, CapabilityRule>>;
export type MemorySource = 'behavioral' | 'inferred' | 'user_stated' | 'user_confirmed';
export type MemoryType = 'preferences' | 'communicationStyle' | 'expertise' | 'goals' | 'constraints';
export interface MemoryEntry<T> {
    value: T;
    confidence: MemoryConfidence;
    source: MemorySource;
    locked: boolean;
    lockOffered?: boolean;
}
export interface MemoryConfidence {
    strength: number;
    observations: number;
    lastObserved: Date;
    firstObserved: Date;
    decayRate: 'stable' | 'moderate' | 'fast';
    reinforcementLog: ReinforcementLogEntry[];
}
export interface ReinforcementLogEntry {
    date: string;
    source: MemorySource;
    delta: number;
}
export interface Reminder {
    id: string;
    userId: string;
    title: string;
    body?: string;
    triggerAt: Date;
    repeatPattern?: string;
    status: ReminderStatus;
}
export type ReminderStatus = 'pending' | 'delivered_to_device' | 'delivery_unconfirmed' | 'failed' | 'seen' | 'actioned';
export interface ReminderDelivery {
    reminderId: string;
    providerStatus: 'accepted' | 'rejected' | 'unknown';
    providerResponseAt?: Date;
    deviceDeliveryStatus: 'delivered' | 'unconfirmed' | 'failed';
    deviceDeliveryAt?: Date;
    userInteraction?: {
        type: 'seen' | 'tapped' | 'snoozed' | 'dismissed';
        at: Date;
    };
    status: ReminderStatus;
}
export interface ResponseAudit {
    requestId: string;
    userId: string;
    timestamp: Date;
    policyVersion: string;
    capabilityMatrixVersion: string;
    constraintsVersion: string;
    verificationPolicyVersion: string;
    freshnessPolicyVersion: string;
    inputHash: string;
    outputHash: string;
    snapshotStorageRef?: string;
    snapshotEncrypted: boolean;
    snapshotKeyVersion?: string;
    redactionApplied: boolean;
    redactedPatterns?: string[];
    gatesExecuted: GateAuditEntry[];
    stance: Stance;
    model: string;
    interventionApplied?: RiskSummary;
    ackOverrideApplied: boolean;
    responseGenerated: boolean;
    regenerationCount: number;
    degradationApplied: boolean;
    stoppedAt?: GateId;
    stoppedReason?: string;
    trustViolations: TrustViolation[];
    linguisticViolations: LinguisticViolation[];
}
export interface GateAuditEntry {
    gateId: GateId;
    status: GateStatus;
    action: GateAction;
    executionTimeMs: number;
    metadata?: Record<string, unknown>;
}
export interface TrustViolation {
    type: 'confidence_miscalibration' | 'unverified_as_verified' | 'stale_data' | 'model_hallucination';
    severity: 'low' | 'medium' | 'high';
    description: string;
    correctionApplied: boolean;
}
export interface InvariantResponse {
    text?: string;
}
export interface Invariant {
    id: string;
    description: string;
    test: (state: PipelineState, results: GateResults, response?: InvariantResponse) => boolean;
    critical?: boolean;
}
export interface InvariantResult {
    invariantId: string;
    description: string;
    passed: boolean;
}
export interface ChatRequest {
    sessionId: string;
    message: string;
    requestedActions?: Array<{
        type: ActionType;
        params: Record<string, unknown>;
    }>;
    ackToken?: string;
    ackText?: string;
    intentHints?: IntentHint[];
}
export interface ChatResponse {
    type: 'success' | 'await_ack' | 'stopped';
    message?: string;
    stance?: Stance;
    confidence?: ConfidenceLevel;
    verified?: boolean;
    freshnessWarning?: string;
    spark?: Spark;
    transparency?: TransparencyInfo;
    ackRequired?: {
        token: string;
        requiredText: string;
        expiresAt: Date;
    };
    reason?: string;
    userOptions?: UserOption[];
    debug?: DebugInfo;
}
export declare const GATE_ORDER: GateId[];
export declare const REGENERATION_GATES: GateId[];
export declare const IMMEDIATE_DOMAINS: string[];
export declare const CRISIS_RESOURCES: CrisisResource[];
export declare const HARD_VETO_TRIGGERS: string[];
export declare const SOFT_VETO_TRIGGERS: string[];
//# sourceMappingURL=types.d.ts.map