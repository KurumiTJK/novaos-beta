// ═══════════════════════════════════════════════════════════════════════════════
// SWORD DESIGNER STORE — NovaOS
// Updated to match backend flow: Orient → Clarify → Goal → Skills → Path
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import {
  startExploration,
  exploreChat,
  confirmExploration,
  updateClarifyField,
  updateConstraints,
  continueToGoal,
  generateGoal,
  getReview,
  confirmReview,
  getActiveSession,
  deleteSession,
  activatePlan,
  type DesignerSession,
  type ClarifyData,
  type ClarifyResponse,
  type Capstone,
  type Subskill,
  type SubskillRouting,
  type LearningPlan,
  type ExplorationState,
  type ReviewState,
} from '../api/sword';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Designer phases matching backend flow:
 * - orient: Chat-based exploration (POST /explore/start, /explore/chat)
 * - clarify: Edit extracted fields (POST /explore/confirm, PATCH /explore/field)
 * - goal: Auto-generate capstone+subskills+routing (POST /explore/continue, /goal/generate)
 * - skills: Review generated plan (GET /review)
 * - path: Plan created, ready to activate (POST /review/confirm)
 */
export type DesignerPhase = 
  | 'orient'      // Chat-based exploration
  | 'clarify'     // Edit fields
  | 'goal'        // Auto-generating (loading state)
  | 'skills'      // Review subskills + routing
  | 'path';       // Plan created

export interface OrientMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface DesignerStore {
  // ─────────────────────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────────────────────
  
  /** Current designer phase */
  phase: DesignerPhase;
  /** Session ID from backend */
  sessionId: string | null;
  /** Whether we're loading/processing */
  isLoading: boolean;
  /** Whether goal is being generated (long operation) */
  isGenerating: boolean;
  /** Error message if any */
  error: string | null;
  
  // Orient phase state
  /** Chat messages in orient phase */
  orientMessages: OrientMessage[];
  /** Backend exploration state */
  explorationState: ExplorationState | null;
  
  // Clarify phase state
  /** Clarify form data */
  clarifyData: ClarifyData | null;
  /** Field sources (extracted vs user_edited) */
  fieldSources: Record<string, string>;
  /** Missing required fields */
  missingFields: string[];
  /** Whether clarify data can be finalized */
  canFinalize: boolean;
  
  // Goal phase state (auto-generated)
  /** Generated capstone */
  capstone: Capstone | null;
  /** Generated subskills */
  subskills: Subskill[];
  /** Generated routing */
  routing: SubskillRouting[];
  
  // Skills/Review phase state
  /** Review data from backend */
  reviewData: ReviewState | null;
  
  // Path phase state
  /** Created learning plan */
  plan: LearningPlan | null;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────────────────────────
  
  /** Initialize designer - check for existing session or start new */
  initialize: (topic?: string) => Promise<void>;
  /** Reset designer to initial state */
  reset: () => void;
  /** Abandon current session */
  abandon: () => Promise<void>;
  
  // Orient phase actions
  /** Send message in orient chat */
  sendOrientMessage: (message: string) => Promise<void>;
  /** Confirm orient and move to clarify */
  confirmOrient: () => Promise<void>;
  
  // Clarify phase actions
  /** Update a clarify field */
  updateField: (field: 'learningGoal' | 'priorKnowledge' | 'context', value: string) => Promise<void>;
  /** Update constraints */
  updateConstraintsAction: (constraints: string[]) => Promise<void>;
  /** Finalize clarify → auto-generate goal */
  finalizeClarify: () => Promise<void>;
  
  // Skills phase actions
  /** Load review data (called after goal generation) */
  loadReview: () => Promise<void>;
  
