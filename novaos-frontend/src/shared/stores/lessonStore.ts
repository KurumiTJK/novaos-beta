// ═══════════════════════════════════════════════════════════════════════════════
// LESSON STORE — NovaOS
// Wired to real API endpoints
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import {
  getToday,
  getCurrentSpark,
  completeSpark as completeSparkApi,
  skipSpark as skipSparkApi,
  generateSpark,
  getPlans,
  startSubskill,
  type TodayState,
  type Spark as ApiSpark,
  type Subskill,
  type LearningPlan,
} from '../api/sword';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES (Preserved for UI compatibility)
// ─────────────────────────────────────────────────────────────────────────────────

export type LessonStatus = 'locked' | 'available' | 'in_progress' | 'completed';

export interface Spark {
  id: string;
  task: string;
  estimatedMinutes: number;
  context?: string;
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  progress: number; // 0-1
  status: LessonStatus;
  totalSessions: number;
  completedSessions: number;
  emoji: string;
}

export interface Milestone {
  id: string;
  title: string;
  completed: boolean;
}

export interface LearningPath {
  id: string;
  goal: string;
  progress: number; // 0-1
  milestones: Milestone[];
}

export interface LearningStats {
  totalLessonsCompleted: number;
  totalSessionsCompleted: number;
  currentStreak: number;
  sparksCompletedToday: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// DEFAULT VALUES
// ─────────────────────────────────────────────────────────────────────────────────

const DEFAULT_STATS: LearningStats = {
  totalLessonsCompleted: 0,
  totalSessionsCompleted: 0,
  currentStreak: 0,
  sparksCompletedToday: 0,
};

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE MAPPERS (API → UI)
// ─────────────────────────────────────────────────────────────────────────────────

function mapApiSparkToSpark(apiSpark: ApiSpark | null | undefined): Spark | null {
  if (!apiSpark) return null;
  
  return {
    id: apiSpark.id,
    task: apiSpark.task,
    estimatedMinutes: apiSpark.estimatedMinutes || 3,
    context: apiSpark.context || apiSpark.subskillId,
  };
}

function mapSubskillToLesson(subskill: Subskill, index: number): Lesson {
  // Generate emoji based on order/type
  const emojis = ['🎯', '📚', '🧩', '💡', '🔧', '🎨', '🚀', '⚡', '🌟', '🎸'];
  
  return {
    id: subskill.id,
    title: subskill.title,
    description: subskill.description,
    progress: subskill.progress,
    status: subskill.status,
    totalSessions: subskill.totalSessions,
    completedSessions: subskill.completedSessions,
    emoji: emojis[index % emojis.length],
  };
}

function mapPlanToPath(plan: LearningPlan | null | undefined): LearningPath | null {
  if (!plan) return null;
  
  // Create milestones from subskills
  const milestones: Milestone[] = plan.subskills?.map(subskill => ({
    id: subskill.id,
    title: subskill.title,
    completed: subskill.status === 'completed',
  })) || [];
  
  return {
    id: plan.id,
    goal: plan.capstone?.title || plan.title,
    progress: plan.progress,
    milestones,
  };
}

function mapTodayToStats(today: TodayState | null): LearningStats {
  if (!today) return DEFAULT_STATS;
  
  const plan = today.plan;
  const completedSubskills = plan?.subskills?.filter(s => s.status === 'completed').length || 0;
  const totalSessions = plan?.subskills?.reduce((sum, s) => sum + s.completedSessions, 0) || 0;
  
  return {
    totalLessonsCompleted: completedSubskills,
    totalSessionsCompleted: totalSessions,
    currentStreak: today.progress?.streak || 0,
    sparksCompletedToday: today.progress?.completedToday || 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────────

interface LessonStore {
  // State
  currentSpark: Spark | null;
  lessons: Lesson[];
  activePath: LearningPath | null;
  stats: LearningStats;
  isLoading: boolean;
  error: string | null;
  
  /** Track if data has been fetched at least once */
  isInitialized: boolean;
  
  /** Raw API data for advanced use */
  _rawTodayState: TodayState | null;
  _rawPlan: LearningPlan | null | undefined;

  // Actions
  fetchLessons: () => Promise<void>;
  completeSpark: (sparkId: string) => Promise<void>;
  skipSpark: (sparkId: string, reason?: string) => Promise<void>;
  startLesson: (lessonId: string) => Promise<void>;
  continueLesson: (lessonId: string) => void;
  
  /** Generate a new spark */
  refreshSpark: () => Promise<void>;
  
  /** Clear error */
  clearError: () => void;
}

export const useLessonStore = create<LessonStore>((set, get) => ({
  // Initial state
  currentSpark: null,
  lessons: [],
  activePath: null,
  stats: DEFAULT_STATS,
  isLoading: false,
  error: null,
  isInitialized: false,
  _rawTodayState: null,
  _rawPlan: null,

  // ═══════════════════════════════════════════════════════════════════════════
  // FETCH LESSONS — GET /sword/today + /sword/plans
  // ═══════════════════════════════════════════════════════════════════════════
  
  fetchLessons: async () => {
    // Don't refetch if already loading
    if (get().isLoading) return;
    
    set({ isLoading: true, error: null });
    
    try {
      // Fetch today's state
      const today = await getToday();
      
      // Get current spark
      const apiSpark = today.currentSpark || await getCurrentSpark();
      
      // Get plan details for lessons
      let plan: LearningPlan | undefined = today.plan;
      if (!plan && today.hasActivePlan) {
        // Fetch plans if not included in today response
        const plans = await getPlans();
        plan = plans.find(p => p.status === 'active');
      }
      
      // Map API data to UI types
      const currentSpark = mapApiSparkToSpark(apiSpark);
      const lessons = plan?.subskills?.map((s, i) => mapSubskillToLesson(s, i)) || [];
      const activePath = mapPlanToPath(plan);
      const stats = mapTodayToStats(today);
      
      set({
        currentSpark,
        lessons,
        activePath,
        stats,
        isLoading: false,
        isInitialized: true,
        _rawTodayState: today,
        _rawPlan: plan,
      });
    } catch (error) {
      console.error('[LESSON_STORE] Fetch failed:', error);
      
      set({
        isLoading: false,
        isInitialized: true,
        error: error instanceof Error ? error.message : 'Failed to fetch lessons',
      });
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLETE SPARK — POST /sword/spark/:id/complete
  // ═══════════════════════════════════════════════════════════════════════════
  
  completeSpark: async (sparkId: string) => {
    const { stats } = get();
    
    // Optimistic update
    set({
      currentSpark: null,
      stats: {
        ...stats,
        sparksCompletedToday: stats.sparksCompletedToday + 1,
      },
    });
    
    try {
      await completeSparkApi(sparkId);
      
      // Generate next spark
      const nextSpark = await generateSpark();
      set({ currentSpark: mapApiSparkToSpark(nextSpark) });
    } catch (error) {
      console.error('[LESSON_STORE] Complete spark failed:', error);
      
      // Revert optimistic update on error
      set({
        stats: {
          ...stats,
          sparksCompletedToday: stats.sparksCompletedToday, // revert
        },
        error: error instanceof Error ? error.message : 'Failed to complete spark',
      });
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SKIP SPARK — POST /sword/spark/:id/skip
  // ═══════════════════════════════════════════════════════════════════════════
  
  skipSpark: async (sparkId: string, reason?: string) => {
    // Optimistic update
    set({ currentSpark: null });
    
    try {
      await skipSparkApi(sparkId, reason);
      
      // Generate next spark
      const nextSpark = await generateSpark();
      set({ currentSpark: mapApiSparkToSpark(nextSpark) });
    } catch (error) {
      console.error('[LESSON_STORE] Skip spark failed:', error);
      
      set({
        error: error instanceof Error ? error.message : 'Failed to skip spark',
      });
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // START LESSON — POST /sword/subskills/:id/start
  // ═══════════════════════════════════════════════════════════════════════════
  
  startLesson: async (lessonId: string) => {
    const { lessons } = get();
    
    // Optimistic update
    set({
      lessons: lessons.map(lesson =>
        lesson.id === lessonId
          ? { ...lesson, status: 'in_progress' as LessonStatus }
          : lesson
      ),
    });
    
    try {
      await startSubskill(lessonId);
    } catch (error) {
      console.error('[LESSON_STORE] Start lesson failed:', error);
      
      // Revert optimistic update
      set({
        lessons,
        error: error instanceof Error ? error.message : 'Failed to start lesson',
      });
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTINUE LESSON — UI Navigation action
  // ═══════════════════════════════════════════════════════════════════════════
  
  continueLesson: (lessonId: string) => {
    // This triggers navigation to SwordRunner
    // The actual navigation is handled by the component using useUIStore
    console.log(`[LESSON_STORE] Continue lesson: ${lessonId}`);
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // REFRESH SPARK — POST /sword/spark (generate new)
  // ═══════════════════════════════════════════════════════════════════════════
  
  refreshSpark: async () => {
    try {
      const newSpark = await generateSpark();
      set({ currentSpark: mapApiSparkToSpark(newSpark) });
    } catch (error) {
      console.error('[LESSON_STORE] Refresh spark failed:', error);
      
      set({
        error: error instanceof Error ? error.message : 'Failed to generate spark',
      });
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEAR ERROR
  // ═══════════════════════════════════════════════════════════════════════════
  
  clearError: () => {
    set({ error: null });
  },
}));

// ─────────────────────────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────────────────────────

export const selectHasActivePlan = (state: { activePath: LearningPath | null }) =>
  state.activePath !== null;

export const selectCurrentLesson = (state: { lessons: Lesson[] }) =>
  state.lessons.find(l => l.status === 'in_progress') || null;

export const selectAvailableLessons = (state: { lessons: Lesson[] }) =>
  state.lessons.filter(l => l.status === 'available' || l.status === 'in_progress');

export const selectCompletedLessons = (state: { lessons: Lesson[] }) =>
  state.lessons.filter(l => l.status === 'completed');

export const selectOverallProgress = (state: { lessons: Lesson[] }) => {
  if (state.lessons.length === 0) return 0;
  const total = state.lessons.reduce((sum, l) => sum + l.progress, 0);
  return total / state.lessons.length;
};
