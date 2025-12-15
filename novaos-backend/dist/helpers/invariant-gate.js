"use strict";
// ═══════════════════════════════════════════════════════════════════════════════
// INVARIANT GATE — Fix C-2
// Enforces invariants BEFORE response is sent (not after)
// Critical invariant violations STOP the pipeline
// ═══════════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENFORCED_INVARIANTS = exports.InvariantGate = void 0;
exports.checkAllInvariants = checkAllInvariants;
const safety_renderer_1 = require("./safety-renderer");
const freshness_checker_1 = require("./freshness-checker");
const ENFORCED_INVARIANTS = [
    // ─────────────────────────────────────────────────────────────────────────
    // CRITICAL INVARIANTS — Violation stops pipeline
    // ─────────────────────────────────────────────────────────────────────────
    {
        id: 'hard_veto_stops',
        description: 'If hard veto triggered, pipeline must have stopped at shield',
        critical: true,
        test: (state, results) => {
            const shield = results.shield?.output;
            if (shield?.interventionLevel === 'veto' && shield?.vetoType === 'hard') {
                // This invariant should never fire in InvariantGate because
                // hard veto stops at ShieldGate. If we reach here, something is wrong.
                return state.stoppedAt === 'shield';
            }
            return true;
        },
    },
    {
        id: 'control_resources',
        description: 'If control trigger fired, crisis resources must be in output',
        critical: true,
        test: (state, results, response) => {
            const shield = results.shield?.output;
            if (shield?.controlTrigger || shield?.requiredPrependResources) {
                // Response text must contain crisis resources
                if (!response?.text)
                    return false;
                return (0, safety_renderer_1.verifyCrisisResourcesPresent)(response.text);
            }
            return true;
        },
    },
    {
        id: 'soft_veto_requires_ack',
        description: 'Soft veto without ackToken must await acknowledgment',
        critical: true,
        test: (state, results) => {
            const shield = results.shield?.output;
            if (shield?.interventionLevel === 'veto' && shield?.vetoType === 'soft') {
                // If no ackToken provided, action must be await_ack
                if (!state.input.ackToken) {
                    return results.shield?.action === 'await_ack';
                }
                // If ackToken provided, override must be applied
                return shield.overrideApplied === true;
            }
            return true;
        },
    },
    // ─────────────────────────────────────────────────────────────────────────
    // HIGH INVARIANTS — Violation degrades response
    // ─────────────────────────────────────────────────────────────────────────
    {
        id: 'sword_only_spark',
        description: 'Spark can only be generated in sword stance',
        critical: false,
        test: (state, results) => {
            if (state.stance !== 'sword') {
                const spark = results.spark?.output;
                // Spark must be null if not in sword stance
                return spark?.spark === null || spark?.spark === undefined;
            }
            return true;
        },
    },
    {
        id: 'lens_degradation',
        description: 'If verification required but unavailable, must degrade',
        critical: false,
        test: (state, results) => {
            const lens = results.lens?.output;
            if (lens?.required && lens?.mode === 'degraded') {
                // Must have low confidence and verified=false
                return lens.plan?.confidence === 'low' && lens.plan?.verified === false;
            }
            return true;
        },
    },
    {
        id: 'regeneration_limit',
        description: 'Regeneration count must not exceed 2',
        critical: false,
        test: (state) => {
            return state.regenerationCount <= 2;
        },
    },
    {
        id: 'no_nl_actions',
        description: 'Actions must come from explicit sources only',
        critical: true, // SECURITY: Must stop on invalid action source
        test: (state) => {
            const actions = state.input.requestedActions || [];
            const validSources = ['ui_button', 'command_parser', 'api_field'];
            return actions.every(a => validSources.includes(a.source));
        },
    },
    {
        id: 'immediate_domain_numerics',
        description: 'Unverified immediate domain must not have precise numbers',
        critical: false,
        test: (state, results, response) => {
            const lens = results.lens?.output;
            // Only applies if verification was required but skipped/degraded
            if (lens?.required &&
                (lens?.plan?.verificationStatus === 'skipped' || lens?.mode === 'degraded')) {
                // Use unified domain detection from freshness-checker
                const domain = (0, freshness_checker_1.detectDomain)(state.input.message);
                if ((0, freshness_checker_1.isImmediateDomain)(domain) && response?.text) {
                    // Should not contain precise financial numbers
                    const hasPreciseNumbers = /\$[\d,]+\.\d{2}|\b\d+\.\d{2}%|\b\d{1,3}(?:,\d{3})+\.\d{2}\b/.test(response.text);
                    return !hasPreciseNumbers;
                }
            }
            return true;
        },
    },
    {
        id: 'confidence_verification_alignment',
        description: 'High confidence requires verification',
        critical: false,
        test: (state, results) => {
            const lens = results.lens?.output;
            if (lens?.plan?.confidence === 'high') {
                // High confidence should only be assigned if verified
                return lens.plan?.verified === true;
            }
            return true;
        },
    },
];
exports.ENFORCED_INVARIANTS = ENFORCED_INVARIANTS;
/**
 * Invariant Gate — runs AFTER SparkGate, BEFORE response is sent.
 *
 * Critical violations: STOP pipeline, return error
 * Non-critical violations: LOG and continue (maybe degrade)
 */
