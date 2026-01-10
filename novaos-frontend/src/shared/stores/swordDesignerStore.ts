// ═══════════════════════════════════════════════════════════════════════════════
// SWORD DESIGNER STORE — NovaOS WITH STREAMING
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import {
  confirmExploration, updateClarifyField,
  updateConstraints, continueToGoal, getReview, confirmReview,
  getActiveSession, deleteSession, activatePlan,
  type DesignerSession, type ClarifyData, type ClarifyResponse, type Capstone,
  type Subskill, type SubskillRouting, type LearningPlan, type ExplorationState, type ReviewState,
} from '../api/sword';
import {
  startExplorationStream, exploreChatStream, generatePlanStream,
  createStreamController, getStageLabel,
  type ProgressEvent, type PlanGenerationStreamResult,
} from '../api/sword-streaming';

export type DesignerPhase = 'orient' | 'clarify' | 'goal' | 'skills' | 'path';

export interface OrientMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface GenerationProgress {
  stage: string;
  stageLabel: string;
  status: 'idle' | 'starting' | 'generating' | 'complete' | 'error';
  message: string;
  progress: number;
  stageData: any;
}

interface DesignerStore {
  phase: DesignerPhase;
  sessionId: string | null;
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
  orientMessages: OrientMessage[];
  explorationState: ExplorationState | null;
  clarifyData: ClarifyData | null;
  fieldSources: Record<string, string>;
  missingFields: string[];
  canFinalize: boolean;
  capstone: Capstone | null;
  subskills: Subskill[];
  routing: SubskillRouting[];
  reviewData: ReviewState | null;
  plan: LearningPlan | null;
  isStreaming: boolean;
  streamingText: string;
  abortController: AbortController | null;
  generationProgress: GenerationProgress;

  initialize: (topic?: string) => Promise<void>;
  reset: () => void;
  abandon: () => Promise<void>;
  abortStream: () => void;
  sendOrientMessage: (message: string) => Promise<void>;
  confirmOrient: () => Promise<void>;
  updateField: (field: 'learningGoal' | 'priorKnowledge' | 'context', value: string) => Promise<void>;
  updateConstraintsAction: (constraints: string[]) => Promise<void>;
  finalizeClarify: () => Promise<void>;
  loadReview: () => Promise<void>;
  confirmSkills: () => Promise<void>;
  activateCreatedPlan: () => Promise<void>;
}

const initialGenerationProgress: GenerationProgress = {
  stage: '', stageLabel: '', status: 'idle', message: '', progress: 0, stageData: null,
};

const initialState = {
  phase: 'orient' as DesignerPhase, sessionId: null, isLoading: false, isGenerating: false,
  error: null, orientMessages: [], explorationState: null, clarifyData: null, fieldSources: {},
  missingFields: [], canFinalize: false, capstone: null, subskills: [], routing: [],
  reviewData: null, plan: null, isStreaming: false, streamingText: '', abortController: null,
  generationProgress: initialGenerationProgress,
};

function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function extractClarifyData(result: ClarifyResponse): ClarifyData {
  const source = result.extracted || result.data || result;
  return {
    learningGoal: (source as any).learningGoal || '',
    priorKnowledge: (source as any).priorKnowledge || '',
    context: (source as any).context || '',
    constraints: (source as any).constraints || [],
  };
}

