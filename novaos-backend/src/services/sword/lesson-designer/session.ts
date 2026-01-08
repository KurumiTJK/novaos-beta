// ═══════════════════════════════════════════════════════════════════════════════
// DESIGNER SESSION MANAGEMENT
// Dual phase tracking (user sees 4, system does 8)
// ═══════════════════════════════════════════════════════════════════════════════

import { getSupabase, isSupabaseInitialized } from '../../../db/index.js';
import type {
  DesignerSession,
  DesignerSessionRow,
  VisiblePhase,
  InternalPhase,
} from '../types.js';
import {
  mapDesignerSession,
  PHASE_MAPPING,
  INTERNAL_PHASE_ORDER,
  VISIBLE_PHASE_ORDER,
} from '../types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// PHASE TO COLUMN MAPPING
// Maps internal phase names to database column names
// ─────────────────────────────────────────────────────────────────────────────────

const PHASE_TO_COLUMN: Record<string, string> = {
  exploration: 'exploration_data',
  capstone: 'capstone_data',
  subskills: 'subskills_data',
  routing: 'routing_data',
  research: 'research_data',
  node_generation: 'nodes_data',  // Note: column is nodes_data, not node_generation_data
  sequencing: 'sequencing_data',
  method_nodes: 'method_nodes_data',
};

// ─────────────────────────────────────────────────────────────────────────────────
// USER ID HELPER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get internal UUID from external user ID (JWT user ID like "user_xxx")
 * Creates user if not exists
 */
async function getInternalUserId(externalId: string): Promise<string> {
  if (!isSupabaseInitialized()) {
    throw new Error('Database not initialized');
  }

  const supabase = getSupabase();

  // Try to find existing user by external_id
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('external_id', externalId)
    .single();

  if (existing) {
    return existing.id;
  }

  // User doesn't exist - create them with placeholder email
  const placeholderEmail = `${externalId}@novaos.local`;
  
  const { data: newUser, error: createError } = await supabase
    .from('users')
    .insert({
      external_id: externalId,
      email: placeholderEmail,
      tier: 'free',
    } as any)
    .select('id')
    .single();

  if (createError) {
    // Handle race condition - another request may have created the user
    if (createError.code === '23505') { // unique_violation
      const { data: retryUser } = await supabase
        .from('users')
        .select('id')
        .eq('external_id', externalId)
        .single();
      
      if (retryUser) {
        return retryUser.id;
      }
    }
    throw new Error(`Failed to create user: ${createError.message}`);
  }

  return newUser.id;
}

// ─────────────────────────────────────────────────────────────────────────────────
// SESSION CRUD
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get active designer session for user
 * @param externalUserId - JWT user ID (e.g., "user_xxx")
 */
