// ═══════════════════════════════════════════════════════════════════════════════
// SWORD FEATURE — Learning Mode Store
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface LearningGoal {
  id: string;
  title: string;
  description: string;
  duration: '1_month' | '3_months' | '6_months';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  createdAt: Date;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
  status: 'locked' | 'ready' | 'in_progress' | 'complete';
  estimatedDays: number;
}

export interface Lesson {
  id: string;
  title: string;
  sections: LessonSection[];
  dayNumber: number;
  status: 'locked' | 'ready' | 'in_progress' | 'complete';
}

export interface LessonSection {
  id: string;
  type: 'content' | 'quiz' | 'exercise' | 'insight';
  title: string;
  content: string;
  options?: string[]; // For quiz
  correctIndex?: number; // For quiz
  completed: boolean;
}

export interface Spark {
  id: string;
  title: string;
  estimatedMinutes: number;
  sections: LessonSection[];
  completedSections: string[];
}

export interface LearningPath {
  id: string;
  goal: LearningGoal;
  quests: Quest[];
  currentQuestIndex: number;
  currentLessonIndex: number;
  totalDays: number;
  completedDays: number;
  dayStreak: number;
  lastActiveDate: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// STATE INTERFACE
// ─────────────────────────────────────────────────────────────────────────────────

type SwordView = 'generator' | 'path' | 'lesson';

interface SwordState {
  currentView: SwordView;
  currentPath: LearningPath | null;
  currentSpark: Spark | null;
  isGenerating: boolean;
  error: string | null;

