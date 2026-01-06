// ═══════════════════════════════════════════════════════════════════════════════
// SWORD STORE — Learning Mode State Management
// ═══════════════════════════════════════════════════════════════════════════════
//
// Sword Mode implements Constitution §2.3:
// "Sword enables progress through directed action, combining long-term guidance
// with immediate execution through Path + Spark components."
//
// Structure:
// - Goal: The user's learning objective
// - Quest: A themed collection of lessons (typically 2-4 weeks)
// - Lesson: A single day's learning session with sections
// - Spark: A minimal, low-friction action for immediate forward motion
//
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  LearningGoal,
  LearningPath,
  Quest,
  Lesson,
  LessonSection,
  Spark,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

interface SwordState {
  // Current learning state
  activePath: LearningPath | null;
  currentLesson: Lesson | null;
  currentSpark: Spark | null;
  currentSectionIndex: number;

  // Progress
  dayStreak: number;
  lastActiveDate: string | null;
  totalLessonsCompleted: number;
  totalSparksCompleted: number;

  // UI state
  isGenerating: boolean;
  error: string | null;

  // Actions - Path Management
  generatePath: (goal: string, duration: string, difficulty: string) => Promise<void>;
  loadPath: (pathId: string) => Promise<void>;
  clearPath: () => void;

  // Actions - Quest Navigation
  startQuest: (questId: string) => void;
  completeQuest: (questId: string) => void;

  // Actions - Lesson Management
  startLesson: (lessonId: string) => void;
  completeSection: (sectionId: string, answer?: number) => void;
  completeLesson: () => void;
  nextSection: () => void;
  previousSection: () => void;

  // Actions - Spark
  startSpark: () => void;
  completeSpark: () => void;

