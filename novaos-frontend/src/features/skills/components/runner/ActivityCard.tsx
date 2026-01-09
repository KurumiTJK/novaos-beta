// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITY CARD — Individual Activity Display
// Handles: read, watch, exercise, practice, build, quiz
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { ChevronRightIcon } from '@/shared/components';
import type { Activity, ActivityType } from '@/shared/api/sword';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

interface ActivityCardProps {
  activity: Activity;
  onComplete?: (activityId: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────────
// ACTIVITY TYPE CONFIG
// ─────────────────────────────────────────────────────────────────────────────────

const ACTIVITY_CONFIG: Record<ActivityType, { label: string; color: string; bgColor: string }> = {
  read: { label: 'READ', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  watch: { label: 'WATCH', color: 'text-red-400', bgColor: 'bg-red-500/20' },
  exercise: { label: 'EXERCISE', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
  practice: { label: 'PRACTICE', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
  build: { label: 'BUILD', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
  quiz: { label: 'QUIZ', color: 'text-green-400', bgColor: 'bg-green-500/20' },
};

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────────

export function ActivityCard({ activity, onComplete }: ActivityCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [showAnswers, setShowAnswers] = useState(false);
  
  const config = ACTIVITY_CONFIG[activity.type];

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${
      activity.completed 
        ? 'bg-green-500/5 border-green-500/20' 
        : 'bg-[#1C1C1E] border-white/10'
    }`}>
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center gap-3 text-left"
      >
        {/* Type Badge */}
        <span className={`text-[10px] px-2 py-1 rounded-md font-medium ${config.bgColor} ${config.color}`}>
          {config.label}
        </span>
        
        {/* Title */}
        <span className="flex-1 text-white font-medium truncate">
          {activity.title}
        </span>
        
        {/* Time */}
        <span className="text-white/40 text-xs">
          {activity.estimatedMinutes}min
        </span>
        
        {/* Completed check or expand arrow */}
        {activity.completed ? (
          <span className="text-green-400">✓</span>
        ) : (
          <ChevronRightIcon 
            size={16} 
            className={`text-white/30 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
          />
        )}
      </button>
      
      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-white/5">
          {/* READ Activity */}
          {activity.type === 'read' && (
            <div className="pt-4 space-y-4">
              {activity.explanation && (
                <div className="text-white/80 text-sm whitespace-pre-wrap leading-relaxed">
                  {activity.explanation}
                </div>
              )}
              {activity.article && (
                <a
                  href={activity.article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-blue-400">📄</span>
                    <span className="text-blue-400 text-sm font-medium">
                      {activity.article.title}
                    </span>
                    <span className="text-white/30 text-xs ml-auto">↗</span>
                  </div>
                  {activity.article.snippet && (
                    <p className="text-white/50 text-xs line-clamp-2">
                      {activity.article.snippet}
                    </p>
                  )}
                </a>
              )}
            </div>
          )}
          
          {/* WATCH Activity */}
          {activity.type === 'watch' && (
            <div className="pt-4 space-y-4">
              {activity.video && (
                <a
                  href={activity.video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                >
                  <div className="flex gap-3">
                    {activity.video.thumbnailUrl && (
                      <img 
                        src={activity.video.thumbnailUrl} 
                        alt="" 
                        className="w-24 h-16 object-cover rounded-lg"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white text-sm font-medium line-clamp-2">
                        {activity.video.title}
                      </h4>
                      {activity.video.channelName && (
                        <p className="text-white/50 text-xs mt-1">
                          {activity.video.channelName}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-white/40 text-xs">
                        {activity.video.duration && <span>{activity.video.duration}</span>}
                        {activity.video.viewCount && (
                          <span>{activity.video.viewCount.toLocaleString()} views</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 py-2 bg-red-500 text-white text-center rounded-lg text-sm font-medium">
                    ▶ Open in YouTube
                  </div>
                </a>
              )}
              {activity.focusPoints && activity.focusPoints.length > 0 && (
                <div className="p-3 bg-white/5 rounded-xl">
                  <p className="text-white/50 text-xs mb-2">Focus on:</p>
                  <ul className="space-y-1">
                    {activity.focusPoints.map((point, i) => (
                      <li key={i} className="text-white/80 text-sm flex gap-2">
                        <span className="text-white/30">•</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          
          {/* EXERCISE Activity */}
          {activity.type === 'exercise' && (
            <div className="pt-4 space-y-4">
              {activity.prompt && (
                <div className="text-white/80 text-sm whitespace-pre-wrap leading-relaxed">
                  {activity.prompt}
                </div>
              )}
              {activity.expectedOutcome && (
                <div className="p-3 bg-green-500/10 rounded-xl border border-green-500/20">
                  <p className="text-green-400 text-xs mb-1">Expected Outcome:</p>
                  <p className="text-white/80 text-sm">{activity.expectedOutcome}</p>
                </div>
              )}
              {activity.hints && activity.hints.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowHints(!showHints)}
                    className="text-yellow-400 text-sm flex items-center gap-1"
                  >
                    💡 {showHints ? 'Hide Hints' : 'Show Hints'}
                  </button>
                  {showHints && (
                    <ul className="mt-2 space-y-1 pl-4">
                      {activity.hints.map((hint, i) => (
                        <li key={i} className="text-white/60 text-sm">• {hint}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {activity.solution && (
                <div>
                  <button
                    onClick={() => setShowSolution(!showSolution)}
                    className="text-blue-400 text-sm flex items-center gap-1"
                  >
                    ✅ {showSolution ? 'Hide Solution' : 'Show Solution'}
                  </button>
                  {showSolution && (
                    <div className="mt-2 p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                      <p className="text-white/80 text-sm whitespace-pre-wrap">
                        {activity.solution}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* PRACTICE Activity */}
          {activity.type === 'practice' && (
            <div className="pt-4 space-y-4">
              {activity.steps && activity.steps.length > 0 && (
                <div>
                  <p className="text-white/50 text-xs mb-2">Steps:</p>
                  <ol className="space-y-2">
                    {activity.steps.map((step, i) => (
                      <li key={i} className="text-white/80 text-sm flex gap-2">
                        <span className="text-purple-400 font-medium">{i + 1}.</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {activity.checklist && activity.checklist.length > 0 && (
                <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
                  <p className="text-purple-400 text-xs mb-2">Checklist:</p>
                  {activity.checklist.map((item, i) => (
                    <label key={i} className="flex items-center gap-2 text-white/80 text-sm py-1">
                      <input type="checkbox" className="rounded" />
                      {item}
                    </label>
                  ))}
                </div>
              )}
              {activity.tips && activity.tips.length > 0 && (
                <div className="p-3 bg-white/5 rounded-xl">
                  <p className="text-white/50 text-xs mb-2">Tips:</p>
                  <ul className="space-y-1">
                    {activity.tips.map((tip, i) => (
                      <li key={i} className="text-white/60 text-sm">💡 {tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          
          {/* BUILD Activity */}
          {activity.type === 'build' && (
            <div className="pt-4 space-y-4">
              {activity.objective && (
                <div className="p-3 bg-orange-500/10 rounded-xl border border-orange-500/20">
                  <p className="text-orange-400 text-xs mb-1">Objective:</p>
                  <p className="text-white text-sm font-medium">{activity.objective}</p>
                </div>
              )}
              {activity.requirements && activity.requirements.length > 0 && (
                <div>
                  <p className="text-white/50 text-xs mb-2">Requirements:</p>
                  <ul className="space-y-1">
                    {activity.requirements.map((req, i) => (
                      <li key={i} className="text-white/80 text-sm flex gap-2">
                        <span className="text-orange-400">•</span>
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {activity.guidance && activity.guidance.length > 0 && (
                <div className="p-3 bg-white/5 rounded-xl">
                  <p className="text-white/50 text-xs mb-2">Guidance:</p>
                  <ul className="space-y-1">
                    {activity.guidance.map((g, i) => (
                      <li key={i} className="text-white/60 text-sm">→ {g}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          
          {/* QUIZ Activity */}
          {activity.type === 'quiz' && activity.questions && (
            <div className="pt-4 space-y-4">
              {activity.questions.map((q, qIndex) => (
                <div key={q.id} className="p-3 bg-white/5 rounded-xl">
                  <p className="text-white text-sm font-medium mb-3">
                    {qIndex + 1}. {q.question}
                  </p>
                  <div className="space-y-2">
                    {q.options.map((option, oIndex) => {
                      const isSelected = selectedAnswers[q.id] === option;
                      const isCorrect = option === q.correctAnswer;
                      const showResult = showAnswers && isSelected;
                      
                      return (
                        <button
                          key={oIndex}
                          onClick={() => !showAnswers && setSelectedAnswers(prev => ({
                            ...prev,
                            [q.id]: option
                          }))}
                          disabled={showAnswers}
                          className={`w-full p-3 text-left rounded-lg text-sm transition-colors ${
                            showResult
                              ? isCorrect
                                ? 'bg-green-500/20 border border-green-500/50 text-green-400'
                                : 'bg-red-500/20 border border-red-500/50 text-red-400'
                              : isSelected
                                ? 'bg-green-500/20 border border-green-500/50 text-white'
                                : 'bg-white/5 border border-white/10 text-white/80 hover:bg-white/10'
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                  {showAnswers && selectedAnswers[q.id] !== q.correctAnswer && (
                    <p className="mt-2 text-green-400 text-xs">
                      ✓ Correct answer: {q.correctAnswer}
                    </p>
                  )}
                  {showAnswers && q.explanation && (
                    <p className="mt-2 text-white/50 text-xs">
                      {q.explanation}
                    </p>
                  )}
                </div>
              ))}
              
              {!showAnswers && Object.keys(selectedAnswers).length === activity.questions.length && (
                <button
                  onClick={() => setShowAnswers(true)}
                  className="w-full py-3 bg-green-500 text-black font-medium rounded-xl"
                >
                  Check Answers
                </button>
              )}
            </div>
          )}
          
          {/* Complete Button */}
          {!activity.completed && onComplete && (
            <button
              onClick={() => onComplete(activity.id)}
              className="w-full mt-4 py-3 bg-white/10 text-white font-medium rounded-xl active:bg-white/20 transition-colors"
            >
              Mark Complete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
