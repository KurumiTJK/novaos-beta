// ═══════════════════════════════════════════════════════════════════════════════
// EXPLORATION SERVICE
// Two-part flow: Orient (free chat) → Clarify (sort & fill)
// WITH STREAMING SUPPORT
// ═══════════════════════════════════════════════════════════════════════════════

import { SwordGateLLM } from '../llm/swordgate-llm.js';
import type { OnTokenCallback, OnThinkingCallback } from '../llm/streaming-utils.js';
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

async function getInternalUserId(externalId: string): Promise<string | null> {
  if (!isSupabaseInitialized()) return null;
  const supabase = getSupabase();
  const { data } = await supabase.from('users').select('id').eq('external_id', externalId).single();
  return data?.id || null;
}

async function getSession(sessionId: string): Promise<{
  id: string;
  userId: string;
  explorationState: ExplorationState | null;
} | null> {
  if (!isSupabaseInitialized()) return null;
  const supabase = getSupabase();
  const { data, error } = await supabase.from('designer_sessions').select('id, user_id, exploration_data').eq('id', sessionId).single();
  if (error || !data) return null;
  return { id: data.id, userId: data.user_id, explorationState: data.exploration_data as ExplorationState | null };
}

async function updateExplorationState(sessionId: string, state: ExplorationState): Promise<void> {
  if (!isSupabaseInitialized()) throw new Error('Database not initialized');
  const supabase = getSupabase();
  const { error } = await supabase.from('designer_sessions').update({ exploration_data: state, updated_at: new Date().toISOString() }).eq('id', sessionId);
  if (error) throw new Error(`Failed to update exploration state: ${error.message}`);
}

function getMissingFields(extracted: ExtractedData): ('learningGoal' | 'priorKnowledge')[] {
  const required = ['learningGoal', 'priorKnowledge'] as const;
  return required.filter(field => !extracted[field]);
}

// ─────────────────────────────────────────────────────────────────────────────────
// PART 1: ORIENT — Free conversation (NON-STREAMING)
// ─────────────────────────────────────────────────────────────────────────────────

export async function startExploration(sessionId: string, initialTopic?: string): Promise<{ message: string; state: ExplorationState }> {
  const session = await getSession(sessionId);
  if (!session) throw new Error('Session not found');

  const state: ExplorationState = {
    part: 'orient',
    messages: [],
    extracted: { learningGoal: null, priorKnowledge: null, context: null, constraints: [] },
    fieldSources: { learningGoal: null, priorKnowledge: null, context: null },
    missing: ['learningGoal', 'priorKnowledge'],
  };

  let response: string;

  if (initialTopic) {
    const openingPrompt = `The user wants to learn about: "${initialTopic}". Give them an expert overview and ask one question to understand their goal and motive.`;
    response = await SwordGateLLM.generate(ORIENT_SYSTEM_PROMPT, openingPrompt, { thinkingLevel: 'high' });
    state.messages.push({ role: 'user', content: `I want to learn ${initialTopic}`, timestamp: new Date().toISOString() });
  } else {
    response = `Hi — I'm Nova.\nI help break complex topics into clear, achievable learning paths.\n\nWhat would you like to learn?`;
  }

  state.messages.push({ role: 'assistant', content: response, timestamp: new Date().toISOString() });
  await updateExplorationState(sessionId, state);
  return { message: response, state };
}

export async function chatInOrient(sessionId: string, userMessage: string): Promise<{ response: string; state: ExplorationState }> {
  const session = await getSession(sessionId);
  if (!session) throw new Error('Session not found');
  const state = session.explorationState;
  if (!state) throw new Error('Exploration not started');
  if (state.part !== 'orient') throw new Error('Not in Orient phase');

  state.messages.push({ role: 'user', content: userMessage, timestamp: new Date().toISOString() });
  const history = state.messages.slice(0, -1).map(m => ({ role: m.role, content: m.content }));
  const response = await SwordGateLLM.converse(ORIENT_SYSTEM_PROMPT, history, userMessage, { thinkingLevel: 'high' });
  state.messages.push({ role: 'assistant', content: response, timestamp: new Date().toISOString() });
  await updateExplorationState(sessionId, state);
  return { response, state };
}

