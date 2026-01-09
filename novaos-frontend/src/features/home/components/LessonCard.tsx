// ═══════════════════════════════════════════════════════════════════════════════
// LESSON CARD — Learning module card
// ═══════════════════════════════════════════════════════════════════════════════

import type { Lesson } from '@/shared/stores/lessonStore';

interface LessonCardProps {
  lesson: Lesson;
  onStart?: () => void;
  onContinue?: () => void;
}

export function LessonCard({ lesson, onStart, onContinue }: LessonCardProps) {
  const progressPercent = Math.round(lesson.progress * 100);
  const isLocked = lesson.status === 'locked';
  const isInProgress = lesson.status === 'in_progress';
  const isCompleted = lesson.status === 'completed';
  const isAvailable = lesson.status === 'available';

  const handleAction = () => {
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
    
    if (isInProgress || isCompleted) {
      onContinue?.();
    } else if (isAvailable) {
      onStart?.();
    }
  };

  // Determine if the card is interactive
  const isInteractive = !isLocked && (onStart || onContinue);

  return (
    <button
      onClick={handleAction}
      disabled={isLocked || !isInteractive}
      className={`
        w-full bg-[#1C1C1E] rounded-2xl p-4 text-left transition-all
        ${isLocked ? 'opacity-50' : isInteractive ? 'active:bg-[#2C2C2E]' : ''}
        ${!isInteractive ? 'cursor-default' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        {/* Emoji Icon */}
        <div className={`
          w-12 h-12 rounded-xl flex items-center justify-center text-2xl
          ${isCompleted ? 'bg-green-500/20' : 
            isInProgress ? 'bg-purple-500/20' : 
            isAvailable ? 'bg-white/10' : 'bg-white/5'}
        `}>
          {isCompleted ? '✓' : isLocked ? '🔒' : lesson.emoji}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className={`font-medium truncate ${
              isLocked ? 'text-white/50' : 'text-white'
            }`}>
              {lesson.title}
            </h3>
            
            {/* Status Badge */}
            {isInProgress && (
              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full flex-shrink-0">
                In Progress
              </span>
            )}
            {isCompleted && (
              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full flex-shrink-0">
                Complete
              </span>
            )}
          </div>

          <p className={`text-sm mb-2 line-clamp-1 ${
            isLocked ? 'text-white/30' : 'text-white/50'
          }`}>
            {lesson.description}
          </p>

          {/* Progress Bar */}
          {!isLocked && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isCompleted ? 'bg-green-500' : 'bg-purple-500'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-white/30 text-xs flex-shrink-0">
                {lesson.completedSessions}/{lesson.totalSessions}
              </span>
            </div>
          )}

          {/* Locked Message */}
          {isLocked && (
            <p className="text-white/30 text-xs">
              Complete previous lessons to unlock
            </p>
          )}
        </div>

        {/* Arrow - only show if interactive */}
        {!isLocked && isInteractive && (
          <div className="text-white/20 flex-shrink-0 self-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        )}
      </div>
    </button>
  );
}
