// ═══════════════════════════════════════════════════════════════════════════════
// PERSONALITY GATE — Constitutional Compliance Check
// 
// Uses LLM to verify generated responses comply with the Nova Constitution.
// If violation detected, triggers regeneration with fix guidance.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  PipelineState,
  PipelineContext,
  GateResult,
  ValidatedOutput,
  Generation,
} from '../../types/index.js';

import { CONSTITUTIONAL_CHECK_PROMPT } from './constitution.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface ConstitutionalCheckResult {
  violates: boolean;
  reason: string | null;
  fix: string | null;
}

export interface PersonalityGateOutput extends ValidatedOutput {
  constitutionalCheck?: ConstitutionalCheckResult;
  fixGuidance?: string;  // Stored for regeneration
}

export interface PersonalityGateConfig {
  /** Skip constitutional check (for testing) */
  skipCheck?: boolean;
  /** Max retries for LLM call */
  maxRetries?: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// SYNC GATE (mock/testing)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Synchronous Personality Gate for mock/testing.
 * Always passes through (no LLM check).
 */
export function executePersonalityGate(
  state: PipelineState,
  _context: PipelineContext,
  _config?: PersonalityGateConfig
): GateResult<PersonalityGateOutput> {
  const start = Date.now();
  const text = state.generation?.text ?? '';

  console.log('[PERSONALITY] Mode: mock (pass-through)');

  return {
    gateId: 'personality',
    status: 'pass',
    output: {
      text,
      valid: true,
      edited: false,
    },
    action: 'continue',
    executionTimeMs: Date.now() - start,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// ASYNC GATE (real LLM constitutional check)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Asynchronous Personality Gate with LLM constitutional check.
 * 
 * @param state - Pipeline state with generation
 * @param context - Pipeline context
 * @param checkFn - Function to call LLM for constitutional check
 * @param config - Optional configuration
 */
export async function executePersonalityGateAsync(
  state: PipelineState,
  _context: PipelineContext,
  checkFn: (prompt: string, systemPrompt: string) => Promise<Generation>,
  config?: PersonalityGateConfig
): Promise<GateResult<PersonalityGateOutput>> {
  const start = Date.now();
  const generatedText = state.generation?.text ?? '';

  // Skip check if configured or no text
  if (config?.skipCheck || !generatedText) {
    console.log('[PERSONALITY] Skipping constitutional check');
    return {
      gateId: 'personality',
      status: 'pass',
      output: {
        text: generatedText,
        valid: true,
        edited: false,
      },
      action: 'continue',
      executionTimeMs: Date.now() - start,
    };
  }

  try {
    // Build the check prompt
    const userPrompt = `RESPONSE TO CHECK:
"""
${generatedText}
"""

Analyze this response for constitutional violations.`;

    console.log('[PERSONALITY] Running constitutional check...');

    // Call LLM for constitutional check
    const checkResponse = await checkFn(userPrompt, CONSTITUTIONAL_CHECK_PROMPT);
    
    // Parse the JSON response
    const checkResult = parseCheckResult(checkResponse.text);

    console.log(`[PERSONALITY] Check result: violates=${checkResult.violates}`);
    if (checkResult.violates) {
      console.log(`[PERSONALITY] Reason: ${checkResult.reason}`);
      console.log(`[PERSONALITY] Fix: ${checkResult.fix}`);
    }

    // Handle violation
    if (checkResult.violates) {
      return {
        gateId: 'personality',
        status: 'hard_fail',
        output: {
          text: generatedText,
          valid: false,
          edited: false,
          constitutionalCheck: checkResult,
          fixGuidance: checkResult.fix ?? undefined,
          violations: checkResult.reason ? [checkResult.reason] : [],
        },
        action: 'regenerate',
        failureReason: `Constitutional violation: ${checkResult.reason}`,
        executionTimeMs: Date.now() - start,
      };
    }

    // No violation - pass through UNCHANGED (no modifications to original response)
    return {
      gateId: 'personality',
      status: 'pass',
      output: {
        text: generatedText,  // Original response - NOT modified
        valid: true,
        edited: false,
        constitutionalCheck: checkResult,
      },
      action: 'continue',
      executionTimeMs: Date.now() - start,
    };

  } catch (error) {
    console.error('[PERSONALITY] Constitutional check failed:', error);

    // On error, pass through (fail open for UX)
    return {
      gateId: 'personality',
      status: 'soft_fail',
      output: {
        text: generatedText,
        valid: true,  // Assume valid on error
        edited: false,
      },
      action: 'continue',
      failureReason: 'Constitutional check failed, passing through',
      executionTimeMs: Date.now() - start,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Parse the LLM's JSON response for constitutional check.
 */
function parseCheckResult(responseText: string): ConstitutionalCheckResult {
  try {
    // Clean up potential markdown code blocks
    let cleaned = responseText.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    const parsed = JSON.parse(cleaned);
    
    return {
      violates: Boolean(parsed.violates),
      reason: parsed.reason ?? null,
      fix: parsed.fix ?? null,
    };
  } catch (error) {
    console.error('[PERSONALITY] Failed to parse check result:', responseText);
    
    // Default to no violation on parse error
    return {
      violates: false,
      reason: null,
      fix: null,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// FIX GUIDANCE BUILDER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Build the augmented message for regeneration with fix guidance.
 * This is used by execution-pipeline when regenerating.
 */
export function buildRegenerationMessage(
  originalMessage: string,
  fixGuidance: string
): string {
  return `${originalMessage}

─────────────────────────────────────
IMPORTANT - PREVIOUS RESPONSE ISSUE:
─────────────────────────────────────
${fixGuidance}

Please regenerate your response addressing the above issue.`;
}
