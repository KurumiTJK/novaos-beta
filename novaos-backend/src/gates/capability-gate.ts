// ═══════════════════════════════════════════════════════════════════════════════
// CAPABILITY GATE — Capability Matrix Enforcement
// NO natural-language action inference - only explicit sources
// ═══════════════════════════════════════════════════════════════════════════════

import {
  PipelineState,
  PipelineContext,
  GateResult,
  GateId,
  CapabilityCheckResult,
  CapabilityViolation,
  RequestedAction,
  ActionType,
  Stance,
  Capability,
  CapabilityLevel,
  CapabilityRule,
  CapabilityMatrix,
} from '../helpers/types.js';

import { checkPrecondition } from '../helpers/precondition-checker.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CAPABILITY MATRIX
// Defines what actions are allowed in each stance
// ─────────────────────────────────────────────────────────────────────────────────

const CAPABILITY_MATRIX: Record<Stance, Partial<Record<ActionType, CapabilityRule>>> = {
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

export class CapabilityGate {
  readonly gateId: GateId = 'capability';

  async execute(
    state: PipelineState,
    context: PipelineContext
  ): Promise<GateResult<CapabilityCheckResult>> {
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
      const violations: CapabilityViolation[] = [];
      const allowed: RequestedAction[] = [];
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
          const met = checkPrecondition(rule.precondition, state);
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

    } catch (error) {
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
  private getExplicitActions(input: any): RequestedAction[] {
    const validSources = ['ui_button', 'command_parser', 'api_field'];
    
    return (input.requestedActions || []).filter((a: RequestedAction) => 
      validSources.includes(a.source)
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// CAPABILITY UTILITIES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check if an action is allowed in a given stance.
 */
export function isActionAllowed(action: ActionType, stance: Stance): boolean {
  const rule = CAPABILITY_MATRIX[stance]?.[action];
  return rule?.level === 'allowed' || rule?.level === 'limited';
}

/**
 * Get the capability level for an action in a stance.
 */
export function getCapabilityLevel(action: ActionType, stance: Stance): CapabilityLevel | null {
  return CAPABILITY_MATRIX[stance]?.[action]?.level ?? null;
}