  // Path phase actions
  /** Confirm skills and create plan */
  confirmSkills: () => Promise<void>;
  /** Activate the created plan */
  activateCreatedPlan: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────────

const initialState = {
  phase: 'orient' as DesignerPhase,
  sessionId: null,
  isLoading: false,
  isGenerating: false,
  error: null,
  orientMessages: [],
  explorationState: null,
  clarifyData: null,
  fieldSources: {},
  missingFields: [],
  canFinalize: false,
  capstone: null,
  subskills: [],
  routing: [],
  reviewData: null,
  plan: null,
};

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER: Extract ClarifyData from various response formats
// ─────────────────────────────────────────────────────────────────────────────────

function extractClarifyData(result: ClarifyResponse): ClarifyData {
  // Backend might return { extracted: {...} }, { data: {...} }, or direct fields
  const source = result.extracted || result.data || result;
  
  return {
    learningGoal: (source as any).learningGoal || '',
    priorKnowledge: (source as any).priorKnowledge || '',
    context: (source as any).context || '',
    constraints: (source as any).constraints || [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────────

export const useSwordDesignerStore = create<DesignerStore>((set, get) => ({
  ...initialState,

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZE
  // ═══════════════════════════════════════════════════════════════════════════
  
  initialize: async (topic?: string) => {
    set({ isLoading: true, error: null });
    
    try {
      // Check for existing session first
      const existingSession = await getActiveSession();
      
      if (existingSession) {
        console.log('[DESIGNER] Found existing session:', existingSession.id, existingSession.phase);
        // Restore state from existing session
        await restoreSessionState(existingSession, set);
        return;
      }
      
      // Start new exploration
      console.log('[DESIGNER] Starting new exploration with topic:', topic);
      const result = await startExploration(topic);
      
      set({
        sessionId: result.sessionId,
        phase: 'orient',
        explorationState: result.state,
        orientMessages: [
          { role: 'assistant', content: result.message }
        ],
        isLoading: false,
      });
    } catch (error) {
      console.error('[DESIGNER] Initialize failed:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to initialize designer',
      });
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // RESET
  // ═══════════════════════════════════════════════════════════════════════════
  
  reset: () => {
    set(initialState);
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ABANDON
  // ═══════════════════════════════════════════════════════════════════════════
  
  abandon: async () => {
    const { sessionId } = get();
    
    if (sessionId) {
      try {
        await deleteSession();
      } catch (error) {
        console.warn('[DESIGNER] Failed to delete session:', error);
      }
    }
    
    set(initialState);
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ORIENT PHASE
  // ═══════════════════════════════════════════════════════════════════════════
  
  sendOrientMessage: async (message: string) => {
    const { sessionId, orientMessages } = get();
    
    if (!sessionId) {
      set({ error: 'No active session' });
      return;
    }
    
    // Add user message immediately
    set({
      orientMessages: [...orientMessages, { role: 'user', content: message }],
      isLoading: true,
      error: null,
    });
    
    try {
      const result = await exploreChat(sessionId, message);
      
      set((state) => ({
        orientMessages: [
          ...state.orientMessages,
          { role: 'assistant', content: result.response }
        ],
        explorationState: result.state,
        isLoading: false,
      }));
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to send message',
      });
    }
  },

  confirmOrient: async () => {
    const { sessionId } = get();
    
    if (!sessionId) {
      set({ error: 'No active session' });
      return;
    }
    
    set({ isLoading: true, error: null });
    
    try {
      const result = await confirmExploration(sessionId);
      
      // Extract clarify data from response (handles multiple formats)
      const clarifyData = extractClarifyData(result);
      
      // Calculate canFinalize locally
      const canFinalize = !!(clarifyData.learningGoal && clarifyData.priorKnowledge);
      
      console.log('[DESIGNER] Confirm orient result:', result);
      console.log('[DESIGNER] Clarify data:', clarifyData, 'canFinalize:', canFinalize);
      
      set({
        phase: 'clarify',
        clarifyData,
        fieldSources: (result as any).fieldSources || {},
        missingFields: (result as any).missing || [],
        canFinalize,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to confirm exploration',
      });
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CLARIFY PHASE
  // ═══════════════════════════════════════════════════════════════════════════
  
  updateField: async (field, value) => {
    const { sessionId, clarifyData } = get();
    
    if (!sessionId) {
      set({ error: 'No active session' });
      return;
    }
    
    // Optimistic update with local canFinalize calculation
    const newClarifyData = clarifyData 
      ? { ...clarifyData, [field]: value }
      : { learningGoal: '', priorKnowledge: '', context: '', constraints: [], [field]: value };
    
    const newCanFinalize = !!(newClarifyData.learningGoal && newClarifyData.priorKnowledge);
    
    set({
      clarifyData: newClarifyData,
      fieldSources: { ...get().fieldSources, [field]: 'user_edited' },
      canFinalize: newCanFinalize,
    });
    
    try {
      // API call - we don't need to use the response for state since we've already updated optimistically
      await updateClarifyField(sessionId, field, value);
      console.log('[DESIGNER] Field updated:', field, '→', value, 'canFinalize:', newCanFinalize);
    } catch (error) {
      // Revert on error
      set({
        clarifyData,
        canFinalize: !!(clarifyData?.learningGoal && clarifyData?.priorKnowledge),
        error: error instanceof Error ? error.message : 'Failed to update field',
      });
    }
  },

  updateConstraintsAction: async (constraints) => {
    const { sessionId, clarifyData } = get();
    
    if (!sessionId) {
      set({ error: 'No active session' });
      return;
    }
    
    // Optimistic update
    const newClarifyData = clarifyData 
      ? { ...clarifyData, constraints }
      : { learningGoal: '', priorKnowledge: '', context: '', constraints };
    
    set({
      clarifyData: newClarifyData,
    });
    
    try {
      await updateConstraints(sessionId, constraints);
      console.log('[DESIGNER] Constraints updated:', constraints);
    } catch (error) {
      // Revert on error
      set({
        clarifyData,
        error: error instanceof Error ? error.message : 'Failed to update constraints',
      });
    }
  },

  /**
   * Finalize clarify → moves to goal phase → auto-generates everything
   * Flow: POST /explore/continue → POST /goal/generate → GET /review
   */
  finalizeClarify: async () => {
    const { sessionId } = get();
    
    if (!sessionId) {
      set({ error: 'No active session' });
      return;
    }
    
    set({ 
      phase: 'goal',
      isLoading: true, 
      isGenerating: true,
      error: null 
    });
    
    try {
      // Step 1: Move to goal phase
      console.log('[DESIGNER] Moving to goal phase...');
      await continueToGoal(sessionId);
      
      // Step 2: Generate capstone + subskills + routing
      console.log('[DESIGNER] Generating goal (this may take ~60s)...');
      const goalResult = await generateGoal(sessionId);
      
      set({
        capstone: goalResult.capstone,
        subskills: goalResult.subskills || [],
        routing: goalResult.routing || [],
      });
      
      // Step 3: Get review data with session distribution
      console.log('[DESIGNER] Loading review data...');
      const reviewResult = await getReview(sessionId);
      
      set({
        phase: 'skills',
        reviewData: reviewResult,
        isLoading: false,
        isGenerating: false,
      });
    } catch (error) {
      console.error('[DESIGNER] Goal generation failed:', error);
      set({
        phase: 'clarify', // Go back to clarify on error
        isLoading: false,
        isGenerating: false,
        error: error instanceof Error ? error.message : 'Failed to generate learning plan',
      });
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SKILLS PHASE (Review)
  // ═══════════════════════════════════════════════════════════════════════════
  
  loadReview: async () => {
    const { sessionId } = get();
    
    if (!sessionId) {
      set({ error: 'No active session' });
      return;
    }
    
    set({ isLoading: true, error: null });
    
    try {
      const reviewResult = await getReview(sessionId);
      
      set({
        reviewData: reviewResult,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load review',
      });
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PATH PHASE (Create Plan)
  // ═══════════════════════════════════════════════════════════════════════════
  
  confirmSkills: async () => {
    const { sessionId } = get();
    
    if (!sessionId) {
      set({ error: 'No active session' });
      return;
    }
    
    set({ isLoading: true, error: null });
    
    try {
      console.log('[DESIGNER] Creating plan...');
      const result = await confirmReview(sessionId);
      
      set({
        phase: 'path',
        plan: result.plan,
        isLoading: false,
      });
    } catch (error) {
      console.error('[DESIGNER] Plan creation failed:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to create plan',
      });
    }
  },

  activateCreatedPlan: async () => {
    const { plan } = get();
    
    if (!plan) {
      set({ error: 'No plan to activate' });
      return;
    }
    
    set({ isLoading: true, error: null });
    
    try {
      await activatePlan(plan.id);
      console.log('[DESIGNER] Plan activated:', plan.id);
      
      // Reset designer state after activation
      set(initialState);
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to activate plan',
      });
    }
  },
}));

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER: Restore session state from existing session
// ─────────────────────────────────────────────────────────────────────────────────

async function restoreSessionState(
  session: DesignerSession,
  set: (state: Partial<DesignerStore> | ((state: DesignerStore) => Partial<DesignerStore>)) => void
) {
  // Backend uses visiblePhase and internalPhase, NOT phase
  const backendPhase = session.internalPhase || session.visiblePhase || session.phase || 'exploration';
  
  // Determine frontend phase based on backend state
  let phase = mapBackendPhaseToLocal(backendPhase);
  
  // Special case: 'exploration' can be either orient or clarify
  // Check explorationData to determine which one
  if (backendPhase === 'exploration' && session.explorationData) {
    // If we have exploration data with learningGoal filled, we're in clarify
    if (session.explorationData.learningGoal || session.explorationData.readyForCapstone) {
      phase = 'clarify';
    }
  }
  
  console.log('[DESIGNER] Restoring session to phase:', phase, 'backendPhase:', backendPhase, 'session:', session);
  
  // Build base state
  const state: Partial<DesignerStore> = {
    sessionId: session.id,
    phase,
    isLoading: false,
  };
  
  // Restore capstone from either capstoneData or capstone field
  const capstoneSource = session.capstoneData || session.capstone;
  if (capstoneSource) {
    state.capstone = {
      id: (capstoneSource as any).id || session.id,
      title: (capstoneSource as any).title || '',
      description: (capstoneSource as any).capstoneStatement || (capstoneSource as any).description || '',
      successCriteria: (capstoneSource as any).successCriteria || [],
    };
  }
  
  // Restore subskills from either subskillsData or subskills field
  const subskillsSource = session.subskillsData?.subskills || session.subskills;
  if (subskillsSource && subskillsSource.length > 0) {
    state.subskills = subskillsSource;
  }
  
  // Restore routing from either routingData or routing field
  const routingSource = session.routingData?.assignments || session.routing;
  if (routingSource && routingSource.length > 0) {
    state.routing = routingSource;
  }
  
  // Handle clarify phase - use explorationData from session
  // Always initialize clarifyData when in clarify phase
  if (phase === 'clarify') {
    const data = session.explorationData || {};
    state.clarifyData = {
      learningGoal: data.learningGoal || '',
      priorKnowledge: data.priorKnowledge || '',
      context: data.context || '',
      constraints: data.constraints || [],
    };
    // Check if we can finalize (learningGoal AND priorKnowledge are required)
    state.canFinalize = !!(state.clarifyData.learningGoal && state.clarifyData.priorKnowledge);
    console.log('[DESIGNER] Restored clarify data:', state.clarifyData, 'canFinalize:', state.canFinalize);
  }
  
  // Handle skills/review phase - fetch review data
  if (phase === 'skills') {
    try {
      const reviewResult = await getReview(session.id);
      state.reviewData = reviewResult;
    } catch (error) {
      console.warn('[DESIGNER] Failed to fetch review data:', error);
    }
  }
  
  set(state);
}

// Map backend phase to local phase
// Backend internalPhase values: exploration, capstone, subskills, routing
// Backend visiblePhase values: exploration, define_goal, research, review
function mapBackendPhaseToLocal(backendPhase: string): DesignerPhase {
  const mapping: Record<string, DesignerPhase> = {
    // Internal phases
    'exploration': 'orient',  // Will be overridden to 'clarify' if has explorationData
    'capstone': 'goal',
    'subskills': 'goal',
    'routing': 'skills',
    
    // Visible phases
    'define_goal': 'goal',
    'research': 'goal',
    'review': 'skills',
    
    // Frontend phases (for completeness)
    'orient': 'orient',
    'clarify': 'clarify',
    'goal': 'goal',
    'skills': 'skills',
    'path': 'path',
    'complete': 'path',
  };
  
  return mapping[backendPhase] || 'orient';
}

// ─────────────────────────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────────────────────────

export const selectPhaseIndex = (phase: DesignerPhase): number => {
  const phases: DesignerPhase[] = ['orient', 'clarify', 'goal', 'skills', 'path'];
  return phases.indexOf(phase);
};

export const selectIsPhaseComplete = (currentPhase: DesignerPhase, targetPhase: DesignerPhase): boolean => {
  return selectPhaseIndex(currentPhase) > selectPhaseIndex(targetPhase);
};

export const selectPhaseLabel = (phase: DesignerPhase): string => {
  const labels: Record<DesignerPhase, string> = {
    'orient': 'Explore',
    'clarify': 'Clarify',
    'goal': 'Goal',
    'skills': 'Skills',
    'path': 'Path',
  };
  return labels[phase];
};