class InvariantGate {
    gateId = 'invariant';
    async execute(input, context) {
        const start = Date.now();
        const { state, results, responseText } = input;
        const response = { text: responseText };
        const allViolations = [];
        const criticalViolations = [];
        const nonCriticalViolations = [];
        // Check all invariants
        for (const invariant of ENFORCED_INVARIANTS) {
            try {
                const passed = invariant.test(state, results, response);
                if (!passed) {
                    const violation = {
                        invariantId: invariant.id,
                        description: invariant.description,
                        passed: false,
                    };
                    allViolations.push(violation);
                    if (invariant.critical) {
                        criticalViolations.push(violation);
                    }
                    else {
                        nonCriticalViolations.push(violation);
                    }
                }
            }
            catch (error) {
                // Invariant check threw — treat as violation
                console.error(`[INVARIANT] Check failed for ${invariant.id}:`, error);
                const violation = {
                    invariantId: invariant.id,
                    description: `${invariant.description} (check error)`,
                    passed: false,
                };
                allViolations.push(violation);
                if (invariant.critical) {
                    criticalViolations.push(violation);
                }
            }
        }
        // Determine action based on violations
        if (criticalViolations.length > 0) {
            // CRITICAL: Stop pipeline
            return {
                gateId: this.gateId,
                status: 'hard_fail',
                output: {
                    violations: allViolations,
                    criticalViolations,
                    nonCriticalViolations,
                },
                action: 'stop',
                failureReason: `Critical invariant violation: ${criticalViolations.map(v => v.invariantId).join(', ')}`,
                executionTimeMs: Date.now() - start,
            };
        }
        if (nonCriticalViolations.length > 0) {
            // NON-CRITICAL: Log and continue (could degrade)
            console.warn(`[INVARIANT] Non-critical violations: ${nonCriticalViolations.map(v => v.invariantId).join(', ')}`);
            return {
                gateId: this.gateId,
                status: 'soft_fail',
                output: {
                    violations: allViolations,
                    criticalViolations: [],
                    nonCriticalViolations,
                },
                action: 'continue',
                failureReason: `Non-critical violations: ${nonCriticalViolations.map(v => v.invariantId).join(', ')}`,
                executionTimeMs: Date.now() - start,
            };
        }
        // All invariants passed
        return {
            gateId: this.gateId,
            status: 'pass',
            output: {
                violations: [],
                criticalViolations: [],
                nonCriticalViolations: [],
            },
            action: 'continue',
            executionTimeMs: Date.now() - start,
        };
    }
}
exports.InvariantGate = InvariantGate;
// ─────────────────────────────────────────────────────────────────────────────────
// HELPER: Check all invariants (for testing)
// ─────────────────────────────────────────────────────────────────────────────────
function checkAllInvariants(state, results, response) {
    const violations = [];
    for (const invariant of ENFORCED_INVARIANTS) {
        try {
            const passed = invariant.test(state, results, response);
            if (!passed) {
                violations.push({
                    invariantId: invariant.id,
                    description: invariant.description,
                    passed: false,
                });
            }
        }
        catch {
            violations.push({
                invariantId: invariant.id,
                description: `${invariant.description} (check error)`,
                passed: false,
            });
        }
    }
    return violations;
}
//# sourceMappingURL=invariant-gate.js.map