// ─────────────────────────────────────────────────────────────────────────────────
// STREAMING VERSIONS
// ─────────────────────────────────────────────────────────────────────────────────

export async function startExplorationStream(
  sessionId: string,
  initialTopic: string | undefined,
  onToken: OnTokenCallback,
  onThinking?: OnThinkingCallback
): Promise<{ message: string; state: ExplorationState }> {
  const session = await getSession(sessionId);
  if (!session) throw new Error('Session not found');

  const state: ExplorationState = {
    part: 'orient',
    messages: [],
    extracted: { learningGoal: null, priorKnowledge: null, context: null, constraints: [] },
    fieldSources: { learningGoal: null, priorKnowledge: null, context: null },
    missing: ['learningGoal', 'priorKnowledge'],
  };

  let response: string;

  if (initialTopic) {
    const openingPrompt = `The user wants to learn about: "${initialTopic}". Give them an expert overview and ask one question to understand their goal and motive.`;
    state.messages.push({ role: 'user', content: `I want to learn ${initialTopic}`, timestamp: new Date().toISOString() });
    response = await SwordGateLLM.generateStream(ORIENT_SYSTEM_PROMPT, openingPrompt, onToken, { thinkingLevel: 'high' }, onThinking);
  } else {
    response = `Hi — I'm Nova.\nI help break complex topics into clear, achievable learning paths.\n\nWhat would you like to learn?`;
    onToken(response);
  }

  state.messages.push({ role: 'assistant', content: response, timestamp: new Date().toISOString() });
  await updateExplorationState(sessionId, state);
  return { message: response, state };
}

export async function chatInOrientStream(
  sessionId: string,
  userMessage: string,
  onToken: OnTokenCallback,
  onThinking?: OnThinkingCallback
): Promise<{ response: string; state: ExplorationState }> {
  const session = await getSession(sessionId);
  if (!session) throw new Error('Session not found');
  const state = session.explorationState;
  if (!state) throw new Error('Exploration not started');
  if (state.part !== 'orient') throw new Error('Not in Orient phase');

  state.messages.push({ role: 'user', content: userMessage, timestamp: new Date().toISOString() });
  const history = state.messages.slice(0, -1).map(m => ({ role: m.role, content: m.content }));
  const response = await SwordGateLLM.converseStream(ORIENT_SYSTEM_PROMPT, history, userMessage, onToken, { thinkingLevel: 'high' }, onThinking);
  state.messages.push({ role: 'assistant', content: response, timestamp: new Date().toISOString() });
  await updateExplorationState(sessionId, state);
  return { response, state };
}

// ─────────────────────────────────────────────────────────────────────────────────
// TRANSITION: ORIENT → CLARIFY
// ─────────────────────────────────────────────────────────────────────────────────

export async function confirmOrient(sessionId: string): Promise<ClarifyResponse> {
  const session = await getSession(sessionId);
  if (!session) throw new Error('Session not found');
  const state = session.explorationState;
  if (!state) throw new Error('Exploration not started');
  if (state.part !== 'orient') throw new Error('Not in Orient phase');
  if (state.messages.length < 2) throw new Error('Need at least one exchange before confirming');

  const conversationText = formatConversationForSort(state.messages.map(m => ({ role: m.role, content: m.content })));
  const extractionResult = await SwordGateLLM.generate(SORT_SYSTEM_PROMPT, conversationText, { thinkingLevel: 'high' });

  let extracted: ExtractedData;
  try {
    let jsonStr = extractionResult;
    if (extractionResult.includes('```')) {
      const match = extractionResult.match(/```(?:json)?\s*([\s\S]*?)```/);
      jsonStr = match?.[1]?.trim() || extractionResult;
    }
    extracted = JSON.parse(jsonStr.trim());
  } catch {
    extracted = { learningGoal: null, priorKnowledge: null, context: null, constraints: [], confidence: { learningGoal: 0, priorKnowledge: 0, context: 0 } };
  }

  state.part = 'clarify';
  state.extracted = { learningGoal: extracted.learningGoal, priorKnowledge: extracted.priorKnowledge, context: extracted.context, constraints: extracted.constraints || [] };
  state.fieldSources = { learningGoal: extracted.learningGoal ? 'extracted' : null, priorKnowledge: extracted.priorKnowledge ? 'extracted' : null, context: extracted.context ? 'extracted' : null };
  state.missing = getMissingFields(extracted);
  await updateExplorationState(sessionId, state);

  return { extracted: state.extracted as ExtractedData, missing: state.missing, fieldSources: state.fieldSources };
}

