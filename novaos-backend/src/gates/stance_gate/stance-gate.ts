// ═══════════════════════════════════════════════════════════════════════════════
// STANCE GATE — Router to Sword or Lens Engine
// ═══════════════════════════════════════════════════════════════════════════════
// 
// When learning_intent=true AND stance=SWORD, this gate:
// 1. Fetches user's existing lesson plans from Supabase
// 2. Uses LLM to classify: designer (new plan) vs runner (existing plan)
// 3. Returns REDIRECT action so frontend navigates to SwordGate UI
//
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  StanceGateOutput,
  SwordRedirect,
  SwordModeClassification,
  LessonPlanSummary,
} from './types.js';
import type {
  PipelineState,
  PipelineContext,
  GateResult,
} from '../../types/index.js';
import { classifyWithPipelineModel } from '../../pipeline/llm_engine.js';
import { isSupabaseInitialized, getSupabase } from '../../db/index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// LLM CLASSIFICATION PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

const SWORD_ROUTING_PROMPT = `You route learning requests to the appropriate mode.

MODES:
- designer: User wants to CREATE a new learning plan (new topic, start fresh, learn something new)
- runner: User wants to CONTINUE an existing plan (practice, study, resume, what's next, help me with current topic)

USER'S EXISTING LESSON PLANS:
{plans}

USER MESSAGE: "{message}"

DECISION RULES:
1. If user mentions a topic they DON'T have a plan for → designer
2. If user wants to continue/practice/resume an existing plan → runner  
3. If user says "something new", "start fresh", "new topic" → designer
4. If user asks "what should I study", "what's next" and has active plan → runner
5. If user references a topic they HAVE a plan for → runner (with that planId)
6. If ambiguous and they have an active plan → runner (with most recent active plan)
7. If ambiguous and no plans exist → designer
8. If user mentions specific topic matching existing plan → runner with that plan's ID

RESPOND WITH JSON ONLY (no markdown, no explanation):
{"mode": "designer" | "runner", "planId": "uuid-of-plan-or-null", "topic": "extracted-topic-or-null"}

EXAMPLES:
- "I want to learn guitar" (no guitar plan) → {"mode":"designer","planId":null,"topic":"guitar"}
- "Continue my Python course" (has Python plan abc-123) → {"mode":"runner","planId":"abc-123","topic":null}
- "What should I study today?" (has active plan xyz-789) → {"mode":"runner","planId":"xyz-789","topic":null}
- "Help me practice" (has one active plan) → {"mode":"runner","planId":"<that-plan-id>","topic":null}
- "I want to learn something new" → {"mode":"designer","planId":null,"topic":null}`;

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch user's lesson plans for LLM context
 */
