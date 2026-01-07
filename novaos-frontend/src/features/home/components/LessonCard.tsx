// ═══════════════════════════════════════════════════════════════════════════════
// LESSON CARD — Individual lesson progress display
// ═══════════════════════════════════════════════════════════════════════════════

import { useHaptic } from '@/shared/hooks';
import { useUIStore } from '@/shared/stores';
import { useLessonStore } from '@/shared/stores/lessonStore';
import type { Lesson } from '@/shared/stores/lessonStore';

interface LessonCardProps {
  lesson: Lesson;
}

export function LessonCard({ lesson }: LessonCardProps) {
  const haptic = useHaptic();
  const { openSwordRunner } = useUIStore();
  const { startLesson } = useLessonStore();

  const handleClick = async () => {
    haptic('light');
    
    if (lesson.status === 'locked') {
      // Can't interact with locked lessons
      return;
    }
    
    if (lesson.status === 'available') {
      // Start the lesson first
      await startLesson(lesson.id);
    }
    
    // Open SwordGate runner with this lesson
    // ═══════════════════════════════════════════════════════════════════════════
    // TODO: Pass actual planId from lesson data
    // openSwordRunner(lesson.planId);
    // ═══════════════════════════════════════════════════════════════════════════
    openSwordRunner(lesson.id);
  };

  const progressPercent = Math.round(lesson.progress * 100);
  const isLocked = lesson.status === 'locked';
  const isCompleted = lesson.status === 'completed';
  const isInProgress = lesson.status === 'in_progress';

  return (
    <button
      onClick={handleClick}
      disabled={isLocked}
      className={`w-full rounded-2xl p-4 text-left transition-all ${
        isLocked
          ? 'bg-white/5 opacity-60 cursor-not-allowed'
          : 'bg-nova-dark active:bg-nova-dark/80'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Emoji Icon */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
          isLocked ? 'bg-white/5' : 'bg-white/10'
        }`}>
          {isLocked ? '🔒' : lesson.emoji}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="flex items-center gap-2">
            <h3 className={`font-medium truncate ${
              isLocked ? 'text-white/40' : 'text-white'
            }`}>
              {lesson.title}
            </h3>
            {isCompleted && (
              <span className="text-green-400 text-sm">✓</span>
            )}
          </div>

          {/* Description or Status */}
          <p className={`text-sm mt-0.5 ${
            isLocked ? 'text-white/30' : 'text-white/50'
          }`}>
            {isLocked 
              ? 'Complete prerequisites to unlock'
              : lesson.description
            }
          </p>

          {/* Progress bar (only for in-progress or completed) */}
          {(isInProgress || isCompleted) && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-white/40">
                  Session {lesson.completedSessions}/{lesson.totalSessions}
                </span>
                <span className={isCompleted ? 'text-green-400' : 'text-purple-400'}>
                  {progressPercent}%
                </span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isCompleted ? 'bg-green-400' : 'bg-purple-500'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Action hint for available lessons */}
          {lesson.status === 'available' && (
            <div className="mt-2 flex items-center gap-1 text-purple-400 text-xs">
              <span>Ready to start</span>
              <span>→</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