export const useSwordDesignerStore = create<DesignerStore>((set, get) => ({
  ...initialState,

  initialize: async (topic?: string) => {
    get().abortController?.abort();
    set({ isLoading: true, error: null, abortController: null });
    
    try {
      const existingSession = await getActiveSession();
      if (existingSession) {
        await restoreSessionState(existingSession, set);
        return;
      }
      
      const controller = createStreamController();
      const streamingMessageId = generateMessageId();
      let accumulatedText = '';
      
      const initialMessages: OrientMessage[] = [];
      if (topic) {
        initialMessages.push({ id: generateMessageId(), role: 'user', content: `I want to learn ${topic}`, timestamp: new Date() });
      }
      initialMessages.push({ id: streamingMessageId, role: 'assistant', content: '', timestamp: new Date(), isStreaming: true });
      
      set({ phase: 'orient', orientMessages: initialMessages, isStreaming: true, streamingText: '', abortController: controller, isLoading: false });
      
      await startExplorationStream(topic, {
        onToken: (text) => {
          accumulatedText += text;
          set((state) => ({
            streamingText: accumulatedText,
            orientMessages: state.orientMessages.map(msg => msg.id === streamingMessageId ? { ...msg, content: accumulatedText } : msg),
          }));
        },
        onThinking: (active) => console.log('[DESIGNER] Thinking:', active),
        onDone: (streamResult) => {
          set((state) => ({
            sessionId: streamResult.sessionId,
            orientMessages: state.orientMessages.map(msg => msg.id === streamingMessageId ? { ...msg, isStreaming: false } : msg),
            isStreaming: false, streamingText: '', abortController: null,
          }));
        },
        onError: (error) => set({ error, isStreaming: false, abortController: null }),
      }, controller.signal);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        set({ isLoading: false, isStreaming: false, abortController: null, error: error.message || 'Failed to initialize' });
      }
    }
  },

  reset: () => { get().abortController?.abort(); set(initialState); },
  
  abandon: async () => {
    const { sessionId, abortController } = get();
    abortController?.abort();
    if (sessionId) { try { await deleteSession(); } catch {} }
    set(initialState);
  },

  abortStream: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
      set({ isStreaming: false, abortController: null, generationProgress: { ...get().generationProgress, status: 'idle' } });
    }
  },

  sendOrientMessage: async (message: string) => {
    const { sessionId, orientMessages, abortController: existingController } = get();
    if (!sessionId) { set({ error: 'No active session' }); return; }
    
    existingController?.abort();
    const controller = createStreamController();
    const userMessageId = generateMessageId();
    const assistantMessageId = generateMessageId();
    let accumulatedText = '';
    
    set({
      orientMessages: [...orientMessages, 
        { id: userMessageId, role: 'user', content: message, timestamp: new Date() },
        { id: assistantMessageId, role: 'assistant', content: '', timestamp: new Date(), isStreaming: true },
      ],
      isStreaming: true, streamingText: '', abortController: controller, error: null,
    });
    
    try {
      await exploreChatStream(sessionId, message, {
        onToken: (text) => {
          accumulatedText += text;
          set((state) => ({
            streamingText: accumulatedText,
            orientMessages: state.orientMessages.map(msg => msg.id === assistantMessageId ? { ...msg, content: accumulatedText } : msg),
          }));
        },
        onThinking: () => {},
        onDone: () => {
          set((state) => ({
            orientMessages: state.orientMessages.map(msg => msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg),
            isStreaming: false, streamingText: '', abortController: null,
          }));
        },
        onError: (error) => {
          set((state) => ({
            orientMessages: state.orientMessages.filter(msg => msg.id !== assistantMessageId),
            error, isStreaming: false, abortController: null,
          }));
        },
      }, controller.signal);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        set({ error: error.message || 'Failed to send message', isStreaming: false, abortController: null });
      }
    }
  },

  confirmOrient: async () => {
    const { sessionId } = get();
    if (!sessionId) { set({ error: 'No active session' }); return; }
    
    set({ isLoading: true, error: null });
    try {
      const result = await confirmExploration(sessionId);
      const clarifyData = extractClarifyData(result);
      const canFinalize = !!(clarifyData.learningGoal && clarifyData.priorKnowledge);
      set({ phase: 'clarify', clarifyData, fieldSources: (result as any).fieldSources || {}, missingFields: (result as any).missing || [], canFinalize, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false, error: error.message || 'Failed to confirm exploration' });
    }
  },

  updateField: async (field, value) => {
    const { sessionId, clarifyData } = get();
    if (!sessionId) { set({ error: 'No active session' }); return; }
    
    const newClarifyData = clarifyData ? { ...clarifyData, [field]: value } : { learningGoal: '', priorKnowledge: '', context: '', constraints: [], [field]: value };
    const newCanFinalize = !!(newClarifyData.learningGoal && newClarifyData.priorKnowledge);
    set({ clarifyData: newClarifyData, fieldSources: { ...get().fieldSources, [field]: 'user_edited' }, canFinalize: newCanFinalize });
    
    try {
      await updateClarifyField(sessionId, field, value);
    } catch (error: any) {
      set({ clarifyData, canFinalize: !!(clarifyData?.learningGoal && clarifyData?.priorKnowledge), error: error.message });
    }
  },

  updateConstraintsAction: async (constraints) => {
    const { sessionId, clarifyData } = get();
    if (!sessionId) { set({ error: 'No active session' }); return; }
    
    const newClarifyData = clarifyData ? { ...clarifyData, constraints } : { learningGoal: '', priorKnowledge: '', context: '', constraints };
    set({ clarifyData: newClarifyData });
    
    try { await updateConstraints(sessionId, constraints); } 
    catch (error: any) { set({ clarifyData, error: error.message }); }
  },

  finalizeClarify: async () => {
    const { sessionId, abortController: existingController } = get();
    if (!sessionId) { set({ error: 'No active session' }); return; }
    
    existingController?.abort();
    const controller = createStreamController();
    
    set({ phase: 'goal', isLoading: true, isGenerating: true, isStreaming: true, abortController: controller, error: null,
      generationProgress: { stage: '', stageLabel: '', status: 'starting', message: 'Starting plan generation...', progress: 0, stageData: null },
    });
    
    try {
      await continueToGoal(sessionId);
      
      await generatePlanStream(sessionId, {
        onProgress: (event: ProgressEvent) => {
          set({ generationProgress: { stage: event.stage, stageLabel: getStageLabel(event.stage), status: event.status, message: event.message, progress: event.progress ?? 0, stageData: event.data ?? null } });
        },
        onDone: (streamResult: PlanGenerationStreamResult) => {
          set({
            phase: 'skills', reviewData: streamResult.preview, capstone: streamResult.preview?.capstone || null,
            subskills: streamResult.preview?.subskills || [], isLoading: false, isGenerating: false, isStreaming: false, abortController: null,
            generationProgress: { stage: 'complete', stageLabel: 'Complete', status: 'complete', message: 'Your learning plan is ready!', progress: 100, stageData: streamResult.preview },
          });
        },
        onError: (error) => {
          set({ phase: 'clarify', isLoading: false, isGenerating: false, isStreaming: false, abortController: null, error,
            generationProgress: { ...get().generationProgress, status: 'error', message: error },
          });
        },
      }, controller.signal);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        set({ phase: 'clarify', isLoading: false, isGenerating: false, isStreaming: false, abortController: null, error: error.message, generationProgress: initialGenerationProgress });
      }
    }
  },

  loadReview: async () => {
    const { sessionId } = get();
    if (!sessionId) { set({ error: 'No active session' }); return; }
    set({ isLoading: true, error: null });
    try {
      const reviewResult = await getReview(sessionId);
      set({ reviewData: reviewResult, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false, error: error.message });
    }
  },

  confirmSkills: async () => {
    const { sessionId } = get();
    if (!sessionId) { set({ error: 'No active session' }); return; }
    set({ isLoading: true, error: null });
    try {
      const result = await confirmReview(sessionId);
      set({ phase: 'path', plan: result.plan, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false, error: error.message });
    }
  },

  activateCreatedPlan: async () => {
    const { plan } = get();
    if (!plan) { set({ error: 'No plan to activate' }); return; }
    set({ isLoading: true, error: null });
    try {
      await activatePlan(plan.id);
      set(initialState);
    } catch (error: any) {
      set({ isLoading: false, error: error.message });
    }
  },
}));

