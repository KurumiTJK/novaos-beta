// ═══════════════════════════════════════════════════════════════════════════════
// LESSONS TAB — Home page lessons content
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { useLessonStore } from '@/shared/stores/lessonStore';
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
    fetchLessons 
  } = useLessonStore();

  // ═══════════════════════════════════════════════════════════════════════════
  // TODO: Fetch lessons on mount when API is wired
  // Currently using mock data from store initial state
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    // fetchLessons(); // Uncomment when API is ready
  }, []);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-purple-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-white/50 text-sm">Loading lessons...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center px-5">
        <div className="text-center">
          <span className="text-3xl mb-3 block">⚠️</span>
          <p className="text-white/50 text-sm">{error}</p>
          <button
            onClick={() => fetchLessons()}
            className="mt-3 px-4 py-2 bg-purple-500 rounded-xl text-white text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No lessons yet
  if (lessons.length === 0 && !currentSpark) {
    return (
      <div className="flex-1 flex items-center justify-center px-5">
        <div className="text-center">
          <span className="text-4xl mb-4 block">📚</span>
          <h3 className="text-white font-medium mb-2">No lessons yet</h3>
          <p className="text-white/50 text-sm mb-4">
            Start a conversation to create your first learning plan
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-y-auto pb-4">
      {/* Stats Row */}
      <div className="flex gap-2">
        <div className="flex-1 bg-nova-dark rounded-xl p-3 text-center">
          <div className="text-white text-lg font-semibold">{stats.currentStreak}</div>
          <div className="text-white/40 text-xs">Day Streak 🔥</div>
        </div>
        <div className="flex-1 bg-nova-dark rounded-xl p-3 text-center">
          <div className="text-white text-lg font-semibold">{stats.sparksCompletedToday}</div>
          <div className="text-white/40 text-xs">Sparks Today ⚡</div>
        </div>
        <div className="flex-1 bg-nova-dark rounded-xl p-3 text-center">
          <div className="text-white text-lg font-semibold">{stats.totalLessonsCompleted}</div>
          <div className="text-white/40 text-xs">Completed ✓</div>
        </div>
      </div>

      {/* Current Spark */}
      {currentSpark && (
        <div>
          <SparkCard spark={currentSpark} />
        </div>
      )}

      {/* Active Path Progress */}
      {activePath && (
        <div className="bg-nova-dark rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-white/70 text-sm font-medium">🎯 Current Goal</h4>
            <span className="text-purple-400 text-sm">{Math.round(activePath.progress * 100)}%</span>
          </div>
          <p className="text-white text-[15px] mb-3">{activePath.goal}</p>
          
          {/* Progress bar */}
          <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all"
              style={{ width: `${activePath.progress * 100}%` }}
            />
          </div>

          {/* Milestones */}
          <div className="space-y-2">
            {activePath.milestones.slice(0, 3).map((milestone) => (
              <div key={milestone.id} className="flex items-center gap-2 text-sm">
                <span className={milestone.completed ? 'text-green-400' : 'text-white/30'}>
                  {milestone.completed ? '✓' : '○'}
                </span>
                <span className={milestone.completed ? 'text-white/50 line-through' : 'text-white/70'}>
                  {milestone.title}
                </span>
              </div>
            ))}
            {activePath.milestones.length > 3 && (
              <p className="text-white/30 text-xs ml-5">
                +{activePath.milestones.length - 3} more milestones
              </p>
            )}
          </div>
        </div>
      )}

      {/* Lessons List */}
      <div>
        <h3 className="text-white/70 text-sm font-medium mb-3 px-1">📚 Your Lessons</h3>
        <div className="space-y-2">
          {lessons.map((lesson) => (
            <LessonCard key={lesson.id} lesson={lesson} />
          ))}
        </div>
      </div>
    </div>
  );
}
