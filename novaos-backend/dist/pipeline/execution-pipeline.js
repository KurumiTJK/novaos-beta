"use strict";
// ═══════════════════════════════════════════════════════════════════════════════
// EXECUTION PIPELINE — Phase 1 Implementation
// Core orchestrator that runs gates in deterministic order
// ═══════════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionPipeline = void 0;
exports.createPipeline = createPipeline;
const crypto_1 = require("crypto");
const types_js_1 = require("../helpers/types.js");
const response_builders_js_1 = require("../helpers/response-builders.js");
const pipeline_utilities_js_1 = require("../helpers/pipeline-utilities.js");
const safety_renderer_js_1 = require("../helpers/safety-renderer.js");
const invariant_gate_js_1 = require("../helpers/invariant-gate.js");
// Gate imports
const shield_gate_js_1 = require("../gates/shield-gate.js");
const lens_gate_js_1 = require("../gates/lens-gate.js");
const stance_gate_js_1 = require("../gates/stance-gate.js");
const capability_gate_js_1 = require("../gates/capability-gate.js");
const model_gate_js_1 = require("../gates/model-gate.js");
const personality_gate_js_1 = require("../gates/personality-gate.js");
const intent_classifier_js_1 = require("../helpers/intent-classifier.js");
const spark_eligibility_js_1 = require("../helpers/spark-eligibility.js");
const ack_token_js_1 = require("../helpers/ack-token.js");
// ─────────────────────────────────────────────────────────────────────────────────
// EXECUTION PIPELINE
// ─────────────────────────────────────────────────────────────────────────────────
class ExecutionPipeline {
    gates;
    config;
    constructor(config) {
        this.config = config;
        // Initialize gates
        this.gates = new Map([
            ['intent', new intent_classifier_js_1.IntentGate()],
            ['shield', new shield_gate_js_1.ShieldGate(config.nonceStore, config.ackTokenSecret)],
            ['lens', new lens_gate_js_1.LensGate(config.webFetcher ?? null)],
            ['stance', new stance_gate_js_1.StanceGate()],
            ['capability', new capability_gate_js_1.CapabilityGate()],
            ['model', new model_gate_js_1.ModelGate()],
            ['personality', new personality_gate_js_1.PersonalityGate()],
            ['spark', new spark_eligibility_js_1.SparkGate(config.sparkMetricsStore)],
        ]);
    }
    /**
     * Execute the full pipeline for a user input.
     */
    async execute(input) {
        const startTime = Date.now();
        const requestId = (0, crypto_1.randomUUID)();
        // Build context
        const context = {
            requestId,
            userId: input.userId,
            policyVersion: types_js_1.POLICY_VERSION,
            capabilityMatrixVersion: types_js_1.CAPABILITY_MATRIX_VERSION,
            constraintsVersion: types_js_1.CONSTRAINTS_VERSION,
            verificationPolicyVersion: types_js_1.VERIFICATION_POLICY_VERSION,
            freshnessPolicyVersion: types_js_1.FRESHNESS_POLICY_VERSION,
        };
        // Initialize state
        let state = {
            input,
            regenerationCount: 0,
            degraded: false,
        };
        const results = {};
        try {
            // Execute gates in order
            for (const gateId of types_js_1.GATE_ORDER) {
                const gate = this.gates.get(gateId);
                if (!gate) {
                    throw new Error(`Gate not found: ${gateId}`);
                }
                // Execute with timeout
                const timeout = pipeline_utilities_js_1.GATE_TIMEOUTS[gateId] ?? pipeline_utilities_js_1.TIMEOUTS.GATE_DEFAULT;
                const result = await (0, pipeline_utilities_js_1.withTimeout)(gate.execute(state, context), timeout, { requestId, gateId });
                // Store result
                results[gateId] = result;
                // Apply result to state
                state = this.applyResult(state, gateId, result);
                // Log gate result
                this.logGateResult(requestId, gateId, result);
                // Handle gate action
                switch (result.action) {
                    case 'stop':
                        state.stoppedAt = gateId;
                        state.stoppedReason = result.failureReason;
                        return this.finalizeResponse((0, response_builders_js_1.buildStoppedResponse)(state, results, context, startTime), state, results, context);
                    case 'await_ack':
                        return this.finalizeResponse((0, response_builders_js_1.buildAwaitAckResponse)(state, results, context, startTime), state, results, context);
                    case 'regenerate':
                        return this.executeRegeneration(state, results, context, startTime);
                    case 'degrade':
                        state.degraded = true;
                        break;
                    case 'continue':
                    default:
                        break;
                }
            }
            // All gates passed - build success response
            return this.buildSuccessResponse(state, results, context, startTime);
        }
        catch (error) {
            // Log internal error
            (0, pipeline_utilities_js_1.logInternalError)(error, { requestId, userId: input.userId });
            // Return sanitized error
            const clientError = (0, pipeline_utilities_js_1.sanitizeError)(error, requestId);
            return {
                success: false,
                stopped: true,
                message: clientError.message,
                stoppedReason: clientError.code,
            };
        }
    }
    /**
     * Execute regeneration sequence (model → personality → spark).
     * Max 2 attempts.
     */
    async executeRegeneration(state, results, context, startTime) {
        // Check regeneration limit
        if (state.regenerationCount >= 2) {
            state.degraded = true;
            return this.finalizeResponse((0, response_builders_js_1.buildDegradedResponse)(state, results, context, 'max_regenerations', startTime), state, results, context);
        }
        // Increment regeneration count
        state = { ...state, regenerationCount: state.regenerationCount + 1 };
        // Re-run regeneration gates
        for (const gateId of types_js_1.REGENERATION_GATES) {
            const gate = this.gates.get(gateId);
            if (!gate)
                continue;
            const timeout = pipeline_utilities_js_1.GATE_TIMEOUTS[gateId] ?? pipeline_utilities_js_1.TIMEOUTS.GATE_DEFAULT;
            const result = await (0, pipeline_utilities_js_1.withTimeout)(gate.execute(state, context), timeout, { requestId: context.requestId, gateId });
            results[gateId] = result;
            state = this.applyResult(state, gateId, result);
            this.logGateResult(context.requestId, gateId, result);
            if (result.action === 'stop') {
                state.stoppedAt = gateId;
                state.stoppedReason = result.failureReason;
                return this.finalizeResponse((0, response_builders_js_1.buildStoppedResponse)(state, results, context, startTime), state, results, context);
            }
            if (result.action === 'regenerate') {
                // Recursive regeneration
                return this.executeRegeneration(state, results, context, startTime);
            }
        }
        return this.buildSuccessResponse(state, results, context, startTime);
    }
    /**
     * Build success response with safety rendering and invariant checks.
     */
    async buildSuccessResponse(state, results, context, startTime) {
        // Get response text
        let responseText = state.validated?.text ?? state.generation?.text ?? '';
        // Apply safety rendering (crisis resources if needed)
        const safetyResult = (0, safety_renderer_js_1.applySafetyRendering)(responseText, state);
        responseText = safetyResult.text;
        // Run invariant checks
        const invariantViolations = (0, invariant_gate_js_1.checkAllInvariants)(state, results, { text: responseText });
        if (invariantViolations.length > 0) {
            const criticalViolations = invariantViolations.filter(v => {
                // Check if this is a critical invariant
                const criticalIds = ['hard_veto_stops', 'control_resources', 'soft_veto_requires_ack', 'no_nl_actions'];
                return criticalIds.includes(v.invariantId);
            });
            if (criticalViolations.length > 0) {
                console.error('[INVARIANT] Critical violations:', criticalViolations);
                state.stoppedAt = 'invariant';
                state.stoppedReason = `Critical invariant violation: ${criticalViolations.map(v => v.invariantId).join(', ')}`;
                return this.finalizeResponse((0, response_builders_js_1.buildStoppedResponse)(state, results, context, startTime), state, results, context);
            }
            // Log non-critical violations
            console.warn('[INVARIANT] Non-critical violations:', invariantViolations);
        }
        // Build final response
        const response = (0, response_builders_js_1.buildResponse)(state, results, context, startTime);
        response.message = responseText;
        // Add safety rendering info
        if (safetyResult.crisisResourcesProvided) {
            response.crisisResourcesProvided = true;
        }
        return this.finalizeResponse(response, state, results, context);
    }
    /**
     * Finalize response with audit logging.
     */
    async finalizeResponse(response, state, results, context) {
        // Audit logging (if configured)
        if (this.config.auditLogger) {
            try {
                await this.config.auditLogger.logResponse(state, results, context, response.message ?? '');
            }
            catch (error) {
                console.error('[AUDIT] Failed to log response:', error);
            }
        }
        return response;
    }
    /**
     * Apply gate result to pipeline state.
     */
    applyResult(state, gateId, result) {
        switch (gateId) {
            case 'intent':
                return { ...state, intent: result.output };
            case 'shield':
                const riskOutput = result.output;
                return {
                    ...state,
                    risk: riskOutput,
                    pendingAck: riskOutput?.pendingAck,
                };
            case 'lens':
                return { ...state, verification: result.output };
            case 'stance':
                return { ...state, stance: result.output };
            case 'capability':
                return { ...state, capabilities: result.output };
            case 'model':
                return { ...state, generation: result.output };
            case 'personality':
                return { ...state, validated: result.output };
            case 'spark':
                return { ...state, spark: result.output };
            default:
                return state;
        }
    }
    /**
     * Log gate result for debugging/monitoring.
     */
    logGateResult(requestId, gateId, result) {
        console.log(`[GATE] ${requestId} ${gateId}: status=${result.status}, action=${result.action}, time=${result.executionTimeMs}ms`);
        if (result.failureReason) {
            console.log(`[GATE] ${requestId} ${gateId} reason: ${result.failureReason}`);
        }
    }
}
exports.ExecutionPipeline = ExecutionPipeline;
// ─────────────────────────────────────────────────────────────────────────────────
// FACTORY FUNCTION
// ─────────────────────────────────────────────────────────────────────────────────
/**
 * Create a pipeline with default in-memory stores.
 * For production, use Redis/DB-backed stores.
 */
function createPipeline(config) {
    const defaultConfig = {
        nonceStore: new ack_token_js_1.InMemoryNonceStore(),
        sparkMetricsStore: new spark_eligibility_js_1.InMemorySparkMetricsStore(),
        ackTokenSecret: config?.ackTokenSecret ?? process.env.ACK_TOKEN_SECRET ?? 'development-secret-change-in-production',
        webFetcher: config?.webFetcher ?? null,
        auditLogger: config?.auditLogger,
    };
    return new ExecutionPipeline({ ...defaultConfig, ...config });
}
//# sourceMappingURL=execution-pipeline.js.map