async function restoreSessionState(session: DesignerSession, set: any) {
  const backendPhase = session.internalPhase || session.visiblePhase || session.phase || 'exploration';
  let phase = mapBackendPhaseToLocal(backendPhase);
  
  // Check actual exploration state part from backend
  if (backendPhase === 'exploration' && session.explorationData) {
    const expData = session.explorationData as any;
    if (expData.part === 'clarify') {
      phase = 'clarify';
    }
  }
  
  const state: any = { sessionId: session.id, phase, isLoading: false, isStreaming: false, abortController: null, generationProgress: initialGenerationProgress };
  
  const capstoneSource = session.capstoneData || session.capstone;
  if (capstoneSource) {
    state.capstone = { id: (capstoneSource as any).id || session.id, title: (capstoneSource as any).title || '', description: (capstoneSource as any).capstoneStatement || (capstoneSource as any).description || '', successCriteria: (capstoneSource as any).successCriteria || [] };
  }
  
  const subskillsSource = session.subskillsData?.subskills || session.subskills;
  if (subskillsSource && subskillsSource.length > 0) state.subskills = subskillsSource;
  
  const routingSource = session.routingData?.assignments || session.routing;
  if (routingSource && routingSource.length > 0) state.routing = routingSource;
  
  if (phase === 'clarify') {
    const expData = session.explorationData as any || {};
    // Backend stores fields under 'extracted' in exploration_data
    const extracted = expData.extracted || expData;
    state.clarifyData = { 
      learningGoal: extracted.learningGoal || '', 
      priorKnowledge: extracted.priorKnowledge || '', 
      context: extracted.context || '', 
      constraints: extracted.constraints || [] 
    };
    state.canFinalize = !!(state.clarifyData.learningGoal && state.clarifyData.priorKnowledge);
    state.fieldSources = expData.fieldSources || {};
    state.missingFields = expData.missing || [];
  }
  
  if (phase === 'skills') {
    try { state.reviewData = await getReview(session.id); } catch {}
  }
  
  set(state);
}

function mapBackendPhaseToLocal(backendPhase: string): DesignerPhase {
  const mapping: Record<string, DesignerPhase> = {
    'exploration': 'orient', 'capstone': 'goal', 'subskills': 'goal', 'routing': 'skills',
    'define_goal': 'goal', 'research': 'goal', 'review': 'skills',
    'orient': 'orient', 'clarify': 'clarify', 'goal': 'goal', 'skills': 'skills', 'path': 'path', 'complete': 'path',
  };
  return mapping[backendPhase] || 'orient';
}

export const selectPhaseIndex = (phase: DesignerPhase): number => ['orient', 'clarify', 'goal', 'skills', 'path'].indexOf(phase);
export const selectIsPhaseComplete = (currentPhase: DesignerPhase, targetPhase: DesignerPhase): boolean => selectPhaseIndex(currentPhase) > selectPhaseIndex(targetPhase);
export const selectPhaseLabel = (phase: DesignerPhase): string => ({ 'orient': 'Explore', 'clarify': 'Clarify', 'goal': 'Goal', 'skills': 'Skills', 'path': 'Path' })[phase];
