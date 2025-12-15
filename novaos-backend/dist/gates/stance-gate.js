"use strict";
// ═══════════════════════════════════════════════════════════════════════════════
// STANCE GATE — Determines Operating Stance
// Implements stance priority: CONTROL > SHIELD > LENS > SWORD
// ═══════════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.StanceGate = void 0;
exports.compareStancePriority = compareStancePriority;
exports.getHigherPriorityStance = getHigherPriorityStance;
exports.isStanceAtLeast = isStanceAtLeast;
// ─────────────────────────────────────────────────────────────────────────────────
// STANCE PRIORITY ORDER
// When uncertain, default to highest-priority applicable stance
// ─────────────────────────────────────────────────────────────────────────────────
const STANCE_PRIORITY = ['control', 'shield', 'lens', 'sword'];
// ─────────────────────────────────────────────────────────────────────────────────
// STANCE GATE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────────
class StanceGate {
    gateId = 'stance';
    async execute(state, context) {
        const start = Date.now();
        const { intent, risk, verification } = state;
        try {
            const stance = this.determineStance(state);
            return {
                gateId: this.gateId,
                status: 'pass',
                output: stance,
                action: 'continue',
                executionTimeMs: Date.now() - start,
            };
        }
        catch (error) {
            console.error('[STANCE] Error determining stance:', error);
            // Default to shield stance on error (safer)
            return {
                gateId: this.gateId,
                status: 'soft_fail',
                output: 'shield',
                action: 'continue',
                failureReason: 'Stance determination failed, defaulting to shield',
                executionTimeMs: Date.now() - start,
            };
        }
    }
    /**
     * Determine the appropriate stance based on pipeline state.
     */
    determineStance(state) {
        const { intent, risk, verification } = state;
        // ─────────────────────────────────────────────────────────────────────────
        // 1. CONTROL STANCE — Crisis or safety situations
        // Highest priority - if any control trigger, use control stance
        // ─────────────────────────────────────────────────────────────────────────
        if (risk?.controlTrigger) {
            return 'control';
        }
        // Critical stakes always trigger control
        if (risk?.stakesLevel === 'critical') {
            return 'control';
        }
        // ─────────────────────────────────────────────────────────────────────────
        // 2. SHIELD STANCE — Protection and risk management
        // Active when there are significant risks or interventions
        // ─────────────────────────────────────────────────────────────────────────
        if (risk?.interventionLevel === 'veto') {
            return 'shield';
        }
        if (risk?.interventionLevel === 'friction') {
            return 'shield';
        }
        if (risk?.stakesLevel === 'high') {
            return 'shield';
        }
        // ─────────────────────────────────────────────────────────────────────────
        // 3. LENS STANCE — Information and clarity
        // Used when verification is required or when answering questions
        // ─────────────────────────────────────────────────────────────────────────
        if (verification?.required) {
            return 'lens';
        }
        if (intent?.type === 'question') {
            return 'lens';
        }
        // Complex topics that need careful explanation
        if (intent?.complexity === 'high' && intent?.type !== 'action') {
            return 'lens';
        }
        // ─────────────────────────────────────────────────────────────────────────
        // 4. SWORD STANCE — Forward motion and action
        // Used for action-oriented requests with low/medium stakes
        // By this point, we've already excluded critical/high stakes and active interventions
        // ─────────────────────────────────────────────────────────────────────────
        if (intent?.type === 'action' || intent?.type === 'planning') {
            // Only proceed if no active intervention (stakes already filtered)
            if (risk?.interventionLevel === 'none') {
                return 'sword';
            }
        }
        // ─────────────────────────────────────────────────────────────────────────
        // Default: LENS for general conversation
        // Safe default when intent is unclear
        // ─────────────────────────────────────────────────────────────────────────
        if (intent?.type === 'conversation') {
            return 'lens';
        }
        // When truly uncertain, default to lens (middle ground)
        return 'lens';
    }
}
exports.StanceGate = StanceGate;
// ─────────────────────────────────────────────────────────────────────────────────
// STANCE UTILITIES
// ─────────────────────────────────────────────────────────────────────────────────
/**
 * Compare stance priority.
 * Returns positive if a is higher priority than b.
 */
function compareStancePriority(a, b) {
    return STANCE_PRIORITY.indexOf(a) - STANCE_PRIORITY.indexOf(b);
}
/**
 * Get the higher priority stance.
 */
function getHigherPriorityStance(a, b) {
    return compareStancePriority(a, b) <= 0 ? a : b;
}
/**
 * Check if a stance is above a threshold.
 */
function isStanceAtLeast(stance, threshold) {
    return STANCE_PRIORITY.indexOf(stance) <= STANCE_PRIORITY.indexOf(threshold);
}
//# sourceMappingURL=stance-gate.js.map