// ─────────────────────────────────────────────────────────────────────────────────
// PART 2: CLARIFY — View and edit extracted data
// ─────────────────────────────────────────────────────────────────────────────────

export async function getClarifyData(sessionId: string): Promise<ClarifyResponse> {
  const session = await getSession(sessionId);
  if (!session) throw new Error('Session not found');
  const state = session.explorationState;
  if (!state) throw new Error('Exploration not started');
  if (state.part !== 'clarify') throw new Error('Not in Clarify phase');
  return { extracted: state.extracted as ExtractedData, missing: state.missing, fieldSources: state.fieldSources };
}

export async function updateField(sessionId: string, field: 'learningGoal' | 'priorKnowledge' | 'context', value: string): Promise<ClarifyResponse> {
  const session = await getSession(sessionId);
  if (!session) throw new Error('Session not found');
  const state = session.explorationState;
  if (!state) throw new Error('Exploration not started');
  if (state.part !== 'clarify') throw new Error('Not in Clarify phase');

  const wasFilled = state.extracted[field] !== null;
  state.extracted[field] = value || null;
  state.fieldSources[field] = wasFilled ? 'user_edited' : 'user_filled';
  state.missing = getMissingFields(state.extracted as ExtractedData);
  await updateExplorationState(sessionId, state);
  return { extracted: state.extracted as ExtractedData, missing: state.missing, fieldSources: state.fieldSources };
}

export async function updateConstraints(sessionId: string, constraints: string[]): Promise<ClarifyResponse> {
  const session = await getSession(sessionId);
  if (!session) throw new Error('Session not found');
  const state = session.explorationState;
  if (!state) throw new Error('Exploration not started');
  if (state.part !== 'clarify') throw new Error('Not in Clarify phase');

  state.extracted.constraints = constraints;
  await updateExplorationState(sessionId, state);
  return { extracted: state.extracted as ExtractedData, missing: state.missing, fieldSources: state.fieldSources };
}

export async function backToOrient(sessionId: string): Promise<ExplorationState> {
  const session = await getSession(sessionId);
  if (!session) throw new Error('Session not found');
  const state = session.explorationState;
  if (!state) throw new Error('Exploration not started');

  state.part = 'orient';
  state.extracted = { learningGoal: null, priorKnowledge: null, context: null, constraints: [] };
  state.fieldSources = { learningGoal: null, priorKnowledge: null, context: null };
  state.missing = ['learningGoal', 'priorKnowledge'];
  await updateExplorationState(sessionId, state);
  return state;
}

// ─────────────────────────────────────────────────────────────────────────────────
// TRANSITION: CLARIFY → DEFINE GOAL
// ─────────────────────────────────────────────────────────────────────────────────

export async function completeExploration(sessionId: string): Promise<ExplorationData> {
  const session = await getSession(sessionId);
  if (!session) throw new Error('Session not found');
  const state = session.explorationState;
  if (!state) throw new Error('Exploration not started');
  if (state.part !== 'clarify') throw new Error('Not in Clarify phase');
  if (!state.extracted.learningGoal) throw new Error('Learning goal is required');
  if (!state.extracted.priorKnowledge) throw new Error('Prior knowledge is required');

  return {
    learningGoal: state.extracted.learningGoal,
    priorKnowledge: state.extracted.priorKnowledge,
    context: state.extracted.context || '',
    constraints: state.extracted.constraints,
    readyForCapstone: true,
  };
}

export async function getExplorationState(sessionId: string): Promise<ExplorationState | null> {
  const session = await getSession(sessionId);
  return session?.explorationState || null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const ExplorationService = {
  start: startExploration,
  startStream: startExplorationStream,
  chat: chatInOrient,
  chatStream: chatInOrientStream,
  confirm: confirmOrient,
  getClarify: getClarifyData,
  updateField,
  updateConstraints,
  backToOrient,
  complete: completeExploration,
  getState: getExplorationState,
};

export default ExplorationService;
