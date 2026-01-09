// ═══════════════════════════════════════════════════════════════════════════════
// SWORD DESIGNER STORE — NovaOS
// Manages the lesson plan creation flow
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import {
  startExploration,
  exploreChat,
  confirmExploration,
  getClarifyData,
  updateClarifyField,
  updateConstraints,
  finalizeExploration,
  confirmCapstone,
  generateSubskills,
  confirmSubskills,
  generateRouting,
  confirmRouting,
  getActiveSession,
  deleteSession,
  type DesignerSession,
  type ClarifyData,
  type Capstone,
  type Subskill,
  type SubskillRouting,
  type LearningPlan,
  type ExplorationState,
} from '../api/sword';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type DesignerPhase = 
  | 'orient'      // Chat-based exploration
  | 'clarify'     // Edit fields
  | 'capstone'    // Review/confirm capstone
  | 'subskills'   // Review/confirm subskills
  | 'routing'     // Review/confirm routing
  | 'complete';   // Plan created

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
  /** Whether clarify data can be finalized */
  canFinalize: boolean;
  
  // Capstone phase state
  /** Generated capstone */
  capstone: Capstone | null;
  
  // Subskills phase state
  /** Generated subskills */
  subskills: Subskill[];
  
  // Routing phase state
  /** Generated routing */
  routing: SubskillRouting[];
  
  // Complete phase state
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
  updateConstraintsAction: (constraints: Partial<ClarifyData['constraints']>) => Promise<void>;
  /** Finalize clarify and generate capstone */
  finalizeClarify: () => Promise<void>;
  
  // Capstone phase actions
  /** Confirm capstone and generate subskills */
  confirmCapstoneAction: () => Promise<void>;
  
  // Subskills phase actions
  /** Confirm subskills and generate routing */
  confirmSubskillsAction: () => Promise<void>;
  
  // Routing phase actions
  /** Confirm routing and create plan */
  confirmRoutingAction: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────────

const initialState = {
  phase: 'orient' as DesignerPhase,
  sessionId: null,
  isLoading: false,
  error: null,
  orientMessages: [],
  explorationState: null,
  clarifyData: null,
  canFinalize: false,
  capstone: null,
  subskills: [],
  routing: [],
  plan: null,
};

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
        // Restore state from existing session
        await restoreSessionState(existingSession, set);
        return;
      }
      
      // Start new exploration
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
        await deleteSession(sessionId);
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
      
      set({
        phase: 'clarify',
        clarifyData: result.data,
        canFinalize: result.canFinalize,
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
    const { sessionId } = get();
    
    if (!sessionId) {
      set({ error: 'No active session' });
      return;
    }
    
    // Optimistic update
    set((state) => ({
      clarifyData: state.clarifyData 
        ? { ...state.clarifyData, [field]: value }
        : null,
    }));
    
    try {
      const result = await updateClarifyField(sessionId, field, value);
      set({ clarifyData: result });
    } catch (error) {
      // Revert on error (would need to store previous value)
      set({
        error: error instanceof Error ? error.message : 'Failed to update field',
      });
    }
  },

  updateConstraintsAction: async (constraints) => {
    const { sessionId } = get();
    
    if (!sessionId) {
      set({ error: 'No active session' });
      return;
    }
    
    // Optimistic update
    set((state) => ({
      clarifyData: state.clarifyData 
        ? { 
            ...state.clarifyData, 
            constraints: { ...state.clarifyData.constraints, ...constraints }
          }
        : null,
    }));
    
    try {
      const result = await updateConstraints(sessionId, constraints);
      set({ clarifyData: result });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update constraints',
      });
    }
  },

  finalizeClarify: async () => {
    const { sessionId } = get();
    
    if (!sessionId) {
      set({ error: 'No active session' });
      return;
    }
    
    set({ isLoading: true, error: null });
    
    try {
      const result = await finalizeExploration(sessionId);
      
      set({
        phase: 'capstone',
        capstone: result.capstone,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to generate capstone',
      });
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CAPSTONE PHASE
  // ═══════════════════════════════════════════════════════════════════════════
  
  confirmCapstoneAction: async () => {
    const { sessionId } = get();
    
    if (!sessionId) {
      set({ error: 'No active session' });
      return;
    }
    
    set({ isLoading: true, error: null });
    
    try {
      await confirmCapstone(sessionId);
      const result = await generateSubskills(sessionId);
      
      set({
        phase: 'subskills',
        subskills: result.subskills,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to generate subskills',
      });
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBSKILLS PHASE
  // ═══════════════════════════════════════════════════════════════════════════
  
  confirmSubskillsAction: async () => {
    const { sessionId } = get();
    
    if (!sessionId) {
      set({ error: 'No active session' });
      return;
    }
    
    set({ isLoading: true, error: null });
    
    try {
      await confirmSubskills(sessionId);
      const result = await generateRouting(sessionId);
      
      set({
        phase: 'routing',
        routing: result.routing,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to generate routing',
      });
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ROUTING PHASE
  // ═══════════════════════════════════════════════════════════════════════════
  
  confirmRoutingAction: async () => {
    const { sessionId } = get();
    
    if (!sessionId) {
      set({ error: 'No active session' });
      return;
    }
    
    set({ isLoading: true, error: null });
    
    try {
      const result = await confirmRouting(sessionId);
      
      set({
        phase: 'complete',
        plan: result.plan,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to create plan',
      });
    }
  },
}));

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER: Restore session state from existing session
// ─────────────────────────────────────────────────────────────────────────────────

async function restoreSessionState(
  session: DesignerSession,
  set: (state: Partial<DesignerStore>) => void
) {
  const phase = mapBackendPhaseToLocal(session.phase);
  
  // Build state based on session data
  const state: Partial<DesignerStore> = {
    sessionId: session.id,
    phase,
    isLoading: false,
  };
  
  // Restore phase-specific data
  if (session.capstone) {
    state.capstone = session.capstone;
  }
  
  if (session.subskills && session.subskills.length > 0) {
    state.subskills = session.subskills;
  }
  
  if (session.routing && session.routing.length > 0) {
    state.routing = session.routing;
  }
  
  // If in clarify phase, fetch clarify data
  if (phase === 'clarify') {
    try {
      const clarifyResult = await getClarifyData(session.id);
      state.clarifyData = clarifyResult.data;
      state.canFinalize = clarifyResult.canFinalize;
    } catch (error) {
      console.warn('[DESIGNER] Failed to fetch clarify data:', error);
    }
  }
  
  set(state);
}

// Map backend phase to local phase
function mapBackendPhaseToLocal(backendPhase: string): DesignerPhase {
  const mapping: Record<string, DesignerPhase> = {
    'exploration': 'orient',
    'clarify': 'clarify',
    'capstone': 'capstone',
    'subskills': 'subskills',
    'routing': 'routing',
    'complete': 'complete',
  };
  
  return mapping[backendPhase] || 'orient';
}

// ─────────────────────────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────────────────────────

export const selectPhaseIndex = (phase: DesignerPhase): number => {
  const phases: DesignerPhase[] = ['orient', 'clarify', 'capstone', 'subskills', 'routing', 'complete'];
  return phases.indexOf(phase);
};

export const selectIsPhaseComplete = (currentPhase: DesignerPhase, targetPhase: DesignerPhase): boolean => {
  return selectPhaseIndex(currentPhase) > selectPhaseIndex(targetPhase);
};
