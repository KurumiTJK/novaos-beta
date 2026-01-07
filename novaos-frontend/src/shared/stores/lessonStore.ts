// ═══════════════════════════════════════════════════════════════════════════════
// LESSON STORE — NovaOS
// Mock data for lessons display - ready for backend wiring
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
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
// MOCK DATA
// ═══════════════════════════════════════════════════════════════════════════════
// TODO: Replace all mock data with API calls to:
//   - GET /api/v1/sword/today (main entry point)
//   - GET /api/v1/sword/lessons
//   - GET /api/v1/sword/spark
//   - GET /api/v1/sword/path
//   - POST /api/v1/sword/spark/complete
//   - POST /api/v1/sword/spark/skip
// ═══════════════════════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────────────────────────

const MOCK_SPARK: Spark = {
  id: 'spark_1',
  task: 'Write one sentence describing what you want to learn about guitar today.',
  estimatedMinutes: 3,
  context: 'Guitar Fundamentals',
};

const MOCK_LESSONS: Lesson[] = [
  {
    id: 'lesson_1',
    title: 'Guitar Fundamentals',
    description: 'Learn basic chords and finger positioning',
    progress: 0.6,
    status: 'in_progress',
    totalSessions: 5,
    completedSessions: 3,
    emoji: '🎸',
  },
  {
    id: 'lesson_2',
    title: 'Chord Transitions',
    description: 'Smooth switching between common chords',
    progress: 0,
    status: 'available',
    totalSessions: 4,
    completedSessions: 0,
    emoji: '🎵',
  },
  {
    id: 'lesson_3',
    title: 'Strumming Patterns',
    description: 'Master rhythm and strumming techniques',
    progress: 0,
    status: 'locked',
    totalSessions: 6,
    completedSessions: 0,
    emoji: '🎶',
  },
  {
    id: 'lesson_4',
    title: 'Your First Song',
    description: 'Put it all together and play a complete song',
    progress: 0,
    status: 'locked',
    totalSessions: 3,
    completedSessions: 0,
    emoji: '🎤',
  },
];

const MOCK_PATH: LearningPath = {
  id: 'path_1',
  goal: 'Learn guitar basics in 30 days',
  progress: 0.3,
  milestones: [
    { id: 'm1', title: 'Learn basic chords (C, G, D, Em)', completed: true },
    { id: 'm2', title: 'Practice chord transitions', completed: false },
    { id: 'm3', title: 'Master 3 strumming patterns', completed: false },
    { id: 'm4', title: 'Play your first complete song', completed: false },
  ],
};

const MOCK_STATS: LearningStats = {
  totalLessonsCompleted: 2,
  totalSessionsCompleted: 8,
  currentStreak: 5,
  sparksCompletedToday: 2,
};

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

  // Actions
  fetchLessons: () => Promise<void>;
  completeSpark: (sparkId: string) => Promise<void>;
  skipSpark: (sparkId: string, reason?: string) => Promise<void>;
  startLesson: (lessonId: string) => Promise<void>;
  continueLesson: (lessonId: string) => void;
}

export const useLessonStore = create<LessonStore>((set, get) => ({
  // Initial state with mock data
  currentSpark: MOCK_SPARK,
  lessons: MOCK_LESSONS,
  activePath: MOCK_PATH,
  stats: MOCK_STATS,
  isLoading: false,
  error: null,

  // ═══════════════════════════════════════════════════════════════════════════
  // TODO: Replace with API call to GET /api/v1/sword/today
  // This should fetch:
  //   - currentSpark
  //   - lessons (with progress)
  //   - activePath
  //   - stats
  // ═══════════════════════════════════════════════════════════════════════════
  fetchLessons: async () => {
    set({ isLoading: true, error: null });
    
    try {
      // TODO: Replace with actual API call
      // const response = await api.get<TodayResponse>('/sword/today');
      // set({
      //   currentSpark: response.dailyPlan?.spark || null,
      //   lessons: response.lessons || [],
      //   activePath: response.activePath || null,
      //   stats: response.stats || MOCK_STATS,
      //   isLoading: false,
      // });

      // MOCK: Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      set({
        currentSpark: MOCK_SPARK,
        lessons: MOCK_LESSONS,
        activePath: MOCK_PATH,
        stats: MOCK_STATS,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch lessons',
      });
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TODO: Replace with API call to POST /api/v1/sword/spark/complete
  // Body: { sparkId: string }
  // Should return next spark or null
  // ═══════════════════════════════════════════════════════════════════════════
  completeSpark: async (sparkId: string) => {
    try {
      // TODO: Replace with actual API call
      // const response = await api.post('/sword/spark/complete', { sparkId });
      // set({ currentSpark: response.nextSpark || null });

      // MOCK: Clear spark and increment stats
      set((state) => ({
        currentSpark: null,
        stats: {
          ...state.stats,
          sparksCompletedToday: state.stats.sparksCompletedToday + 1,
        },
      }));

      console.log(`[MOCK] Completed spark: ${sparkId}`);
    } catch (error) {
      console.error('Failed to complete spark:', error);
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TODO: Replace with API call to POST /api/v1/sword/spark/skip
  // Body: { sparkId: string, reason?: string }
  // Should return next spark or null
  // ═══════════════════════════════════════════════════════════════════════════
  skipSpark: async (sparkId: string, reason?: string) => {
    try {
      // TODO: Replace with actual API call
      // const response = await api.post('/sword/spark/skip', { sparkId, reason });
      // set({ currentSpark: response.nextSpark || null });

      // MOCK: Clear spark
      set({ currentSpark: null });

      console.log(`[MOCK] Skipped spark: ${sparkId}, reason: ${reason || 'none'}`);
    } catch (error) {
      console.error('Failed to skip spark:', error);
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TODO: Replace with API call to POST /api/v1/sword/lessons/:id/start
  // Should update lesson status and return updated lesson
  // ═══════════════════════════════════════════════════════════════════════════
  startLesson: async (lessonId: string) => {
    try {
      // TODO: Replace with actual API call
      // const response = await api.post(`/sword/lessons/${lessonId}/start`);

      // MOCK: Update lesson status
      set((state) => ({
        lessons: state.lessons.map((lesson) =>
          lesson.id === lessonId
            ? { ...lesson, status: 'in_progress' as LessonStatus }
            : lesson
        ),
      }));

      console.log(`[MOCK] Started lesson: ${lessonId}`);
    } catch (error) {
      console.error('Failed to start lesson:', error);
    }
  },

  // Navigate to lesson (UI action, opens SwordGate runner)
  continueLesson: (lessonId: string) => {
    // This would typically trigger navigation to SwordGate runner
    console.log(`[MOCK] Continue lesson: ${lessonId}`);
    // TODO: Call useUIStore.openSwordRunner(lessonId)
  },
}));
