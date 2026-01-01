// ═══════════════════════════════════════════════════════════════════════════════
// CONSTITUTION GATE — Constitutional Compliance Check
// 
// Router + LLM check to verify responses comply with the Nova Constitution.
// Runs check only when safety_signal is medium/high OR shield_acceptance is true.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  PipelineState,
  PipelineContext,
  GateResult,
  Generation,
} from '../../types/index.js';

import { CONSTITUTIONAL_CHECK_PROMPT } from './constitution.js';
import type {
  ConstitutionGateOutput,
  ConstitutionGateConfig,
  ConstitutionalCheckResult,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// ROUTER — Decide whether to run constitutional check
// ─────────────────────────────────────────────────────────────────────────────────

interface RouterDecision {
  runCheck: boolean;
  reason: string;
}

function shouldRunConstitutionCheck(state: PipelineState): RouterDecision {
  // Get safety signal from intent gate
  const safetySignal = state.intent_summary?.safety_signal ?? 'safe';
  
  // Get shield acceptance from shield gate (defaults to false until implemented)
  const shieldAcceptance = state.shieldResult?.shield_acceptance ?? false;
  
  // Run check if safety_signal is medium or high
  if (safetySignal === 'medium' || safetySignal === 'high') {
    return {
      runCheck: true,
      reason: `safety=${safetySignal}`,
    };
  }
  
  // Run check if shield_acceptance is true
  if (shieldAcceptance) {
    return {
      runCheck: true,
      reason: `shield_acceptance=true`,
    };
  }
  
  // Otherwise skip
  return {
    runCheck: false,
    reason: `safety=${safetySignal}, shield_acceptance=${shieldAcceptance}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// ASYNC GATE (LLM constitutional check)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Constitution Gate with router logic and LLM constitutional check.
 * 
 * Router runs check if:
 * - safety_signal is 'medium' or 'high', OR
 * - shield_acceptance is true
 * 
 * Otherwise skips and passes through.
 */
export async function executeConstitutionGateAsync(
  state: PipelineState,
  _context: PipelineContext,
  checkFn: (prompt: string, systemPrompt: string) => Promise<Generation>,
  config?: ConstitutionGateConfig
): Promise<GateResult<ConstitutionGateOutput>> {
  const start = Date.now();
  const generatedText = state.generation?.text ?? '';

  // Force skip if configured
  if (config?.forceSkip) {
    console.log('[CONSTITUTION] Skipping: forceSkip=true');
    return createSkipResult(generatedText, 'forceSkip=true', start);
  }

  // Router decision (unless forceRun)
  if (!config?.forceRun) {
    const decision = shouldRunConstitutionCheck(state);
    
    if (!decision.runCheck) {
      console.log(`[CONSTITUTION] Skipping: ${decision.reason}`);
      return createSkipResult(generatedText, decision.reason, start);
    }
    
    console.log(`[CONSTITUTION] Running check: ${decision.reason}`);
  } else {
    console.log('[CONSTITUTION] Running check: forceRun=true');
  }

  // No text to check
  if (!generatedText) {
    console.log('[CONSTITUTION] Skipping: no generated text');
    return createSkipResult(generatedText, 'no generated text', start);
  }

  try {
    // Build the check prompt
    const userPrompt = `RESPONSE TO CHECK:
"""
${generatedText}
"""

Analyze this response for constitutional violations.`;

    // Call LLM for constitutional check
    const checkResponse = await checkFn(userPrompt, CONSTITUTIONAL_CHECK_PROMPT);
    
    // Parse the JSON response
    const checkResult = parseCheckResult(checkResponse.text);

    console.log(`[CONSTITUTION] Result: violates=${checkResult.violates}`);
    
    if (checkResult.violates) {
      console.log(`[CONSTITUTION] Violation: ${checkResult.reason} → regenerate`);
    }

    // Handle violation
    if (checkResult.violates) {
      return {
        gateId: 'constitution',
        status: 'hard_fail',
        output: {
          text: generatedText,
          valid: false,
          edited: false,
          checkRun: true,
          constitutionalCheck: checkResult,
          fixGuidance: checkResult.fix ?? undefined,
          violations: checkResult.reason ? [checkResult.reason] : [],
        },
        action: 'regenerate',
        failureReason: `Constitutional violation: ${checkResult.reason}`,
        executionTimeMs: Date.now() - start,
      };
    }

    // No violation - pass through unchanged
    return {
      gateId: 'constitution',
      status: 'pass',
      output: {
        text: generatedText,
        valid: true,
        edited: false,
        checkRun: true,
        constitutionalCheck: checkResult,
      },
      action: 'continue',
      executionTimeMs: Date.now() - start,
    };

  } catch (error) {
    console.error('[CONSTITUTION] Check failed:', error);

    // On error, pass through (fail open for UX)
    return {
      gateId: 'constitution',
      status: 'soft_fail',
      output: {
        text: generatedText,
        valid: true,
        edited: false,
        checkRun: true,
        skipReason: 'LLM check failed',
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
 * Create a skip result (when router decides not to run check).
 */
function createSkipResult(
  text: string,
  reason: string,
  startTime: number
): GateResult<ConstitutionGateOutput> {
  return {
    gateId: 'constitution',
    status: 'pass',
    output: {
      text,
      valid: true,
      edited: false,
      checkRun: false,
      skipReason: reason,
    },
    action: 'continue',
    executionTimeMs: Date.now() - startTime,
  };
}

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
    console.error('[CONSTITUTION] Failed to parse check result:', responseText);
    
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