export async function getActiveSession(externalUserId: string): Promise<DesignerSession | null> {
  if (!isSupabaseInitialized()) {
    return null;
  }

  // Get internal UUID from external ID
  let internalUserId: string;
  try {
    internalUserId = await getInternalUserId(externalUserId);
  } catch {
    return null; // User doesn't exist yet, no session possible
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('designer_sessions')
    .select('*')
    .eq('user_id', internalUserId)
    .is('completed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error?.code === 'PGRST116' || !data) {
    return null;
  }

  if (error) {
    throw new Error(`Failed to get session: ${error.message}`);
  }

  return mapDesignerSession(data as DesignerSessionRow);
}

/**
 * Get session by ID
 */
export async function getSessionById(sessionId: string): Promise<DesignerSession | null> {
  if (!isSupabaseInitialized()) {
    return null;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('designer_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error?.code === 'PGRST116' || !data) {
    return null;
  }

  return mapDesignerSession(data as DesignerSessionRow);
}

/**
 * Start a new designer session
 * @param externalUserId - JWT user ID (e.g., "user_xxx")
 * @param topicOrConversationId - Topic string or conversation ID
 */
export async function startSession(
  externalUserId: string,
  topicOrConversationId?: string
): Promise<DesignerSession> {
  if (!isSupabaseInitialized()) {
    throw new Error('Database not initialized');
  }

  // Get internal UUID from external ID (creates user if needed)
  const internalUserId = await getInternalUserId(externalUserId);

  // Check for existing active session
  const existing = await getActiveSession(externalUserId);
  if (existing) {
    throw new Error('An active designer session already exists. Cancel it first.');
  }

  // Determine if this is a topic or conversation ID
  const isTopic = topicOrConversationId && !topicOrConversationId.startsWith('conv-');
  const topic = isTopic ? topicOrConversationId : undefined;
  const conversationId = !isTopic ? topicOrConversationId : undefined;

  // Create initial exploration data if topic provided
  const explorationData = topic ? {
    learningGoal: topic,
    readyForCapstone: true,
  } : null;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('designer_sessions')
    .insert({
      user_id: internalUserId,
      conversation_id: conversationId,
      visible_phase: 'exploration',
      internal_phase: 'exploration',
      exploration_data: explorationData,
    } as any)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to start session: ${error.message}`);
  }

  return mapDesignerSession(data as DesignerSessionRow);
}

/**
 * Update session phase
 */
export async function updateSessionPhase(
  sessionId: string,
  internalPhase: InternalPhase,
  phaseData?: Record<string, any>
): Promise<DesignerSession> {
  if (!isSupabaseInitialized()) {
    throw new Error('Database not initialized');
  }

  const supabase = getSupabase();
  const visiblePhase = PHASE_MAPPING[internalPhase];

  // Build update payload
  const updates: Record<string, any> = {
    internal_phase: internalPhase,
    visible_phase: visiblePhase,
    updated_at: new Date().toISOString(),
  };

  // Add phase-specific data
  if (phaseData) {
    const dataKey = PHASE_TO_COLUMN[internalPhase] || `${internalPhase}_data`;
    updates[dataKey] = phaseData;
  }

  const { data, error } = await supabase
    .from('designer_sessions')
    .update(updates as any)
    .eq('id', sessionId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update session: ${error.message}`);
  }

  return mapDesignerSession(data as DesignerSessionRow);
}

/**
 * Update phase data without changing phase
 */
