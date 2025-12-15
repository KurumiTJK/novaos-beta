// ═══════════════════════════════════════════════════════════════════════════════
// EXECUTION PIPELINE — Phase 1 Implementation
// Core orchestrator that runs gates in deterministic order
// ═══════════════════════════════════════════════════════════════════════════════

import { randomUUID } from 'crypto';
import {
  PipelineState,
  GateResult,
  GateResults,
  PipelineContext,
  PipelineResult,
  UserInput,
  GateId,
  GATE_ORDER,
  REGENERATION_GATES,
  POLICY_VERSION,
  CAPABILITY_MATRIX_VERSION,
  CONSTRAINTS_VERSION,
  VERIFICATION_POLICY_VERSION,
  FRESHNESS_POLICY_VERSION,
  Intent,
  RiskSummary,
  VerificationPlan,
  Stance,
  CapabilityCheckResult,
  GenerationResult,
  ValidatedOutput,
  SparkDecision,
} from '../helpers/types.js';

import {
  buildResponse,
  buildStoppedResponse,
  buildAwaitAckResponse,
  buildDegradedResponse,
} from '../helpers/response-builders.js';

import {
  cloneState,
  withTimeout,
  GATE_TIMEOUTS,
  TIMEOUTS,
  logInternalError,
  sanitizeError,
} from '../helpers/pipeline-utilities.js';

import { applySafetyRendering } from '../helpers/safety-renderer.js';
import { InvariantGate, checkAllInvariants } from '../helpers/invariant-gate.js';
import { AuditLogger } from '../helpers/audit-logger.js';

// Gate imports
import { ShieldGate } from '../gates/shield-gate.js';
import { LensGate } from '../gates/lens-gate.js';
import { StanceGate } from '../gates/stance-gate.js';
import { CapabilityGate } from '../gates/capability-gate.js';
import { ModelGate } from '../gates/model-gate.js';
import { PersonalityGate } from '../gates/personality-gate.js';
import { IntentGate } from '../helpers/intent-classifier.js';
import { SparkGate, InMemorySparkMetricsStore, SparkMetricsStore } from '../helpers/spark-eligibility.js';
import { NonceStore, InMemoryNonceStore } from '../helpers/ack-token.js';

// ─────────────────────────────────────────────────────────────────────────────────
// GATE INTERFACE
// ─────────────────────────────────────────────────────────────────────────────────

export interface Gate<TOutput> {
  readonly gateId: GateId;
  execute(state: PipelineState, context: PipelineContext): Promise<GateResult<TOutput>>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// PIPELINE CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

export interface PipelineConfig {
  nonceStore: NonceStore;
  sparkMetricsStore: SparkMetricsStore;
  auditLogger?: AuditLogger;
  ackTokenSecret: string;
  webFetcher?: {
    search: (query: string, options?: { limit?: number }) => Promise<any[]>;
    fetch: (url: string) => Promise<any>;
  } | null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXECUTION PIPELINE
// ─────────────────────────────────────────────────────────────────────────────────

export class ExecutionPipeline {
  private gates: Map<GateId, Gate<unknown>>;
  private config: PipelineConfig;

  constructor(config: PipelineConfig) {
    this.config = config;
    
    // Initialize gates
    this.gates = new Map<GateId, Gate<unknown>>([
      ['intent', new IntentGate()],
      ['shield', new ShieldGate(config.nonceStore, config.ackTokenSecret)],
      ['lens', new LensGate(config.webFetcher ?? null)],
      ['stance', new StanceGate()],
      ['capability', new CapabilityGate()],
      ['model', new ModelGate()],
      ['personality', new PersonalityGate()],
      ['spark', new SparkGate(config.sparkMetricsStore)],
    ]);
  }

