"use strict";
// ═══════════════════════════════════════════════════════════════════════════════
// SHIELD GATE — Risk Assessment & Veto Logic
// Implements soft/hard veto semantics with ack token handshake
// ═══════════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShieldGate = void 0;
const crypto_1 = require("crypto");
const types_js_1 = require("../helpers/types.js");
const ack_token_js_1 = require("../helpers/ack-token.js");
// ─────────────────────────────────────────────────────────────────────────────────
// CONTROL MODE TRIGGERS
// ─────────────────────────────────────────────────────────────────────────────────
const CONTROL_PATTERNS = [
    // Self-harm / crisis
    { pattern: /\b(kill myself|suicide|end my life|want to die|hurt myself|self[- ]?harm)\b/i, trigger: 'crisis_detected' },
    { pattern: /\b(suicidal|no reason to live|better off dead)\b/i, trigger: 'self_harm_risk' },
    // Legal boundaries
    { pattern: /\b(how to (murder|kill someone|make a bomb|create poison))\b/i, trigger: 'legal_boundary' },
    // External threat
    { pattern: /\b(i('m|'ve been)? being (stalked|followed|threatened|abused))\b/i, trigger: 'external_threat' },
];
// ─────────────────────────────────────────────────────────────────────────────────
// HARD VETO PATTERNS
// ─────────────────────────────────────────────────────────────────────────────────
const HARD_VETO_PATTERNS = [
    { pattern: /\b(make|create|build)\s+(a\s+)?(bomb|explosive|weapon)\b/i, reason: 'weapons_creation' },
    { pattern: /\b(child|minor|underage)\s*(porn|sex|abuse|exploit)\b/i, reason: 'child_safety' },
    { pattern: /\b(how to)\s+(hack|break into|steal from)\b/i, reason: 'illegal_content' },
    { pattern: /\b(murder|assassinate|kill)\s+(someone|a person|my)\b/i, reason: 'violence_promotion' },
];
// ─────────────────────────────────────────────────────────────────────────────────
// SOFT VETO PATTERNS (require acknowledgment)
// ─────────────────────────────────────────────────────────────────────────────────
const SOFT_VETO_PATTERNS = [
    // High financial risk
    { pattern: /\b(put|invest)\s+(all|everything|my life savings)\b/i, reason: 'high_financial_risk', stakes: 'high' },
    { pattern: /\b(borrow|loan|leverage)\s+(heavily|maximum|everything)\b/i, reason: 'high_financial_risk', stakes: 'high' },
    // Health decisions
    { pattern: /\b(stop taking|quit)\s+(my\s+)?(medication|medicine|prescription)\b/i, reason: 'health_decision_without_professional', stakes: 'critical' },
    { pattern: /\b(don't need|stopping)\s+(my\s+)?(therapy|treatment|doctor)\b/i, reason: 'health_decision_without_professional', stakes: 'high' },
    // Legal actions
    { pattern: /\b(sue|file (a\s+)?lawsuit|take legal action)\s+(without|before)\s+(a\s+)?lawyer\b/i, reason: 'legal_action_without_counsel', stakes: 'high' },
    // Irreversible decisions
    { pattern: /\b(quit my job|resign|leave my job)\s+(today|immediately|right now)\b/i, reason: 'irreversible_decision', stakes: 'high' },
    { pattern: /\b(divorce|end my marriage|break up)\s+(today|immediately|right now)\b/i, reason: 'irreversible_decision', stakes: 'high' },
];
// ─────────────────────────────────────────────────────────────────────────────────
// SHIELD GATE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────────
class ShieldGate {
    nonceStore;
    ackTokenSecret;
    gateId = 'shield';
    constructor(nonceStore, ackTokenSecret) {
        this.nonceStore = nonceStore;
        this.ackTokenSecret = ackTokenSecret;
    }
    async execute(state, context) {
        const start = Date.now();
        const { input, intent } = state;
        const auditId = `audit_${(0, crypto_1.randomUUID)().slice(0, 8)}`;
        try {
            // ─────────────────────────────────────────────────────────────────────────
            // Step 1: Check for pending acknowledgment token
            // ─────────────────────────────────────────────────────────────────────────
            if (input.ackToken && input.ackText) {
                const validation = await (0, ack_token_js_1.validateAckToken)(input.ackToken, input, input.ackText, ack_token_js_1.ACK_REQUIRED_TEXT, this.ackTokenSecret, this.nonceStore);
                if (validation.valid) {
                    // Acknowledgment valid - proceed with logged override
                    console.log(`[SHIELD] Ack token validated for request ${context.requestId}`);
                    return {
                        gateId: this.gateId,
                        status: 'pass',
                        output: {
                            interventionLevel: 'none',
                            vetoType: undefined,
                            stakesLevel: 'low',
                            reason: 'User acknowledged and proceeded',
                            auditId,
                            overrideApplied: true,
                        },
                        action: 'continue',
                        executionTimeMs: Date.now() - start,
                    };
                }
                else {
                    console.warn(`[SHIELD] Invalid ack token: ${validation.reason}`);
                    // Fall through to normal risk assessment
                }
            }
            // ─────────────────────────────────────────────────────────────────────────
            // Step 2: Check for Control Mode triggers (highest priority)
            // ─────────────────────────────────────────────────────────────────────────
            const controlTrigger = this.detectControlTrigger(input.message);
            if (controlTrigger) {
                return {
                    gateId: this.gateId,
                    status: 'soft_fail',
                    output: {
                        interventionLevel: 'friction',
                        vetoType: undefined,
                        stakesLevel: 'critical',
                        reason: `Control mode: ${controlTrigger}`,
                        auditId,
                        controlTrigger,
                        requiredPrependResources: true,
                        crisisResources: types_js_1.CRISIS_RESOURCES,
                    },
                    action: 'continue', // Continue but with resources prepended
                    failureReason: `Control mode triggered: ${controlTrigger}`,
                    executionTimeMs: Date.now() - start,
                };
            }
            // ─────────────────────────────────────────────────────────────────────────
            // Step 3: Check for Hard Veto (pipeline stops)
            // ─────────────────────────────────────────────────────────────────────────
            const hardVeto = this.detectHardVeto(input.message);
            if (hardVeto) {
                return {
                    gateId: this.gateId,
                    status: 'hard_fail',
                    output: {
                        interventionLevel: 'veto',
                        vetoType: 'hard',
                        stakesLevel: 'critical',
                        reason: hardVeto.reason,
                        auditId,
                    },
                    action: 'stop',
                    failureReason: `Hard veto: ${hardVeto.reason}`,
                    executionTimeMs: Date.now() - start,
                };
            }
            // ─────────────────────────────────────────────────────────────────────────
            // Step 4: Check for Soft Veto (requires acknowledgment)
            // ─────────────────────────────────────────────────────────────────────────
            const softVeto = this.detectSoftVeto(input.message);
            if (softVeto) {
                // Generate ack token
                const { token, payload } = (0, ack_token_js_1.generateAckToken)(input, softVeto.reason, auditId, this.ackTokenSecret);
                const pendingAck = {
                    ackToken: token,
                    requiredText: ack_token_js_1.ACK_REQUIRED_TEXT,
                    expiresAt: new Date(payload.expiresAt),
                    auditId,
                };
                return {
                    gateId: this.gateId,
                    status: 'soft_fail',
                    output: {
                        interventionLevel: 'veto',
                        vetoType: 'soft',
                        stakesLevel: softVeto.stakes,
                        reason: softVeto.reason,
                        auditId,
                        pendingAck,
                    },
                    action: 'await_ack',
                    failureReason: `Soft veto requires acknowledgment: ${softVeto.reason}`,
                    executionTimeMs: Date.now() - start,
                };
            }
            // ─────────────────────────────────────────────────────────────────────────
            // Step 5: Assess general risk level
            // ─────────────────────────────────────────────────────────────────────────
            const risk = this.assessRisk(input.message, intent);
            return {
                gateId: this.gateId,
                status: risk.interventionLevel !== 'none' ? 'soft_fail' : 'pass',
                output: risk,
                action: 'continue',
                executionTimeMs: Date.now() - start,
            };
        }
        catch (error) {
            console.error('[SHIELD] Error during risk assessment:', error);
            // Fail safe - treat as high risk
            return {
                gateId: this.gateId,
                status: 'hard_fail',
                output: {
                    interventionLevel: 'veto',
                    vetoType: 'hard',
                    stakesLevel: 'critical',
                    reason: 'Risk assessment failed',
                    auditId,
                },
                action: 'stop',
                failureReason: 'Risk assessment error - failing safe',
                executionTimeMs: Date.now() - start,
            };
        }
    }
    /**
     * Detect Control Mode triggers.
     */
    detectControlTrigger(message) {
        for (const { pattern, trigger } of CONTROL_PATTERNS) {
            if (pattern.test(message)) {
                return trigger;
            }
        }
        return null;
    }
    /**
     * Detect Hard Veto patterns.
     */
    detectHardVeto(message) {
        for (const { pattern, reason } of HARD_VETO_PATTERNS) {
            if (pattern.test(message)) {
                return { reason };
            }
        }
        return null;
    }
    /**
     * Detect Soft Veto patterns.
     */
    detectSoftVeto(message) {
        for (const { pattern, reason, stakes } of SOFT_VETO_PATTERNS) {
            if (pattern.test(message)) {
                return { reason, stakes };
            }
        }
        return null;
    }
    /**
     * Assess general risk level.
     */
    assessRisk(message, intent) {
        let interventionLevel = 'none';
        let stakesLevel = 'low';
        // Domain-based risk assessment
        const domains = intent?.domains ?? [];
        const highStakesDomains = ['health', 'legal', 'finance', 'mental_health'];
        if (domains.some((d) => highStakesDomains.includes(d))) {
            stakesLevel = 'medium';
            interventionLevel = 'nudge';
        }
        // Action type risk
        if (intent?.type === 'action' && stakesLevel === 'medium') {
            stakesLevel = 'high';
            interventionLevel = 'friction';
        }
        return {
            interventionLevel,
            vetoType: undefined,
            stakesLevel,
            reason: interventionLevel === 'none' ? 'No significant risk detected' : `Risk assessment: ${stakesLevel} stakes`,
            auditId: `audit_${(0, crypto_1.randomUUID)().slice(0, 8)}`,
        };
    }
}
exports.ShieldGate = ShieldGate;
//# sourceMappingURL=shield-gate.js.map