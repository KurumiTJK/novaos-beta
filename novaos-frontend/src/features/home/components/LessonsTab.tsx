// ═══════════════════════════════════════════════════════════════════════════════
// LESSONS TAB — Home Page Tab
// Shows sparks and lessons, wired to real API
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { useLessonStore, useUIStore } from '@/shared/stores';
import { SparkCard } from './SparkCard';
import { LessonCard } from './LessonCard';

export function LessonsTab() {
  const {
    currentSpark,
    lessons,
    activePath,
    stats,
    isLoading,
    error,
    isInitialized,
    fetchLessons,
    completeSpark,
    skipSpark,
    startLesson,
    clearError,
  } = useLessonStore();
  
  const { openSwordDesigner, openSwordRunner } = useUIStore();

  // Fetch data on mount
  useEffect(() => {
    if (!isInitialized) {
      fetchLessons();
    }
  }, [isInitialized, fetchLessons]);

  // Handle spark actions
  const handleCompleteSpark = async () => {
    if (currentSpark) {
      await completeSpark(currentSpark.id);
    }
  };

  const handleSkipSpark = async () => {
    if (currentSpark) {
      await skipSpark(currentSpark.id);
    }
  };

  // Handle lesson actions
  const handleStartLesson = async (lessonId: string) => {
    await startLesson(lessonId);
    openSwordRunner(lessonId);
  };

  const handleContinueLesson = (lessonId: string) => {
    openSwordRunner(lessonId);
  };

  // Loading state
  if (isLoading && !isInitialized) {
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-white/20 border-t-green-500 rounded-full animate-spin" />
      </div>
    );
  }

  // No active plan state
  if (!activePath && isInitialized) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-12 text-center px-6">
        <span className="text-5xl mb-4">⚔️</span>
        <h2 className="text-xl font-semibold text-white mb-2">No Active Plan</h2>
        <p className="text-white/50 text-sm mb-6 max-w-xs">
          Start a learning journey to see your daily lessons and sparks here.
        </p>
        <button
          onClick={() => openSwordDesigner()}
          className="px-6 py-3 bg-green-500 text-black font-medium rounded-full active:opacity-80 transition-opacity"
        >
          Create Learning Plan
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Error Banner */}
      {error && (
        <div className="mx-4 mt-2 mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={clearError} className="text-red-400/50 hover:text-red-400">
            ✕
          </button>
        </div>
      )}

      {/* Stats Row */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔥</span>
            <span className="text-white font-medium">{stats.currentStreak} day streak</span>
          </div>
          <div className="text-white/50 text-sm">
            {stats.sparksCompletedToday} sparks today
          </div>
        </div>
      </div>

      {/* Active Path Progress */}
      {activePath && (
        <div className="px-4 mb-4">
          <div className="bg-[#1C1C1E] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/50 text-xs">CURRENT GOAL</span>
              <span className="text-white/50 text-xs">
                {Math.round(activePath.progress * 100)}%
              </span>
            </div>
            <p className="text-white font-medium mb-3">{activePath.goal}</p>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: `${activePath.progress * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Current Spark */}
      {currentSpark && (
        <div className="px-4 mb-4">
          <h3 className="text-sm font-medium text-white/50 mb-2 uppercase tracking-wide">
            ⚡ Today's Spark
          </h3>
          <SparkCard
            spark={currentSpark}
            onComplete={handleCompleteSpark}
            onSkip={handleSkipSpark}
          />
        </div>
      )}

      {/* Lessons */}
      {lessons.length > 0 && (
        <div className="px-4 pb-6">
          <h3 className="text-sm font-medium text-white/50 mb-3 uppercase tracking-wide">
            📚 Your Lessons
          </h3>
          <div className="space-y-3">
            {lessons.map((lesson) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                onStart={() => handleStartLesson(lesson.id)}
                onContinue={() => handleContinueLesson(lesson.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Refresh hint */}
      {isInitialized && (
        <div className="px-4 pb-6 text-center">
          <button
            onClick={() => fetchLessons()}
            disabled={isLoading}
            className="text-white/30 text-xs active:text-white/50"
          >
            {isLoading ? 'Refreshing...' : 'Pull to refresh'}
          </button>
        </div>
      )}
    </div>
  );
}
