// ═══════════════════════════════════════════════════════════════════════════════
// MEMORY GATE — Memory Detection and Storage
// 
// Detects when user wants Nova to remember something and stores it.
// Uses regex for strong matches, LLM fallback for subtle intent.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  PipelineState,
  PipelineContext,
  GateResult,
  Generation,
} from '../../types/index.js';

import { pipeline_model } from '../../pipeline/llm_engine.js';
import { hasMemoryKeyword, matchStrongPattern } from './patterns.js';
import { getMemoryStore, isMemoryStoreInitialized, generateMemoryId } from './store.js';
import type {
  MemoryGateOutput,
  MemoryGateConfig,
  MemoryCheckResult,
  MemoryRecord,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LLM PROMPT FOR MEMORY CHECK
// ─────────────────────────────────────────────────────────────────────────────────

const MEMORY_CHECK_PROMPT = `You are a memory intent detector. Analyze if the user is asking you to remember something for future conversations.

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "isMemoryRequest": true or false
}

Examples of memory requests (isMemoryRequest: true):
- "My favorite color is blue, keep that in mind"
- "I prefer morning meetings"
- "Remember I'm allergic to peanuts"
- "Note that I work at Google"
- "Don't forget my birthday is March 5th"
- "Save this: I use vim"

Examples of NOT memory requests (isMemoryRequest: false):
- "What's the weather like?"
- "Can you help me with my code?"
- "Remember when we talked about X?" (asking to recall, not store)
- "What do you remember about Python?" (asking about knowledge)

Now analyze this message:`;

// ─────────────────────────────────────────────────────────────────────────────────
// ROUTER — Decide whether to run memory detection
// ─────────────────────────────────────────────────────────────────────────────────

interface RouterDecision {
  runCheck: boolean;
  reason: string;
}

function shouldRunMemoryCheck(state: PipelineState): RouterDecision {
  // Get intent gate outputs
  const stance = state.intent_summary?.stance ?? 'LENS';
  const primaryRoute = state.intent_summary?.primary_route ?? 'SAY';
  
  // Must be LENS stance
  if (stance !== 'LENS') {
    return {
      runCheck: false,
      reason: `stance=${stance}`,
    };
  }
  
  // Must be SAY route
  if (primaryRoute !== 'SAY') {
    return {
      runCheck: false,
      reason: `primary_route=${primaryRoute}`,
    };
  }
  
  // Must contain memory-related keyword
  if (!hasMemoryKeyword(state.userMessage)) {
    return {
      runCheck: false,
      reason: 'no memory keyword',
    };
  }
  
  return {
    runCheck: true,
    reason: `stance=${stance}, primary_route=${primaryRoute}, has keyword`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// ASYNC GATE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Memory Gate - detects and stores user memory requests.
 * 
 * Flow:
 * 1. Router: Check stance=LENS, primary_route=SAY, has memory keyword
 * 2. Strong regex: Check for explicit patterns like "remember this"
 * 3. LLM fallback: Check for subtle memory intent
 * 4. Store: Save userMessage + generatedResponse to storage
 */
export async function executeMemoryGateAsync(
  state: PipelineState,
  context: PipelineContext,
  checkFn: (prompt: string, systemPrompt: string) => Promise<Generation>,
  config?: MemoryGateConfig
): Promise<GateResult<MemoryGateOutput>> {
  const start = Date.now();
  const responseText = state.validatedOutput?.text ?? state.generation?.text ?? '';
  const userId = context.userId ?? 'anonymous';

  // Force skip if configured
  if (config?.forceSkip) {
    console.log('[MEMORY] Skipping: forceSkip=true');
    return createSkipResult(responseText, 'forceSkip=true', start);
  }

  // Check if store is initialized
  if (!isMemoryStoreInitialized()) {
    console.log('[MEMORY] Skipping: store not initialized');
    return createSkipResult(responseText, 'store not initialized', start);
  }

  // Router decision (unless forceRun)
  if (!config?.forceRun) {
    const decision = shouldRunMemoryCheck(state);
    
    if (!decision.runCheck) {
      console.log(`[MEMORY] Skipping: ${decision.reason}`);
      return createSkipResult(responseText, decision.reason, start);
    }
    
    console.log(`[MEMORY] Running check: ${decision.reason}`);
  } else {
    console.log('[MEMORY] Running check: forceRun=true');
  }

  // ─── STEP 2: Strong regex match ───
  const strongMatch = matchStrongPattern(state.userMessage);
  if (strongMatch) {
    console.log(`[MEMORY] Regex match: "${strongMatch[0]}"`);
    
    const record = await storeMemory(userId, state.userMessage, responseText, 'regex');
    return createSuccessResult(responseText, true, record, start);
  }

  // ─── STEP 3: LLM fallback check ───
  try {
    console.log(`[MEMORY] LLM check (model: ${pipeline_model})...`);
    
    const userPrompt = `${MEMORY_CHECK_PROMPT}\nUser: "${state.userMessage}"`;
    const checkResponse = await checkFn(userPrompt, '');
    
    const checkResult = parseCheckResult(checkResponse.text);
    
    console.log(`[MEMORY] LLM result: isMemoryRequest=${checkResult.isMemoryRequest}`);
    
    if (checkResult.isMemoryRequest) {
      const record = await storeMemory(userId, state.userMessage, responseText, 'llm');
      return createSuccessResult(responseText, true, record, start);
    }
    
    // No memory intent detected
    console.log('[MEMORY] No memory intent detected');
    return createNoMatchResult(responseText, start);
    
  } catch (error) {
    console.error('[MEMORY] LLM check failed:', error);
    
    // On error, pass through (don't block response)
    return {
      gateId: 'memory',
      status: 'soft_fail',
      output: {
        text: responseText,
        memoryDetected: false,
        memoryStored: false,
        skipReason: 'LLM check failed',
      },
      action: 'continue',
      failureReason: 'Memory check failed, passing through',
      executionTimeMs: Date.now() - start,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Store a memory record.
 */
async function storeMemory(
  userId: string,
  userMessage: string,
  generatedResponse: string,
  source: 'regex' | 'llm'
): Promise<MemoryRecord> {
  const store = getMemoryStore();
  
  const record: MemoryRecord = {
    id: generateMemoryId(),
    userId,
    userMessage,
    generatedResponse,
    source,
    timestamp: Date.now(),
  };
  
  await store.store(record);
  
  return record;
}

/**
 * Parse the LLM's JSON response.
 */
function parseCheckResult(responseText: string): MemoryCheckResult {
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
      isMemoryRequest: Boolean(parsed.isMemoryRequest),
    };
  } catch (error) {
    console.error('[MEMORY] Failed to parse LLM result:', responseText);
    
    // Default to no memory request on parse error
    return {
      isMemoryRequest: false,
    };
  }
}

/**
 * Create skip result.
 */
function createSkipResult(
  text: string,
  reason: string,
  startTime: number
): GateResult<MemoryGateOutput> {
  return {
    gateId: 'memory',
    status: 'pass',
    output: {
      text,
      memoryDetected: false,
      memoryStored: false,
      skipReason: reason,
    },
    action: 'continue',
    executionTimeMs: Date.now() - startTime,
  };
}

/**
 * Create success result (memory stored).
 */
function createSuccessResult(
  text: string,
  detected: boolean,
  record: MemoryRecord,
  startTime: number
): GateResult<MemoryGateOutput> {
  return {
    gateId: 'memory',
    status: 'pass',
    output: {
      text,
      memoryDetected: detected,
      memoryStored: true,
      memoryRecord: record,
    },
    action: 'continue',
    executionTimeMs: Date.now() - startTime,
  };
}

/**
 * Create no-match result (checked but no memory intent).
 */
function createNoMatchResult(
  text: string,
  startTime: number
): GateResult<MemoryGateOutput> {
  return {
    gateId: 'memory',
    status: 'pass',
    output: {
      text,
      memoryDetected: false,
      memoryStored: false,
    },
    action: 'continue',
    executionTimeMs: Date.now() - startTime,
  };
}
