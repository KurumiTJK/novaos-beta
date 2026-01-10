// ═══════════════════════════════════════════════════════════════════════════════
// LESSON STORE — NovaOS WITH STREAMING
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import {
  getToday, getCurrentSpark, completeSpark as completeSparkApi, skipSpark as skipSparkApi,
  generateSpark, getPlans, startSubskill,
  type TodayState, type Spark as ApiSpark, type Subskill, type LearningPlan, type DailyLesson,
} from '../api/sword';
import { startSessionStream, createStreamController, type SessionStreamResult } from '../api/sword-streaming';

export type LessonStatus = 'locked' | 'available' | 'in_progress' | 'completed';

export interface Spark { id: string; task: string; estimatedMinutes: number; context?: string; }
export interface Lesson { id: string; title: string; description: string; progress: number; status: LessonStatus; totalSessions: number; completedSessions: number; emoji: string; }
export interface Milestone { id: string; title: string; completed: boolean; }
export interface LearningPath { id: string; goal: string; progress: number; milestones: Milestone[]; }
export interface LearningStats { totalLessonsCompleted: number; totalSessionsCompleted: number; currentStreak: number; sparksCompletedToday: number; }
export interface SessionGeneration { isGenerating: boolean; isStreaming: boolean; streamingText: string; progress: number; statusMessage: string; }

const DEFAULT_STATS: LearningStats = { totalLessonsCompleted: 0, totalSessionsCompleted: 0, currentStreak: 0, sparksCompletedToday: 0 };
const DEFAULT_SESSION_GENERATION: SessionGeneration = { isGenerating: false, isStreaming: false, streamingText: '', progress: 0, statusMessage: '' };

function mapApiSparkToSpark(apiSpark: ApiSpark | null | undefined): Spark | null {
  if (!apiSpark) return null;
  return { id: apiSpark.id, task: apiSpark.task, estimatedMinutes: apiSpark.estimatedMinutes || 3, context: apiSpark.context || apiSpark.subskillId };
}

function mapApiStatusToLessonStatus(apiStatus: Subskill['status']): LessonStatus {
  switch (apiStatus) {
    case 'completed': case 'mastered': return 'completed';
    case 'in_progress': case 'active': return 'in_progress';
    case 'available': return 'available';
    default: return 'locked';
  }
}

function mapSubskillToLesson(subskill: Subskill, index: number): Lesson {
  const emojis = ['🎯', '📚', '🧩', '💡', '🔧', '🎨', '🚀', '⚡', '🌟', '🎸'];
  return {
    id: subskill.id, title: subskill.title, description: subskill.description, progress: subskill.progress,
    status: mapApiStatusToLessonStatus(subskill.status), totalSessions: subskill.totalSessions,
    completedSessions: subskill.completedSessions ?? 0, emoji: emojis[index % emojis.length],
  };
}

function mapPlanToPath(plan: LearningPlan | null | undefined): LearningPath | null {
  if (!plan) return null;
  const milestones: Milestone[] = plan.subskills?.map(s => ({ id: s.id, title: s.title, completed: s.status === 'completed' })) || [];
  return { id: plan.id, goal: plan.capstone?.title || plan.title, progress: plan.progress ?? 0, milestones };
}

function mapTodayToStats(today: TodayState | null): LearningStats {
  if (!today) return DEFAULT_STATS;
  const plan = today.plan;
  const completedSubskills = plan?.subskills?.filter(s => s.status === 'completed').length || 0;
  const totalSessions = plan?.subskills?.reduce((sum, s) => sum + (s.completedSessions ?? 0), 0) || 0;
  return {
    totalLessonsCompleted: completedSubskills, totalSessionsCompleted: totalSessions,
    currentStreak: today.progress?.streak || 0, sparksCompletedToday: today.progress?.completedToday || 0,
  };
}

interface LessonStore {
  currentSpark: Spark | null;
  lessons: Lesson[];
  activePath: LearningPath | null;
  stats: LearningStats;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
  _rawTodayState: TodayState | null;
  _rawPlan: LearningPlan | null | undefined;
  sessionGeneration: SessionGeneration;
  currentDailyLesson: DailyLesson | null;
  abortController: AbortController | null;

  fetchLessons: () => Promise<void>;
  completeSpark: (sparkId: string) => Promise<void>;
  skipSpark: (sparkId: string, reason?: string) => Promise<void>;
  startLesson: (lessonId: string) => Promise<void>;
  continueLesson: (lessonId: string) => void;
  refreshSpark: () => Promise<void>;
  startSessionWithStreaming: (subskillId: string) => Promise<DailyLesson | null>;
  abortSessionGeneration: () => void;
  clearError: () => void;
  reset: () => void;
}