  // Actions
  setView: (view: SwordView) => void;
  generatePath: (goal: Omit<LearningGoal, 'id' | 'createdAt'>) => Promise<void>;
  startQuest: (questIndex: number) => void;
  startLesson: (questIndex: number, lessonIndex: number) => void;
  completeSection: (sectionId: string, answer?: number) => void;
  completeLesson: () => void;
  completeSpark: () => void;
  updateStreak: () => void;
  clearPath: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK PATH GENERATOR
// ─────────────────────────────────────────────────────────────────────────────────

function generateMockPath(goal: Omit<LearningGoal, 'id' | 'createdAt'>): LearningPath {
  const durationDays = goal.duration === '1_month' ? 30 : goal.duration === '3_months' ? 90 : 180;
  const questCount = 4;
  const lessonsPerQuest = Math.floor(durationDays / questCount / 7) * 7;

  const quests: Quest[] = [
    { title: 'Foundations', description: 'Build your core understanding' },
    { title: 'Core Concepts', description: 'Master the fundamentals' },
    { title: 'Advanced Topics', description: 'Deepen your expertise' },
    { title: 'Applied Projects', description: 'Put it all together' },
  ].map((q, qIndex) => ({
    id: `quest-${qIndex}`,
    title: q.title,
    description: q.description,
    status: qIndex === 0 ? 'ready' : 'locked',
    estimatedDays: lessonsPerQuest,
    lessons: Array.from({ length: lessonsPerQuest }, (_, lIndex) => ({
      id: `quest-${qIndex}-lesson-${lIndex}`,
      title: `Day ${qIndex * lessonsPerQuest + lIndex + 1}`,
      dayNumber: qIndex * lessonsPerQuest + lIndex + 1,
      status: qIndex === 0 && lIndex === 0 ? 'ready' : 'locked',
      sections: generateMockSections(goal.title, lIndex),
    })),
  }));

  return {
    id: `path-${Date.now()}`,
    goal: {
      ...goal,
      id: `goal-${Date.now()}`,
      createdAt: new Date(),
    },
    quests,
    currentQuestIndex: 0,
    currentLessonIndex: 0,
    totalDays: durationDays,
    completedDays: 0,
    dayStreak: 0,
    lastActiveDate: null,
  };
}

function generateMockSections(topic: string, lessonIndex: number): LessonSection[] {
  return [
    {
      id: `section-${lessonIndex}-0`,
      type: 'content',
      title: 'Introduction',
      content: `Today we'll explore an important aspect of ${topic}. This builds on what you've learned so far and introduces new concepts.`,
      completed: false,
    },
    {
      id: `section-${lessonIndex}-1`,
      type: 'content',
      title: 'Key Concepts',
      content: `Here are the main ideas to understand: First, consider the foundational principles. Second, think about how they apply in practice. Third, look for patterns and connections.`,
      completed: false,
    },
    {
      id: `section-${lessonIndex}-2`,
      type: 'quiz',
      title: 'Quick Check',
      content: 'What is the most important factor to consider when applying these concepts?',
      options: [
        'Speed of implementation',
        'Understanding the fundamentals',
        'Following trends',
        'Avoiding all risks',
      ],
      correctIndex: 1,
      completed: false,
    },
    {
      id: `section-${lessonIndex}-3`,
      type: 'insight',
      title: 'Key Insight',
      content: `💡 Remember: Mastery comes from consistent practice over time, not from cramming. Small daily progress compounds into significant results.`,
      completed: false,
    },
    {
      id: `section-${lessonIndex}-4`,
      type: 'exercise',
      title: 'Today\'s Action',
      content: `Take 10 minutes to apply what you learned today. Write down 3 ways you could use these concepts in your own context.`,
      completed: false,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────────

export const useSwordStore = create<SwordState>()(
  persist(
    (set, get) => ({
      currentView: 'generator',
      currentPath: null,
      currentSpark: null,
      isGenerating: false,
      error: null,

      setView: (view) => set({ currentView: view }),

      generatePath: async (goal) => {
        set({ isGenerating: true, error: null });

        // Simulate API call delay
        await new Promise((r) => setTimeout(r, 1500));

        try {
          const path = generateMockPath(goal);
          set({
            currentPath: path,
            currentView: 'path',
            isGenerating: false,
          });
        } catch (error) {
          set({
            error: 'Failed to generate path',
            isGenerating: false,
          });
        }
      },

      startQuest: (questIndex) => {
        const { currentPath } = get();
        if (!currentPath) return;

        const updatedQuests = currentPath.quests.map((q, i) => ({
          ...q,
          status: i === questIndex ? 'in_progress' as const : q.status,
        }));

        set({
          currentPath: {
            ...currentPath,
            quests: updatedQuests,
            currentQuestIndex: questIndex,
            currentLessonIndex: 0,
          },
        });
      },

      startLesson: (questIndex, lessonIndex) => {
        const { currentPath } = get();
        if (!currentPath) return;

        const lesson = currentPath.quests[questIndex]?.lessons[lessonIndex];
        if (!lesson) return;

        // Create a Spark from the lesson
        const spark: Spark = {
          id: `spark-${Date.now()}`,
          title: lesson.title,
          estimatedMinutes: 15,
          sections: lesson.sections,
          completedSections: [],
        };

        set({
          currentSpark: spark,
          currentView: 'lesson',
          currentPath: {
            ...currentPath,
            currentQuestIndex: questIndex,
            currentLessonIndex: lessonIndex,
          },
        });
      },

      completeSection: (sectionId, answer) => {
        const { currentSpark, currentPath } = get();
        if (!currentSpark || !currentPath) return;

        const section = currentSpark.sections.find((s) => s.id === sectionId);
        if (!section) return;

        // Check quiz answer if applicable
        if (section.type === 'quiz' && answer !== section.correctIndex) {
          return; // Don't complete if wrong answer
        }

        set({
          currentSpark: {
            ...currentSpark,
            sections: currentSpark.sections.map((s) =>
              s.id === sectionId ? { ...s, completed: true } : s
            ),
            completedSections: [...currentSpark.completedSections, sectionId],
          },
        });
      },

      completeLesson: () => {
        const { currentPath } = get();
        if (!currentPath) return;

        const { currentQuestIndex, currentLessonIndex, quests } = currentPath;
        const currentQuest = quests[currentQuestIndex];
        const lessonsInQuest = currentQuest.lessons.length;

        // Update lesson status
        const updatedQuests = quests.map((quest, qIndex) => {
          if (qIndex !== currentQuestIndex) return quest;

          return {
            ...quest,
            lessons: quest.lessons.map((lesson, lIndex) => {
              if (lIndex === currentLessonIndex) {
                return { ...lesson, status: 'complete' as const };
              }
              if (lIndex === currentLessonIndex + 1) {
                return { ...lesson, status: 'ready' as const };
              }
              return lesson;
            }),
          };
        });

        // Check if quest is complete
        const isQuestComplete = currentLessonIndex >= lessonsInQuest - 1;
        if (isQuestComplete && currentQuestIndex < quests.length - 1) {
          updatedQuests[currentQuestIndex].status = 'complete';
          updatedQuests[currentQuestIndex + 1].status = 'ready';
        }

        set({
          currentPath: {
            ...currentPath,
            quests: updatedQuests,
            completedDays: currentPath.completedDays + 1,
          },
        });
      },

      completeSpark: () => {
        get().completeLesson();
        get().updateStreak();
        set({ currentSpark: null, currentView: 'path' });
      },

      updateStreak: () => {
        const { currentPath } = get();
        if (!currentPath) return;

        const today = new Date().toDateString();
        const lastActive = currentPath.lastActiveDate;

        let newStreak = currentPath.dayStreak;

        if (lastActive) {
          const lastDate = new Date(lastActive);
          const daysDiff = Math.floor(
            (new Date().getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysDiff === 1) {
            newStreak += 1;
          } else if (daysDiff > 1) {
            newStreak = 1; // Reset streak
          }
          // If daysDiff === 0, keep same streak (already completed today)
        } else {
          newStreak = 1;
        }

        set({
          currentPath: {
            ...currentPath,
            dayStreak: newStreak,
            lastActiveDate: today,
          },
        });
      },

      clearPath: () => {
        set({
          currentPath: null,
          currentSpark: null,
          currentView: 'generator',
        });
      },
    }),
    {
      name: 'novaos-sword',
      partialize: (state) => ({
        currentPath: state.currentPath,
      }),
    }
  )
);