  // Actions - Progress
  updateStreak: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK DATA GENERATORS
// ─────────────────────────────────────────────────────────────────────────────────

function generateMockQuests(goalId: string): Quest[] {
  return [
    {
      id: `quest-${goalId}-1`,
      goalId,
      title: 'Foundations',
      icon: '📚',
      weeks: '1-3',
      lessonCount: 9,
      status: 'ready',
      progress: 0,
    },
    {
      id: `quest-${goalId}-2`,
      goalId,
      title: 'Core Concepts',
      icon: '🧮',
      weeks: '4-6',
      lessonCount: 9,
      status: 'locked',
      progress: 0,
    },
    {
      id: `quest-${goalId}-3`,
      goalId,
      title: 'Advanced Topics',
      icon: '🧠',
      weeks: '7-9',
      lessonCount: 9,
      status: 'locked',
      progress: 0,
    },
    {
      id: `quest-${goalId}-4`,
      goalId,
      title: 'Applied Projects',
      icon: '🚀',
      weeks: '10-12',
      lessonCount: 9,
      status: 'locked',
      progress: 0,
    },
  ];
}

function generateMockLesson(lessonId: string, dayNumber: number): Lesson {
  return {
    id: lessonId,
    questId: 'quest-1',
    title: `Lesson ${dayNumber}: Core Concepts`,
    dayNumber,
    estimatedMinutes: 15,
    status: 'ready',
    sections: [
      {
        id: `${lessonId}-s1`,
        type: 'content',
        title: 'Introduction',
        content: 'Welcome to today\'s lesson. We\'ll explore fundamental concepts that build on yesterday\'s material.',
        completed: false,
      },
      {
        id: `${lessonId}-s2`,
        type: 'content',
        title: 'Key Concept',
        content: 'The main concept we\'re covering today is essential for understanding the broader topic. Pay attention to how it connects to what we learned before.',
        completed: false,
      },
      {
        id: `${lessonId}-s3`,
        type: 'quiz',
        title: 'Quick Check',
        content: 'Test your understanding with this quick question.',
        quiz: {
          question: 'Which of the following best describes the concept we just learned?',
          options: [
            'Option A - The first possibility',
            'Option B - The correct answer',
            'Option C - Another possibility',
          ],
          correctIndex: 1,
          explanation: 'Option B is correct because it accurately captures the key insight from the lesson.',
        },
        completed: false,
      },
      {
        id: `${lessonId}-s4`,
        type: 'insight',
        title: 'Key Takeaway',
        content: '💡 Remember: The most important thing from today\'s lesson is to understand the foundational principle before moving on.',
        completed: false,
      },
      {
        id: `${lessonId}-s5`,
        type: 'content',
        title: 'Summary',
        content: 'Great work! You\'ve completed today\'s lesson. Tomorrow we\'ll build on these concepts.',
        completed: false,
      },
    ],
  };
}

function generateMockSpark(lessonId: string): Spark {
  return {
    id: `spark-${lessonId}`,
    lessonId,
    title: 'Today\'s Spark',
    description: 'Complete the intro video and answer 3 reflection questions.',
    estimatedMinutes: 15,
    status: 'pending',
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────────

export const useSwordStore = create<SwordState>()(
  persist(
    (set, get) => ({
      // Initial state
      activePath: null,
      currentLesson: null,
      currentSpark: null,
      currentSectionIndex: 0,
      dayStreak: 0,
      lastActiveDate: null,
      totalLessonsCompleted: 0,
      totalSparksCompleted: 0,
      isGenerating: false,
      error: null,

      // Generate a new learning path from a goal
      generatePath: async (goalTitle: string, duration: string, difficulty: string) => {
        set({ isGenerating: true, error: null });
        
        try {
          // TODO: Call backend to generate path with AI
          // For now, generate mock data
          await new Promise((resolve) => setTimeout(resolve, 1500));
          
          const goalId = `goal-${Date.now()}`;
          const goal: LearningGoal = {
            id: goalId,
            title: goalTitle,
            description: `Master ${goalTitle.toLowerCase()} through structured learning`,
            duration,
            difficulty: difficulty as 'beginner' | 'intermediate' | 'advanced',
            tags: goalTitle.toLowerCase().split(' '),
            createdAt: Date.now(),
          };

          const quests = generateMockQuests(goalId);
          
          const path: LearningPath = {
            goal,
            quests,
            currentQuestId: quests[0].id,
            totalProgress: 0,
            dayStreak: get().dayStreak,
          };

          set({
            activePath: path,
            isGenerating: false,
          });
        } catch (error) {
          set({
            error: (error as Error).message || 'Failed to generate path',
            isGenerating: false,
          });
        }
      },

      // Load an existing path
      loadPath: async (pathId: string) => {
        set({ isGenerating: true, error: null });
        
        try {
          // TODO: Load from backend
          await new Promise((resolve) => setTimeout(resolve, 500));
          
          // Mock: regenerate path
          const goal: LearningGoal = {
            id: pathId,
            title: 'Loaded Learning Path',
            description: 'Continuing your learning journey',
            duration: '12 weeks',
            difficulty: 'intermediate',
            tags: ['learning'],
            createdAt: Date.now(),
          };

          const path: LearningPath = {
            goal,
            quests: generateMockQuests(pathId),
            totalProgress: 15,
            dayStreak: get().dayStreak,
          };

          set({
            activePath: path,
            isGenerating: false,
          });
        } catch (error) {
          set({
            error: (error as Error).message || 'Failed to load path',
            isGenerating: false,
          });
        }
      },

      // Clear current path
      clearPath: () => {
        set({
          activePath: null,
          currentLesson: null,
          currentSpark: null,
          currentSectionIndex: 0,
        });
      },

      // Start a quest
      startQuest: (questId: string) => {
        set((state) => {
          if (!state.activePath) return state;
          
          return {
            activePath: {
              ...state.activePath,
              currentQuestId: questId,
              quests: state.activePath.quests.map((q) =>
                q.id === questId ? { ...q, status: 'in_progress' } : q
              ),
            },
          };
        });
      },

      // Complete a quest
      completeQuest: (questId: string) => {
        set((state) => {
          if (!state.activePath) return state;
          
          const questIndex = state.activePath.quests.findIndex((q) => q.id === questId);
          const nextQuest = state.activePath.quests[questIndex + 1];
          
          return {
            activePath: {
              ...state.activePath,
              currentQuestId: nextQuest?.id,
              quests: state.activePath.quests.map((q, i) => {
                if (q.id === questId) return { ...q, status: 'complete', progress: 100 };
                if (i === questIndex + 1) return { ...q, status: 'ready' };
                return q;
              }),
            },
          };
        });
      },

      // Start a lesson
      startLesson: (lessonId: string) => {
        const lesson = generateMockLesson(lessonId, 5);
        const spark = generateMockSpark(lessonId);
        
        set({
          currentLesson: { ...lesson, status: 'in_progress' },
          currentSpark: spark,
          currentSectionIndex: 0,
        });
        
        get().updateStreak();
      },

      // Complete a section
      completeSection: (sectionId: string, answer?: number) => {
        set((state) => {
          if (!state.currentLesson) return state;
          
          const sections = state.currentLesson.sections.map((s) => {
            if (s.id === sectionId) {
              // For quiz sections, check if answer is correct
              if (s.type === 'quiz' && s.quiz && answer !== undefined) {
                const isCorrect = answer === s.quiz.correctIndex;
                return { ...s, completed: isCorrect };
              }
              return { ...s, completed: true };
            }
            return s;
          });
          
          return {
            currentLesson: { ...state.currentLesson, sections },
          };
        });
      },

      // Complete the current lesson
      completeLesson: () => {
        set((state) => ({
          currentLesson: state.currentLesson
            ? { ...state.currentLesson, status: 'complete' }
            : null,
          totalLessonsCompleted: state.totalLessonsCompleted + 1,
          activePath: state.activePath
            ? {
                ...state.activePath,
                totalProgress: Math.min(100, state.activePath.totalProgress + 3),
              }
            : null,
        }));
      },

      // Navigate to next section
      nextSection: () => {
        set((state) => {
          if (!state.currentLesson) return state;
          const maxIndex = state.currentLesson.sections.length - 1;
          return {
            currentSectionIndex: Math.min(state.currentSectionIndex + 1, maxIndex),
          };
        });
      },

      // Navigate to previous section
      previousSection: () => {
        set((state) => ({
          currentSectionIndex: Math.max(state.currentSectionIndex - 1, 0),
        }));
      },

      // Start today's spark
      startSpark: () => {
        set((state) => ({
          currentSpark: state.currentSpark
            ? { ...state.currentSpark, status: 'in_progress' }
            : null,
        }));
      },

      // Complete today's spark
      completeSpark: () => {
        set((state) => ({
          currentSpark: state.currentSpark
            ? { ...state.currentSpark, status: 'complete' }
            : null,
          totalSparksCompleted: state.totalSparksCompleted + 1,
        }));
      },

      // Update streak (call when user completes any activity)
      updateStreak: () => {
        const today = new Date().toISOString().split('T')[0];
        const { lastActiveDate, dayStreak } = get();
        
        if (lastActiveDate === today) {
          // Already active today, no change
          return;
        }
        
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];
        
        if (lastActiveDate === yesterday) {
          // Continuing streak
          set({
            dayStreak: dayStreak + 1,
            lastActiveDate: today,
          });
        } else {
          // Streak broken, start fresh
          set({
            dayStreak: 1,
            lastActiveDate: today,
          });
        }
      },
    }),
    {
      name: 'novaos-sword',
      partialize: (state) => ({
        activePath: state.activePath,
        dayStreak: state.dayStreak,
        lastActiveDate: state.lastActiveDate,
        totalLessonsCompleted: state.totalLessonsCompleted,
        totalSparksCompleted: state.totalSparksCompleted,
      }),
    }
  )
);

export default useSwordStore;