  /**
   * Execute the full pipeline for a user input.
   */
  async execute(input: UserInput): Promise<PipelineResult> {
    const startTime = Date.now();
    const requestId = randomUUID();

    // Build context
    const context: PipelineContext = {
      requestId,
      userId: input.userId,
      policyVersion: POLICY_VERSION,
      capabilityMatrixVersion: CAPABILITY_MATRIX_VERSION,
      constraintsVersion: CONSTRAINTS_VERSION,
      verificationPolicyVersion: VERIFICATION_POLICY_VERSION,
      freshnessPolicyVersion: FRESHNESS_POLICY_VERSION,
    };

    // Initialize state
    let state: PipelineState = {
      input,
      regenerationCount: 0,
      degraded: false,
    };

    const results: GateResults = {};

    try {
      // Execute gates in order
      for (const gateId of GATE_ORDER) {
        const gate = this.gates.get(gateId);
        if (!gate) {
          throw new Error(`Gate not found: ${gateId}`);
        }

        // Execute with timeout
        const timeout = GATE_TIMEOUTS[gateId] ?? TIMEOUTS.GATE_DEFAULT;
        const result = await withTimeout(
          gate.execute(state, context),
          timeout,
          { requestId, gateId }
        );

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
            return this.finalizeResponse(
              buildStoppedResponse(state, results, context, startTime),
              state,
              results,
              context
            );

          case 'await_ack':
            return this.finalizeResponse(
              buildAwaitAckResponse(state, results, context, startTime),
              state,
              results,
              context
            );

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

    } catch (error) {
      // Log internal error
      logInternalError(error, { requestId, userId: input.userId });

      // Return sanitized error
      const clientError = sanitizeError(error, requestId);
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
  private async executeRegeneration(
    state: PipelineState,
    results: GateResults,
    context: PipelineContext,
    startTime: number
  ): Promise<PipelineResult> {
    // Check regeneration limit
    if (state.regenerationCount >= 2) {
      state.degraded = true;
      return this.finalizeResponse(
        buildDegradedResponse(state, results, context, 'max_regenerations', startTime),
        state,
        results,
        context
      );
    }

    // Increment regeneration count
    state = { ...state, regenerationCount: state.regenerationCount + 1 };

    // Re-run regeneration gates
    for (const gateId of REGENERATION_GATES) {
      const gate = this.gates.get(gateId);
      if (!gate) continue;

      const timeout = GATE_TIMEOUTS[gateId] ?? TIMEOUTS.GATE_DEFAULT;
      const result = await withTimeout(
        gate.execute(state, context),
        timeout,
        { requestId: context.requestId, gateId }
      );

      results[gateId] = result;
      state = this.applyResult(state, gateId, result);

      this.logGateResult(context.requestId, gateId, result);

      if (result.action === 'stop') {
        state.stoppedAt = gateId;
        state.stoppedReason = result.failureReason;
        return this.finalizeResponse(
          buildStoppedResponse(state, results, context, startTime),
          state,
          results,
          context
        );
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
  private async buildSuccessResponse(
    state: PipelineState,
    results: GateResults,
    context: PipelineContext,
    startTime: number
  ): Promise<PipelineResult> {
    // Get response text
    let responseText = state.validated?.text ?? state.generation?.text ?? '';

    // Apply safety rendering (crisis resources if needed)
    const safetyResult = applySafetyRendering(responseText, state);
    responseText = safetyResult.text;

    // Run invariant checks
    const invariantViolations = checkAllInvariants(state, results, { text: responseText });
    if (invariantViolations.length > 0) {
      const criticalViolations = invariantViolations.filter(v => {
        // Check if this is a critical invariant
        const criticalIds = ['hard_veto_stops', 'control_resources', 'soft_veto_requires_ack', 'no_nl_actions'];
        return criticalIds.includes(v.invariantId);
      });

      if (criticalViolations.length > 0) {
        console.error('[INVARIANT] Critical violations:', criticalViolations);
        state.stoppedAt = 'invariant' as GateId;
        state.stoppedReason = `Critical invariant violation: ${criticalViolations.map(v => v.invariantId).join(', ')}`;
        return this.finalizeResponse(
          buildStoppedResponse(state, results, context, startTime),
          state,
          results,
          context
        );
      }

      // Log non-critical violations
      console.warn('[INVARIANT] Non-critical violations:', invariantViolations);
    }

    // Build final response
    const response = buildResponse(state, results, context, startTime);
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
  private async finalizeResponse(
    response: PipelineResult,
    state: PipelineState,
    results: GateResults,
    context: PipelineContext
  ): Promise<PipelineResult> {
    // Audit logging (if configured)
    if (this.config.auditLogger) {
      try {
        await this.config.auditLogger.logResponse(
          state,
          results,
          context,
          response.message ?? ''
        );
      } catch (error) {
        console.error('[AUDIT] Failed to log response:', error);
      }
    }

    return response;
  }

  /**
   * Apply gate result to pipeline state.
   */
  private applyResult(
    state: PipelineState,
    gateId: GateId,
    result: GateResult<unknown>
  ): PipelineState {
    switch (gateId) {
      case 'intent':
        return { ...state, intent: result.output as Intent };
      case 'shield':
        const riskOutput = result.output as RiskSummary;
        return {
          ...state,
          risk: riskOutput,
          pendingAck: riskOutput?.pendingAck,
        };
      case 'lens':
        return { ...state, verification: result.output as VerificationPlan };
      case 'stance':
        return { ...state, stance: result.output as Stance };
      case 'capability':
        return { ...state, capabilities: result.output as CapabilityCheckResult };
      case 'model':
        return { ...state, generation: result.output as GenerationResult };
      case 'personality':
        return { ...state, validated: result.output as ValidatedOutput };
      case 'spark':
        return { ...state, spark: result.output as SparkDecision };
      default:
        return state;
    }
  }

  /**
   * Log gate result for debugging/monitoring.
   */
  private logGateResult(requestId: string, gateId: GateId, result: GateResult<unknown>): void {
    console.log(`[GATE] ${requestId} ${gateId}: status=${result.status}, action=${result.action}, time=${result.executionTimeMs}ms`);
    if (result.failureReason) {
      console.log(`[GATE] ${requestId} ${gateId} reason: ${result.failureReason}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// FACTORY FUNCTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a pipeline with default in-memory stores.
 * For production, use Redis/DB-backed stores.
 */
export function createPipeline(config?: Partial<PipelineConfig>): ExecutionPipeline {
  const defaultConfig: PipelineConfig = {
    nonceStore: new InMemoryNonceStore(),
    sparkMetricsStore: new InMemorySparkMetricsStore(),
    ackTokenSecret: config?.ackTokenSecret ?? process.env.ACK_TOKEN_SECRET ?? 'development-secret-change-in-production',
    webFetcher: config?.webFetcher ?? null,
    auditLogger: config?.auditLogger,
  };

  return new ExecutionPipeline({ ...defaultConfig, ...config });
}
