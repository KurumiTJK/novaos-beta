"use strict";
// ═══════════════════════════════════════════════════════════════════════════════
// CAPABILITY GATE — Capability Matrix Enforcement
// NO natural-language action inference - only explicit sources
// ═══════════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.CapabilityGate = void 0;
exports.isActionAllowed = isActionAllowed;
exports.getCapabilityLevel = getCapabilityLevel;
const precondition_checker_js_1 = require("../helpers/precondition-checker.js");
// ─────────────────────────────────────────────────────────────────────────────────
// CAPABILITY MATRIX
// Defines what actions are allowed in each stance
// ─────────────────────────────────────────────────────────────────────────────────
const CAPABILITY_MATRIX = {
    // CONTROL — Crisis/safety mode
    control: {
        set_reminder: { level: 'blocked' },
        create_path: { level: 'blocked' },
        generate_spark: { level: 'blocked' },
        search_web: { level: 'limited', precondition: 'resources_provided' },
        end_conversation: { level: 'limited', precondition: 'resources_provided', timing: 'before_end' },
        override_veto: { level: 'blocked' },
    },
    // SHIELD — Protection mode
    shield: {
        set_reminder: { level: 'limited' },
        create_path: { level: 'blocked' },
        generate_spark: { level: 'blocked' },
        search_web: { level: 'allowed' },
        end_conversation: { level: 'allowed' },
        override_veto: { level: 'allowed' }, // Can override soft veto
    },
    // LENS — Clarity mode
    lens: {
        set_reminder: { level: 'allowed' },
        create_path: { level: 'limited' },
        generate_spark: { level: 'blocked' },
        search_web: { level: 'allowed' },
        end_conversation: { level: 'allowed' },
        override_veto: { level: 'allowed' },
    },
    // SWORD — Action mode
    sword: {
        set_reminder: { level: 'allowed' },
        create_path: { level: 'allowed' },
        generate_spark: { level: 'allowed' }, // Only in sword stance
        search_web: { level: 'allowed' },
        end_conversation: { level: 'allowed' },
        override_veto: { level: 'allowed' },
    },
};
// ─────────────────────────────────────────────────────────────────────────────────
// CAPABILITY GATE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────────
class CapabilityGate {
    gateId = 'capability';
    async execute(state, context) {
        const start = Date.now();
        const { input, stance, risk } = state;
        try {
            // ─────────────────────────────────────────────────────────────────────────
            // Step 1: Get EXPLICIT actions only - NO NL inference
            // ─────────────────────────────────────────────────────────────────────────
            const requestedActions = this.getExplicitActions(input);
            // No actions requested - pass through
            if (requestedActions.length === 0) {
                return {
                    gateId: this.gateId,
                    status: 'pass',
                    output: { allowed: [], violations: [] },
                    action: 'continue',
                    executionTimeMs: Date.now() - start,
                };
            }
            // ─────────────────────────────────────────────────────────────────────────
            // Step 2: Check each action against capability matrix
            // ─────────────────────────────────────────────────────────────────────────
            const violations = [];
            const allowed = [];
            const currentStance = stance ?? 'lens'; // Default to lens if not set
            for (const action of requestedActions) {
                const rule = CAPABILITY_MATRIX[currentStance]?.[action.type];
                // No rule or blocked
                if (!rule || rule.level === 'blocked') {
                    violations.push({
                        action: action.type,
                        stance: currentStance,
                        reason: `Action '${action.type}' is blocked in ${currentStance} stance`,
                    });
                    continue;
                }
                // Check preconditions
                if (rule.precondition) {
                    const met = (0, precondition_checker_js_1.checkPrecondition)(rule.precondition, state);
                    if (!met) {
                        violations.push({
                            action: action.type,
                            stance: currentStance,
                            reason: `Precondition '${rule.precondition}' not met for '${action.type}'`,
                            preconditionFailed: rule.precondition,
                        });
                        continue;
                    }
                }
                // Action allowed
                allowed.push(action);
            }
            // ─────────────────────────────────────────────────────────────────────────
            // Step 3: Determine result based on violations
            // ─────────────────────────────────────────────────────────────────────────
            // Hard fail if blocked capabilities requested (not just precondition failures)
            const blockedViolations = violations.filter(v => !v.preconditionFailed);
            if (blockedViolations.length > 0) {
                return {
                    gateId: this.gateId,
                    status: 'hard_fail',
                    output: { allowed: [], violations },
                    action: 'stop',
                    failureReason: blockedViolations.map(v => v.reason).join('; '),
                    executionTimeMs: Date.now() - start,
                };
            }
            // Soft fail if preconditions not met (continue but action won't execute)
            if (violations.length > 0) {
                return {
                    gateId: this.gateId,
                    status: 'soft_fail',
                    output: { allowed, violations },
                    action: 'continue',
                    failureReason: violations.map(v => v.reason).join('; '),
                    executionTimeMs: Date.now() - start,
                };
            }
            // All actions allowed
            return {
                gateId: this.gateId,
                status: 'pass',
                output: { allowed, violations: [] },
                action: 'continue',
                executionTimeMs: Date.now() - start,
            };
        }
        catch (error) {
            console.error('[CAPABILITY] Error checking capabilities:', error);
            // Fail safe - block all actions
            return {
                gateId: this.gateId,
                status: 'hard_fail',
                output: { allowed: [], violations: [] },
                action: 'stop',
                failureReason: 'Capability check failed',
                executionTimeMs: Date.now() - start,
            };
        }
    }
    /**
     * Get actions from EXPLICIT sources only.
     * SECURITY: NEVER infer actions from natural language.
     */
    getExplicitActions(input) {
        const validSources = ['ui_button', 'command_parser', 'api_field'];
        return (input.requestedActions || []).filter((a) => validSources.includes(a.source));
    }
}
exports.CapabilityGate = CapabilityGate;
// ─────────────────────────────────────────────────────────────────────────────────
// CAPABILITY UTILITIES
// ─────────────────────────────────────────────────────────────────────────────────
/**
 * Check if an action is allowed in a given stance.
 */
function isActionAllowed(action, stance) {
    const rule = CAPABILITY_MATRIX[stance]?.[action];
    return rule?.level === 'allowed' || rule?.level === 'limited';
}
/**
 * Get the capability level for an action in a stance.
 */
function getCapabilityLevel(action, stance) {
    return CAPABILITY_MATRIX[stance]?.[action]?.level ?? null;
}
//# sourceMappingURL=capability-gate.js.map