async function getUserPlans(userId: string): Promise<LessonPlanSummary[]> {
  if (!isSupabaseInitialized()) {
    return [];
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('lesson_plans')
      .select('id, topic, capstone, progress, status')
      .eq('user_id', userId)
      .in('status', ['active', 'paused'])
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[STANCE] Failed to fetch plans:', error);
      return [];
    }

    return (data || []).map(p => ({
      id: p.id,
      topic: p.topic,
      capstone: p.capstone,
      progress: p.progress || 0,
      status: p.status as 'active' | 'paused' | 'completed' | 'abandoned',
    }));
  } catch (error) {
    console.error('[STANCE] Error fetching plans:', error);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LLM CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Use LLM to classify whether user wants designer or runner mode
 */
async function classifySwordMode(
  userId: string,
  userMessage: string
): Promise<SwordModeClassification> {
  // 1. Fetch user's existing plans
  const plans = await getUserPlans(userId);
  
  // 2. Format plans for prompt
  const plansText = plans.length > 0
    ? plans.map(p => 
        `- ${p.topic} (ID: ${p.id}, ${Math.round(p.progress * 100)}% complete, ${p.status})${p.capstone ? ` Goal: "${p.capstone}"` : ''}`
      ).join('\n')
    : '(no existing plans)';
  
  // 3. Build prompt
  const prompt = SWORD_ROUTING_PROMPT
    .replace('{plans}', plansText)
    .replace('{message}', userMessage);
  
  // 4. Call LLM
  const result = await classifyWithPipelineModel(
    prompt,
    `Route this learning request: "${userMessage}"`,
    { temperature: 0, max_tokens: 150 }
  );
  
  console.log('[STANCE] LLM classification result:', result);
  
  // 5. Parse response
  if (result) {
    try {
      // Clean potential markdown formatting
      const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      
      return {
        mode: parsed.mode === 'runner' ? 'runner' : 'designer',
        planId: parsed.planId || undefined,
        topic: parsed.topic || undefined,
      };
    } catch (parseError) {
      console.error('[STANCE] Failed to parse LLM response:', parseError);
    }
  }
  
  // 6. Fallback: designer if no plans, runner if has plans
  const activePlan = plans.find(p => p.status === 'active');
  return {
    mode: activePlan ? 'runner' : 'designer',
    planId: activePlan?.id,
    topic: undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXECUTE STANCE GATE (Sync version - no SwordGate features)
// ─────────────────────────────────────────────────────────────────────────────────

export function executeStanceGate(
  state: PipelineState,
  _context: PipelineContext
): GateResult<StanceGateOutput> {
  const start = Date.now();

  // Read from Intent Gate output
  const intent = state.intent_summary;
  const primary_route = intent?.primary_route ?? 'SAY';
  const stance = intent?.stance ?? 'LENS';
  const learning_intent = intent?.learning_intent ?? false;

  // Route to sword if learning_intent is true AND stance is SWORD
  const route = (learning_intent === true && stance === 'SWORD') ? 'sword' : 'lens';

  console.log(`[STANCE] ${route} (learning_intent: ${learning_intent}, stance: ${stance})`);

  return {
    gateId: 'stance',
    status: 'pass',
    output: {
      route,
      primary_route,
      learning_intent,
    },
    action: 'continue',
    executionTimeMs: Date.now() - start,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// ASYNC VERSION WITH LLM CLASSIFICATION + REDIRECT
// ─────────────────────────────────────────────────────────────────────────────────

export async function executeStanceGateAsync(
  state: PipelineState,
  context: PipelineContext
): Promise<GateResult<StanceGateOutput>> {
  const start = Date.now();

  // Read from Intent Gate output
  const intent = state.intent_summary;
  const primary_route = intent?.primary_route ?? 'SAY';
  const stance = intent?.stance ?? 'LENS';
  const learning_intent = intent?.learning_intent ?? false;

  // Check for SWORD activation
  const isSwordMode = learning_intent === true && stance === 'SWORD';
  
  if (!isSwordMode) {
    // LENS mode: continue pipeline normally
    console.log(`[STANCE] lens (learning_intent: ${learning_intent}, stance: ${stance})`);
    
    return {
      gateId: 'stance',
      status: 'pass',
      output: {
        route: 'lens',
        primary_route,
        learning_intent: false,
      },
      action: 'continue',
      executionTimeMs: Date.now() - start,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SWORD MODE: LLM Classification + Redirect
  // ═══════════════════════════════════════════════════════════════════════════════
  
  console.log(`[STANCE] SWORD activated - classifying mode...`);
  
  // If no userId, can't classify - default to designer
  if (!context.userId) {
    console.log(`[STANCE] No userId - defaulting to designer mode`);
    
    return {
      gateId: 'stance',
      status: 'pass',
      output: {
        route: 'sword',
        primary_route,
        learning_intent: true,
        redirect: {
          target: 'swordgate',
          mode: 'designer',
          topic: extractTopicFallback(state.userMessage),
        },
      },
      action: 'redirect',
      executionTimeMs: Date.now() - start,
    };
  }

  // LLM classification
  const classification = await classifySwordMode(
    context.userId,
    state.userMessage
  );
  
  console.log(`[STANCE] Classified: ${classification.mode}` +
    (classification.planId ? ` (planId: ${classification.planId})` : '') +
    (classification.topic ? ` (topic: ${classification.topic})` : ''));

  // Build redirect
  const redirect: SwordRedirect = {
    target: 'swordgate',
    mode: classification.mode,
    planId: classification.planId,
    topic: classification.topic,
  };

  return {
    gateId: 'stance',
    status: 'pass',
    output: {
      route: 'sword',
      primary_route,
      learning_intent: true,
      redirect,
    },
    action: 'redirect',
    executionTimeMs: Date.now() - start,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Simple topic extraction when LLM is unavailable
 */
function extractTopicFallback(message: string): string | undefined {
  // Look for "learn X", "study X", "practice X" patterns
  const patterns = [
    /(?:learn|study|practice|master|understand)\s+(?:about\s+)?(.+?)(?:\.|$)/i,
    /(?:how to|want to)\s+(.+?)(?:\.|$)/i,
    /(?:teach me|help me with)\s+(.+?)(?:\.|$)/i,
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1].trim().slice(0, 100); // Cap at 100 chars
    }
  }
  
  return undefined;
}
