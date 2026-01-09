// ═══════════════════════════════════════════════════════════════════════════════
// LESSON CONTENT — Full Daily Lesson Display
// Shows: Session goal, content sections, activities, key points
// ═══════════════════════════════════════════════════════════════════════════════

import { ActivityCard } from './ActivityCard';
import type { DailyLesson, SessionSummary } from '@/shared/api/sword';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

interface LessonContentProps {
  lesson: DailyLesson;
  totalSessions: number;
  previousSummaries?: SessionSummary[];
  onCompleteActivity?: (activityId: string) => void;
  onCompleteSession?: () => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────────

export function LessonContent({
  lesson,
  totalSessions,
  previousSummaries,
  onCompleteActivity,
  onCompleteSession,
  onRegenerate,
  isRegenerating,
}: LessonContentProps) {
  const allActivitiesComplete = lesson.activities?.every(a => a.completed) ?? false;
  const sessionProgress = `${lesson.sessionNumber}/${totalSessions}`;

  return (
    <div className="space-y-6">
      {/* Session Header */}
      <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-2xl p-5 border border-green-500/20">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm">📖</span>
          <span className="text-white/50 text-sm">Session {sessionProgress}</span>
        </div>
        
        {lesson.sessionGoal && (
          <h2 className="text-green-400 text-lg font-medium leading-snug">
            {lesson.sessionGoal}
          </h2>
        )}
      </div>

      {/* Previous Session Recap (if exists) */}
      {previousSummaries && previousSummaries.length > 0 && (
        <div className="bg-[#1C1C1E] rounded-2xl p-4">
          <h3 className="text-white/50 text-sm font-medium mb-3">📝 Previous Session Recap</h3>
          <div className="space-y-2">
            {previousSummaries.slice(-1).map(summary => (
              <div key={summary.id} className="text-white/70 text-sm">
                <p className="mb-2">{summary.summary}</p>
                {summary.keyConcepts.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {summary.keyConcepts.map((concept, i) => (
                      <span 
                        key={i}
                        className="px-2 py-0.5 bg-white/10 rounded text-xs text-white/60"
                      >
                        {concept}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content Sections */}
      {lesson.content && lesson.content.length > 0 && (
        <div className="space-y-4">
          {lesson.content.map((section, index) => (
            <div key={index} className="bg-[#1C1C1E] rounded-2xl p-4">
              <h3 className="text-white font-medium mb-2">{section.title}</h3>
              <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">
                {section.content}
              </p>
              {section.bulletPoints && section.bulletPoints.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {section.bulletPoints.map((point, i) => (
                    <li key={i} className="text-white/60 text-sm flex gap-2">
                      <span className="text-white/30">•</span>
                      {point}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Activities */}
      {lesson.activities && lesson.activities.length > 0 && (
        <div>
          <h3 className="text-white/50 text-sm font-medium mb-3 px-1">Activities</h3>
          <div className="space-y-3">
            {lesson.activities.map(activity => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                onComplete={onCompleteActivity}
              />
            ))}
          </div>
        </div>
      )}

      {/* Key Points */}
      {lesson.keyPoints && lesson.keyPoints.length > 0 && (
        <div className="bg-yellow-500/10 rounded-2xl p-4 border border-yellow-500/20">
          <h3 className="text-yellow-400 text-sm font-medium mb-3">🔑 Key Points</h3>
          <ul className="space-y-2">
            {lesson.keyPoints.map((point, i) => (
              <li key={i} className="text-white/80 text-sm flex gap-2">
                <span className="text-yellow-400">•</span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Complete Session Button */}
      {!lesson.completedAt && onCompleteSession && (
        <div className="pt-2">
          <button
            onClick={onCompleteSession}
            disabled={!allActivitiesComplete}
            className={`w-full py-4 rounded-2xl font-medium transition-colors ${
              allActivitiesComplete
                ? 'bg-green-500 text-black active:opacity-80'
                : 'bg-white/10 text-white/30 cursor-not-allowed'
            }`}
          >
            {allActivitiesComplete ? '✓ Complete Session' : 'Complete all activities first'}
          </button>
          
          {!allActivitiesComplete && lesson.activities && (
            <p className="text-center text-white/30 text-xs mt-2">
              {lesson.activities.filter(a => a.completed).length}/{lesson.activities.length} activities complete
            </p>
          )}
        </div>
      )}

      {/* Regenerate Option */}
      {onRegenerate && (
        <div className="text-center pt-2">
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="text-white/30 text-xs hover:text-white/50 transition-colors"
          >
            {isRegenerating ? 'Regenerating...' : 'Regenerate lesson content'}
          </button>
        </div>
      )}
    </div>
  );
}
