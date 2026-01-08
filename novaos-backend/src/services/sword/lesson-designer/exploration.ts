// ═══════════════════════════════════════════════════════════════════════════════
// EXPLORATION SERVICE
// Two-part flow: Orient (free chat) → Clarify (sort & fill)
// ═══════════════════════════════════════════════════════════════════════════════

import { SwordGateLLM } from '../llm/swordgate-llm.js';
import { 
  ORIENT_SYSTEM_PROMPT, 
  SORT_SYSTEM_PROMPT,
  formatConversationForSort,
} from '../llm/prompts/exploration.js';
import { getSupabase, isSupabaseInitialized } from '../../../db/index.js';
import type { ExplorationState, ExplorationData } from '../types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

interface ExplorationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ExtractedData {
  learningGoal: string | null;
  priorKnowledge: string | null;
  context: string | null;
  constraints: string[];
  confidence: {
    learningGoal: number;
    priorKnowledge: number;
    context: number;
  };
}

interface ClarifyResponse {
  extracted: ExtractedData;
  missing: string[];
  fieldSources: Record<string, 'extracted' | 'user_filled' | 'user_edited' | null>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get internal user ID from external ID
 */
async function getInternalUserId(externalId: string): Promise<string | null> {
  if (!isSupabaseInitialized()) return null;
  
  const supabase = getSupabase();
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('external_id', externalId)
    .single();
  
  return data?.id || null;
}

/**
 * Get designer session with exploration state
 */
async function getSession(sessionId: string): Promise<{
  id: string;
  userId: string;
  explorationState: ExplorationState | null;
} | null> {
  if (!isSupabaseInitialized()) return null;
  
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('designer_sessions')
    .select('id, user_id, exploration_data')
    .eq('id', sessionId)
    .single();
  
  if (error || !data) return null;
  
  return {
    id: data.id,
    userId: data.user_id,
    explorationState: data.exploration_data as ExplorationState | null,
  };
}

/**
 * Update exploration state in session
 */
async function updateExplorationState(
  sessionId: string, 
  state: ExplorationState
): Promise<void> {
  if (!isSupabaseInitialized()) {
    throw new Error('Database not initialized');
  }
  
  const supabase = getSupabase();
  const { error } = await supabase
    .from('designer_sessions')
    .update({ 
      exploration_data: state,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);
  
  if (error) {
    throw new Error(`Failed to update exploration state: ${error.message}`);
  }
}

/**
 * Get required fields that are missing
 */
function getMissingFields(extracted: ExtractedData): string[] {
  const required = ['learningGoal', 'priorKnowledge'] as const;
  return required.filter(field => !extracted[field]);
}

// ─────────────────────────────────────────────────────────────────────────────────
// PART 1: ORIENT — Free conversation
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Start exploration (creates initial state in Orient phase)
 */
export async function startExploration(
  sessionId: string,
  initialTopic?: string
): Promise<{ message: string; state: ExplorationState }> {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  // Create initial state
  const state: ExplorationState = {
    part: 'orient',
    messages: [],
    extracted: {
      learningGoal: null,
      priorKnowledge: null,
      context: null,
      constraints: [],
    },
    fieldSources: {
      learningGoal: null,
      priorKnowledge: null,
      context: null,
    },
    missing: ['learningGoal', 'priorKnowledge'],
  };

  let response: string;

  if (initialTopic) {
    // Topic provided — use LLM to generate contextual response
    const openingPrompt = `The user wants to learn about: "${initialTopic}". Give them an expert overview and ask one question to understand their goal and motive.`;
    
    response = await SwordGateLLM.generate(
      ORIENT_SYSTEM_PROMPT,
      openingPrompt,
      { thinkingLevel: 'high' }
    );

    // Add user message first, then assistant response
    state.messages.push({
      role: 'user',
      content: `I want to learn ${initialTopic}`,
      timestamp: new Date().toISOString(),
    });
  } else {
    // No topic — use hardcoded opening message
    response = `Hi — I'm Nova.
I help break complex topics into clear, achievable learning paths.

What would you like to learn?`;
  }

  // Add assistant message to state
  state.messages.push({
    role: 'assistant',
    content: response,
    timestamp: new Date().toISOString(),
  });

  await updateExplorationState(sessionId, state);

  return { message: response, state };
}

/**
 * Chat in Orient phase (unlimited turns)
 */
export async function chatInOrient(
  sessionId: string,
  userMessage: string
): Promise<{ response: string; state: ExplorationState }> {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const state = session.explorationState;
  if (!state) {
    throw new Error('Exploration not started');
  }

  if (state.part !== 'orient') {
    throw new Error('Not in Orient phase');
  }

  // Add user message
  state.messages.push({
    role: 'user',
    content: userMessage,
    timestamp: new Date().toISOString(),
  });

  // Build conversation history for LLM
  const history = state.messages.slice(0, -1).map(m => ({
    role: m.role,
    content: m.content,
  }));

  // Get response from LLM
  const response = await SwordGateLLM.converse(
    ORIENT_SYSTEM_PROMPT,
    history,
    userMessage,
    { thinkingLevel: 'high' }
  );

  // Add assistant response
  state.messages.push({
    role: 'assistant',
    content: response,
    timestamp: new Date().toISOString(),
  });

  await updateExplorationState(sessionId, state);

  return { response, state };
}

// ─────────────────────────────────────────────────────────────────────────────────
// TRANSITION: ORIENT → CLARIFY
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Confirm Orient phase and extract data (moves to Clarify)
 */
export async function confirmOrient(
  sessionId: string
): Promise<ClarifyResponse> {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const state = session.explorationState;
  if (!state) {
    throw new Error('Exploration not started');
  }

  if (state.part !== 'orient') {
    throw new Error('Not in Orient phase');
  }

  if (state.messages.length < 2) {
    throw new Error('Need at least one exchange before confirming');
  }

  // Format conversation for extraction
  const conversationText = formatConversationForSort(
    state.messages.map(m => ({ role: m.role, content: m.content }))
  );

  // Call LLM to extract structured data
  const extractionResult = await SwordGateLLM.generate(
    SORT_SYSTEM_PROMPT,
    conversationText,
    { thinkingLevel: 'high' }
  );

  // Parse JSON response
  let extracted: ExtractedData;
  try {
    // Handle potential markdown code blocks
    let jsonStr = extractionResult;
    if (extractionResult.includes('```')) {
      const match = extractionResult.match(/```(?:json)?\s*([\s\S]*?)```/);
      jsonStr = match?.[1]?.trim() || extractionResult;
    }
    extracted = JSON.parse(jsonStr.trim());
  } catch (error) {
    console.error('[EXPLORATION] Failed to parse extraction result:', error);
    console.error('[EXPLORATION] Raw result:', extractionResult);
    // Default to empty extraction
    extracted = {
      learningGoal: null,
      priorKnowledge: null,
      context: null,
      constraints: [],
      confidence: {
        learningGoal: 0,
        priorKnowledge: 0,
        context: 0,
      },
    };
  }

  // Update state to Clarify phase
  state.part = 'clarify';
  state.extracted = {
    learningGoal: extracted.learningGoal,
    priorKnowledge: extracted.priorKnowledge,
    context: extracted.context,
    constraints: extracted.constraints || [],
  };
  state.fieldSources = {
    learningGoal: extracted.learningGoal ? 'extracted' : null,
    priorKnowledge: extracted.priorKnowledge ? 'extracted' : null,
    context: extracted.context ? 'extracted' : null,
  };
  state.missing = getMissingFields(extracted);

  await updateExplorationState(sessionId, state);

  return {
    extracted: state.extracted as ExtractedData,
    missing: state.missing,
    fieldSources: state.fieldSources,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// PART 2: CLARIFY — View and edit extracted data
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get current clarify state
 */
export async function getClarifyData(
  sessionId: string
): Promise<ClarifyResponse> {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const state = session.explorationState;
  if (!state) {
    throw new Error('Exploration not started');
  }

  if (state.part !== 'clarify') {
    throw new Error('Not in Clarify phase');
  }

  return {
    extracted: state.extracted as ExtractedData,
    missing: state.missing,
    fieldSources: state.fieldSources,
  };
}

/**
 * Update a field (fill empty or edit existing)
 */
export async function updateField(
  sessionId: string,
  field: 'learningGoal' | 'priorKnowledge' | 'context',
  value: string
): Promise<ClarifyResponse> {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const state = session.explorationState;
  if (!state) {
    throw new Error('Exploration not started');
  }

  if (state.part !== 'clarify') {
    throw new Error('Not in Clarify phase');
  }

  // Determine if this is a fill or edit
  const wasFilled = state.extracted[field] !== null;
  
  // Update the field
  state.extracted[field] = value || null;
  state.fieldSources[field] = wasFilled ? 'user_edited' : 'user_filled';
  
  // Recalculate missing fields
  state.missing = getMissingFields(state.extracted as ExtractedData);

  await updateExplorationState(sessionId, state);

  return {
    extracted: state.extracted as ExtractedData,
    missing: state.missing,
    fieldSources: state.fieldSources,
  };
}

/**
 * Update constraints array
 */
export async function updateConstraints(
  sessionId: string,
  constraints: string[]
): Promise<ClarifyResponse> {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const state = session.explorationState;
  if (!state) {
    throw new Error('Exploration not started');
  }

  if (state.part !== 'clarify') {
    throw new Error('Not in Clarify phase');
  }

  state.extracted.constraints = constraints;

  await updateExplorationState(sessionId, state);

  return {
    extracted: state.extracted as ExtractedData,
    missing: state.missing,
    fieldSources: state.fieldSources,
  };
}

/**
 * Go back to Orient phase (keep messages, clear extracted)
 */
export async function backToOrient(
  sessionId: string
): Promise<ExplorationState> {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const state = session.explorationState;
  if (!state) {
    throw new Error('Exploration not started');
  }

  // Reset to orient, keep messages
  state.part = 'orient';
  state.extracted = {
    learningGoal: null,
    priorKnowledge: null,
    context: null,
    constraints: [],
  };
  state.fieldSources = {
    learningGoal: null,
    priorKnowledge: null,
    context: null,
  };
  state.missing = ['learningGoal', 'priorKnowledge'];

  await updateExplorationState(sessionId, state);

  return state;
}

// ─────────────────────────────────────────────────────────────────────────────────
// TRANSITION: CLARIFY → DEFINE GOAL
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Complete exploration and move to Define Goal phase
 * Returns the final ExplorationData for capstone generation
 */
export async function completeExploration(
  sessionId: string
): Promise<ExplorationData> {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const state = session.explorationState;
  if (!state) {
    throw new Error('Exploration not started');
  }

  if (state.part !== 'clarify') {
    throw new Error('Not in Clarify phase');
  }

  // Validate required fields
  if (!state.extracted.learningGoal) {
    throw new Error('Learning goal is required');
  }
  if (!state.extracted.priorKnowledge) {
    throw new Error('Prior knowledge is required');
  }

  // Build final ExplorationData for capstone
  const explorationData: ExplorationData = {
    learningGoal: state.extracted.learningGoal,
    priorKnowledge: state.extracted.priorKnowledge,
    context: state.extracted.context || '',
    constraints: state.extracted.constraints,
    readyForCapstone: true,
  };

  // Update session to mark exploration complete
  // The session phase will be updated by the caller (route handler)
  
  return explorationData;
}

// ─────────────────────────────────────────────────────────────────────────────────
// GET FULL STATE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get full exploration state
 */
export async function getExplorationState(
  sessionId: string
): Promise<ExplorationState | null> {
  const session = await getSession(sessionId);
  return session?.explorationState || null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const ExplorationService = {
  // Part 1: Orient
  start: startExploration,
  chat: chatInOrient,
  confirm: confirmOrient,
  
  // Part 2: Clarify
  getClarify: getClarifyData,
  updateField,
  updateConstraints,
  backToOrient,
  
  // Complete
  complete: completeExploration,
  
  // Utils
  getState: getExplorationState,
};

export default ExplorationService;