export async function updatePhaseData(
  sessionId: string,
  phaseKey: string,
  data: any
): Promise<DesignerSession> {
  if (!isSupabaseInitialized()) {
    throw new Error('Database not initialized');
  }

  // Map phase key to column name
  const columnName = PHASE_TO_COLUMN[phaseKey] || `${phaseKey}_data`;

  const supabase = getSupabase();
  const { data: result, error } = await supabase
    .from('designer_sessions')
    .update({
      [columnName]: data,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', sessionId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update phase data: ${error.message}`);
  }

  return mapDesignerSession(result as DesignerSessionRow);
}

/**
 * Link session to a plan
 */
export async function linkSessionToPlan(
  sessionId: string,
  planId: string
): Promise<DesignerSession> {
  if (!isSupabaseInitialized()) {
    throw new Error('Database not initialized');
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('designer_sessions')
    .update({
      plan_id: planId,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', sessionId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to link plan: ${error.message}`);
  }

  return mapDesignerSession(data as DesignerSessionRow);
}

/**
 * Complete session
 */
export async function completeSession(sessionId: string): Promise<DesignerSession> {
  if (!isSupabaseInitialized()) {
    throw new Error('Database not initialized');
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('designer_sessions')
    .update({
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', sessionId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to complete session: ${error.message}`);
  }

  return mapDesignerSession(data as DesignerSessionRow);
}

/**
 * Cancel session
 * @param externalUserId - JWT user ID (e.g., "user_xxx")
 */
export async function cancelSession(externalUserId: string): Promise<void> {
  console.log('[Session] Cancelling session for user:', externalUserId);
  
  if (!isSupabaseInitialized()) {
    console.log('[Session] Supabase not initialized, cannot cancel');
    return;
  }

  // Get internal UUID from external ID
  let internalUserId: string;
  try {
    internalUserId = await getInternalUserId(externalUserId);
  } catch (e) {
    console.log('[Session] User not found, nothing to cancel');
    return; // User doesn't exist, nothing to cancel
  }

  console.log('[Session] Internal user ID:', internalUserId);

  const supabase = getSupabase();
  const { error, count } = await supabase
    .from('designer_sessions')
    .delete()
    .eq('user_id', internalUserId)
    .is('completed_at', null);

  if (error) {
    console.error('[Session] Failed to delete session:', error);
    throw new Error(`Failed to cancel session: ${error.message}`);
  }

  console.log('[Session] Deleted sessions, count:', count);
}

// ─────────────────────────────────────────────────────────────────────────────────
// PHASE VALIDATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check if transition to new phase is valid
 */
export function isValidPhaseTransition(
  currentPhase: InternalPhase,
  targetPhase: InternalPhase
): boolean {
  const currentIndex = INTERNAL_PHASE_ORDER.indexOf(currentPhase);
  const targetIndex = INTERNAL_PHASE_ORDER.indexOf(targetPhase);

  // Can only move forward by one step, or stay at current
  return targetIndex === currentIndex || targetIndex === currentIndex + 1;
}

/**
 * Get next internal phase
 */
export function getNextInternalPhase(currentPhase: InternalPhase): InternalPhase | null {
  const index = INTERNAL_PHASE_ORDER.indexOf(currentPhase);
  if (index < 0 || index >= INTERNAL_PHASE_ORDER.length - 1) {
    return null;
  }
  const nextPhase = INTERNAL_PHASE_ORDER[index + 1];
  return nextPhase ?? null;
}

/**
 * Get required data for phase
 */
export function getPhaseRequirements(phase: InternalPhase): string[] {
  const phaseStr = phase as string;
  switch (phaseStr) {
    case 'exploration':
      return [];
    case 'capstone':
      return ['exploration_data'];
    case 'subskills':
      return ['capstone_data'];
    case 'routing':
      return ['subskills_data'];
    case 'research':
      return ['routing_data'];
    case 'node_generation':
      return ['research_data'];
    case 'sequencing':
      return ['nodes_data'];
    case 'method_nodes':
      return ['sequencing_data'];
    default:
      return [];
  }
}

/**
 * Check if session can proceed to next phase
 */
export function canProceedToPhase(
  session: DesignerSession,
  targetPhase: InternalPhase
): { canProceed: boolean; missingData: string[] } {
  // Check valid transition
  if (!isValidPhaseTransition(session.internalPhase, targetPhase)) {
    return { canProceed: false, missingData: ['invalid_transition'] };
  }

  // Check required data
  const requirements = getPhaseRequirements(targetPhase);
  const missingData: string[] = [];

  for (const req of requirements) {
    const dataKey = req.replace('_data', 'Data') as keyof DesignerSession;
    if (!session[dataKey]) {
      missingData.push(req);
    }
  }

  return {
    canProceed: missingData.length === 0,
    missingData,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// USER-FACING PHASE INFO
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get user-facing phase information
 */
export function getVisiblePhaseInfo(visiblePhase: VisiblePhase): {
  title: string;
  description: string;
  stepNumber: number;
  totalSteps: number;
} {
  const stepNumber = VISIBLE_PHASE_ORDER.indexOf(visiblePhase) + 1;

  // Use Partial to handle cases where phases may not be defined
  const info: Partial<Record<VisiblePhase, { title: string; description: string }>> & Record<string, { title: string; description: string }> = {
    exploration: {
      title: 'Exploration',
      description: 'Tell me what you want to learn',
    },
    define_goal: {
      title: 'Define Goal',
      description: "Let's define what success looks like",
    },
    research: {
      title: 'Research',
      description: 'Finding the best resources for you',
    },
    review: {
      title: 'Review',
      description: "Here's your personalized learning plan",
    },
  };

  const phaseInfo = info[visiblePhase] || { title: visiblePhase, description: '' };

  return {
    ...phaseInfo,
    stepNumber,
    totalSteps: VISIBLE_PHASE_ORDER.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const DesignerSessionManager = {
  getActive: getActiveSession,
  getById: getSessionById,
  start: startSession,
  updatePhase: updateSessionPhase,
  updatePhaseData,
  linkToPlan: linkSessionToPlan,
  complete: completeSession,
  cancel: cancelSession,
  isValidTransition: isValidPhaseTransition,
  getNextPhase: getNextInternalPhase,
  getRequirements: getPhaseRequirements,
  canProceed: canProceedToPhase,
  getVisibleInfo: getVisiblePhaseInfo,
};