export const useLessonStore = create<LessonStore>((set, get) => ({
  currentSpark: null, lessons: [], activePath: null, stats: DEFAULT_STATS, isLoading: false,
  error: null, isInitialized: false, _rawTodayState: null, _rawPlan: null,
  sessionGeneration: DEFAULT_SESSION_GENERATION, currentDailyLesson: null, abortController: null,

  fetchLessons: async () => {
    if (get().isLoading) return;
    set({ isLoading: true, error: null });
    try {
      const today = await getToday();
      const apiSpark = today.currentSpark || await getCurrentSpark();
      let plan: LearningPlan | undefined = today.plan;
      if (!plan && today.hasActivePlan) {
        const plans = await getPlans();
        plan = plans.find(p => p.status === 'active');
      }
      set({
        currentSpark: mapApiSparkToSpark(apiSpark),
        lessons: plan?.subskills?.map((s, i) => mapSubskillToLesson(s, i)) || [],
        activePath: mapPlanToPath(plan),
        stats: mapTodayToStats(today),
        isLoading: false, isInitialized: true, _rawTodayState: today, _rawPlan: plan,
      });
    } catch (error: any) {
      set({ isLoading: false, isInitialized: true, error: error.message || 'Failed to fetch lessons' });
    }
  },

  completeSpark: async (sparkId: string) => {
    const { stats } = get();
    set({ currentSpark: null, stats: { ...stats, sparksCompletedToday: stats.sparksCompletedToday + 1 } });
    try {
      await completeSparkApi(sparkId);
      const nextSpark = await generateSpark();
      set({ currentSpark: mapApiSparkToSpark(nextSpark) });
    } catch (error: any) {
      set({ stats: { ...stats, sparksCompletedToday: stats.sparksCompletedToday }, error: error.message });
    }
  },

  skipSpark: async (sparkId: string, reason?: string) => {
    set({ currentSpark: null });
    try {
      await skipSparkApi(sparkId, reason);
      const nextSpark = await generateSpark();
      set({ currentSpark: mapApiSparkToSpark(nextSpark) });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  startLesson: async (lessonId: string) => {
    const { lessons } = get();
    set({ lessons: lessons.map(l => l.id === lessonId ? { ...l, status: 'in_progress' as LessonStatus } : l) });
    try { await startSubskill(lessonId); }
    catch (error: any) { set({ lessons, error: error.message }); }
  },

  continueLesson: (lessonId: string) => { console.log(`[LESSON_STORE] Continue lesson: ${lessonId}`); },

  refreshSpark: async () => {
    try {
      const newSpark = await generateSpark();
      set({ currentSpark: mapApiSparkToSpark(newSpark) });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  startSessionWithStreaming: async (subskillId: string): Promise<DailyLesson | null> => {
    get().abortController?.abort();
    const controller = createStreamController();
    
    set({
      sessionGeneration: { isGenerating: true, isStreaming: true, streamingText: '', progress: 0, statusMessage: 'Preparing your lesson...' },
      currentDailyLesson: null, abortController: controller, error: null,
    });
    
    try {
      let accumulatedText = '';
      let resultLesson: DailyLesson | null = null;
      
      await startSessionStream(subskillId, {
        onToken: (text) => {
          accumulatedText += text;
          set((state) => ({ sessionGeneration: { ...state.sessionGeneration, streamingText: accumulatedText, statusMessage: 'Generating lesson content...' } }));
        },
        onThinking: (active) => {
          set((state) => ({ sessionGeneration: { ...state.sessionGeneration, statusMessage: active ? 'Thinking...' : 'Generating...' } }));
        },
        onDone: (streamResult: SessionStreamResult) => {
          resultLesson = streamResult.dailyLesson;
          set({
            currentDailyLesson: streamResult.dailyLesson,
            sessionGeneration: { isGenerating: false, isStreaming: false, streamingText: '', progress: 100, statusMessage: 'Lesson ready!' },
            abortController: null,
          });
        },
        onError: (error) => { set({ error, sessionGeneration: DEFAULT_SESSION_GENERATION, abortController: null }); },
      }, controller.signal);
      
      return resultLesson;
    } catch (error: any) {
      if (error.name !== 'AbortError') set({ error: error.message });
      set({ sessionGeneration: DEFAULT_SESSION_GENERATION, abortController: null });
      return null;
    }
  },

  abortSessionGeneration: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
      set({ sessionGeneration: DEFAULT_SESSION_GENERATION, abortController: null });
    }
  },

  clearError: () => { set({ error: null }); },

  reset: () => {
    get().abortController?.abort();
    set({
      currentSpark: null, lessons: [], activePath: null, stats: DEFAULT_STATS, isLoading: false,
      error: null, isInitialized: false, _rawTodayState: null, _rawPlan: null,
      sessionGeneration: DEFAULT_SESSION_GENERATION, currentDailyLesson: null, abortController: null,
    });
  },
}));

export const selectHasActivePlan = (state: { activePath: LearningPath | null }) => state.activePath !== null;
export const selectCurrentLesson = (state: { lessons: Lesson[] }) => state.lessons.find(l => l.status === 'in_progress') || null;
export const selectAvailableLessons = (state: { lessons: Lesson[] }) => state.lessons.filter(l => l.status === 'available' || l.status === 'in_progress');
export const selectCompletedLessons = (state: { lessons: Lesson[] }) => state.lessons.filter(l => l.status === 'completed');
export const selectOverallProgress = (state: { lessons: Lesson[] }) => state.lessons.length === 0 ? 0 : state.lessons.reduce((sum, l) => sum + l.progress, 0) / state.lessons.length;
export const selectIsGeneratingSession = (state: { sessionGeneration: SessionGeneration }) => state.sessionGeneration.isGenerating;
