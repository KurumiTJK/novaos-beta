// ═══════════════════════════════════════════════════════════════════════════════
// SWORD RUNNER — Execute Learning Session
// Full lesson flow: Start Subskill → Start Session → View Content → Complete
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { useUIStore } from '@/shared/stores';
import { 
  getToday, 
  getPlan,
  startSubskillLearning,
  startSession,
  completeSession,
  regenerateSession,
  getAllSubskills,
  type TodayState, 
  type LearningPlan,
  type Subskill,
  type DailyLesson,
  type SessionSummary,
  type SubskillLessonPlan,
} from '@/shared/api/sword';
import { LessonContent } from './runner/LessonContent';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

type RunnerState = 
  | 'loading'
  | 'no_plan'
  | 'idle'              // Has subskill, no lesson plan yet
  | 'has_lesson_plan'   // Lesson plan generated, no session content yet
  | 'has_session'       // Session content ready
  | 'completed'         // Session completed
  | 'all_done';         // All sparks done for today

interface SwordRunnerProps {
  planId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────────

export function SwordRunner({ planId }: SwordRunnerProps) {
  const { closeSword, openSwordDesigner } = useUIStore();
  
  // Core state
  const [runnerState, setRunnerState] = useState<RunnerState>('loading');
  const [plan, setPlan] = useState<LearningPlan | null>(null);
  const [todayState, setTodayState] = useState<TodayState | null>(null);
  const [currentSubskill, setCurrentSubskill] = useState<Subskill | null>(null);
  const [allSubskills, setAllSubskills] = useState<Subskill[]>([]);
  
  // Lesson state
  const [lessonPlan, setLessonPlan] = useState<SubskillLessonPlan | null>(null);
  const [dailyLesson, setDailyLesson] = useState<DailyLesson | null>(null);
  const [previousSummaries, setPreviousSummaries] = useState<SessionSummary[]>([]);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─────────────────────────────────────────────────────────────────────────────────
  // FETCH INITIAL STATE
  // ─────────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function fetchState() {
      setRunnerState('loading');
      setError(null);
      
      try {
        // Fetch today's state
        const today = await getToday();
        setTodayState(today);
        
        // If no active plan
        if (!today?.hasActivePlan && !planId) {
          setRunnerState('no_plan');
          return;
        }
        
        // Fetch plan details
        const targetPlanId = planId || today?.plan?.id;
        if (targetPlanId) {
          const planData = await getPlan(targetPlanId);
          setPlan(planData);
          
          // Fetch all subskills
          const subskills = await getAllSubskills(targetPlanId);
          setAllSubskills(subskills);
        }
        
        // Set current subskill from today state
        if (today?.currentSubskill) {
          setCurrentSubskill(today.currentSubskill);
          
          // Determine state based on subskill status
          // NOTE: Even if status is 'active'/'in_progress', we need to check if lesson plan exists
          // The backend requires startSubskillLearning to be called first to create the lesson plan
          if (today.currentSubskill.status === 'pending') {
            setRunnerState('idle');
          } else if (today.currentSubskill.status === 'active' || today.currentSubskill.status === 'in_progress') {
            // Status is active but we don't have the lesson plan in memory
            // Set to 'has_lesson_plan' state - handleStartSession will ensure lesson plan exists
            setRunnerState('has_lesson_plan');
          }
        } else {
          setRunnerState('all_done');
        }
      } catch (err) {
        console.error('[RUNNER] Failed to fetch state:', err);
        setError(err instanceof Error ? err.message : 'Failed to load learning session');
        setRunnerState('no_plan');
      }
    }
    
    fetchState();
  }, [planId]);

  // ─────────────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────────────────────────

  // Start subskill (generates lesson plan)
  const handleStartSubskill = useCallback(async () => {
    if (!currentSubskill || isLoading) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await startSubskillLearning(currentSubskill.id);
      
      if (result.lessonPlan) {
        setLessonPlan(result.lessonPlan);
      }
      
      // Update subskill with returned data
      if (result.subskill) {
        setCurrentSubskill(result.subskill);
      }
      
      setRunnerState('has_lesson_plan');
    } catch (err) {
      console.error('[RUNNER] Failed to start subskill:', err);
      setError(err instanceof Error ? err.message : 'Failed to start subskill');
    } finally {
      setIsLoading(false);
    }
  }, [currentSubskill, isLoading]);

  // Start session (generates daily lesson content)
  // FIXED: Now ensures lesson plan exists by calling startSubskillLearning first if needed
  const handleStartSession = useCallback(async () => {
    if (!currentSubskill || isLoading) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // IMPORTANT: Ensure lesson plan exists before starting session
      // The backend requires startSubskillLearning to be called first
      // This creates the lesson plan in Redis that startSession needs
      if (!lessonPlan) {
        console.log('[RUNNER] No lesson plan in memory, calling startSubskillLearning first...');
        const subskillResult = await startSubskillLearning(currentSubskill.id);
        
        if (subskillResult.lessonPlan) {
          setLessonPlan(subskillResult.lessonPlan);
        }
        
        if (subskillResult.subskill) {
          setCurrentSubskill(subskillResult.subskill);
        }
      }
      
      // Now start the session (generates daily lesson content)
      const result = await startSession(currentSubskill.id);
      
      setDailyLesson(result.dailyLesson);
      setPreviousSummaries(result.previousSummaries || []);
      setRunnerState('has_session');
    } catch (err) {
      console.error('[RUNNER] Failed to start session:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate lesson');
    } finally {
      setIsLoading(false);
    }
  }, [currentSubskill, isLoading, lessonPlan]);

  // Complete activity (local state only - no API endpoint exists)
  const handleCompleteActivity = useCallback(async (activityId: string) => {
    if (!dailyLesson) return;
    
    // Update local state only - activities are tracked locally
    // and submitted together when session is completed
    setDailyLesson(prev => {
      if (!prev || !prev.activities) return prev;
      return {
        ...prev,
        activities: prev.activities.map(a => 
          a.id === activityId ? { ...a, completed: true } : a
        ),
      };
    });
  }, [dailyLesson]);

  // Complete session
  const handleCompleteSession = useCallback(async () => {
    if (!dailyLesson || isLoading) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await completeSession(dailyLesson.id);
      
      // Update subskill
      if (result.subskill) {
        setCurrentSubskill(result.subskill);
      }
      
      // Check if there's more to do
      if (result.isSubskillComplete) {
        // Refresh today state to get next subskill
        const today = await getToday();
        setTodayState(today);
        
        if (today?.currentSubskill) {
          setCurrentSubskill(today.currentSubskill);
          setLessonPlan(null);
          setDailyLesson(null);
          setRunnerState('idle');
        } else {
          setRunnerState('all_done');
        }
      } else if (result.isKnowledgeCheckNext) {
        // Knowledge check coming - for now just show completed
        setRunnerState('completed');
      } else {
        // More sessions in this subskill
        setDailyLesson(null);
        setRunnerState('has_lesson_plan');
      }
    } catch (err) {
      console.error('[RUNNER] Failed to complete session:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete session');
    } finally {
      setIsLoading(false);
    }
  }, [dailyLesson, isLoading]);

  // Regenerate session
  const handleRegenerate = useCallback(async () => {
    if (!currentSubskill || !dailyLesson || isRegenerating) return;
    
    setIsRegenerating(true);
    setError(null);
    
    try {
      const result = await regenerateSession(
        currentSubskill.id, 
        dailyLesson.sessionNumber
      );
      
      setDailyLesson(result);
    } catch (err) {
      console.error('[RUNNER] Failed to regenerate session:', err);
      setError(err instanceof Error ? err.message : 'Failed to regenerate lesson');
    } finally {
      setIsRegenerating(false);
    }
  }, [currentSubskill, dailyLesson, isRegenerating]);

  // ─────────────────────────────────────────────────────────────────────────────────
  // COMPUTED VALUES
  // ─────────────────────────────────────────────────────────────────────────────────

  const sessionNumber = currentSubskill?.completedSessions 
    ? currentSubskill.completedSessions + 1 
    : 1;
  const totalSessions = currentSubskill?.estimatedSessions || 5;

  // ─────────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 max-w-[430px] mx-auto bg-black flex flex-col z-50">
      {/* Header */}
      <header 
        className="flex items-center justify-between px-5 py-3 border-b border-white/10 flex-shrink-0"
        style={{ paddingTop: 'calc(12px + env(safe-area-inset-top))' }}
      >
        <h2 className="text-white font-semibold text-lg">Learn</h2>
        <button
          onClick={closeSword}
          className="text-blue-400 font-medium"
        >
          Exit
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Stats Bar */}
        {todayState && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔥</span>
              <div>
                <div className="text-white font-medium">
                  {todayState.progress?.streak || 0} day streak
                </div>
                <div className="text-white/50 text-xs">Keep it going!</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-white font-medium">
                {todayState.progress?.completedToday || 0}/3
              </div>
              <div className="text-white/50 text-xs">Today's sparks</div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* State: LOADING */}
        {runnerState === 'loading' && (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-white/20 border-t-green-500 rounded-full animate-spin" />
          </div>
        )}

        {/* State: NO_PLAN */}
        {runnerState === 'no_plan' && (
          <div className="text-center py-12">
            <span className="text-5xl mb-4 block">📚</span>
            <h3 className="text-white font-medium text-lg mb-2">No Active Plan</h3>
            <p className="text-white/50 text-sm mb-6">
              Create a learning plan to start your journey
            </p>
            <button
              onClick={() => {
                closeSword();
                setTimeout(() => openSwordDesigner(), 100);
              }}
              className="px-6 py-3 bg-green-500 text-black font-medium rounded-xl"
            >
              Create Learning Plan
            </button>
          </div>
        )}

        {/* State: ALL_DONE */}
        {runnerState === 'all_done' && (
          <div className="text-center py-12">
            <span className="text-5xl mb-4 block">🎉</span>
            <h3 className="text-white font-medium text-lg mb-2">All Done for Today!</h3>
            <p className="text-white/50 text-sm mb-6">
              Great work! Come back tomorrow for more learning.
            </p>
            <button
              onClick={closeSword}
              className="px-6 py-3 bg-[#1C1C1E] text-white font-medium rounded-xl"
            >
              Close
            </button>
          </div>
        )}

        {/* Current Subskill Card */}
        {currentSubskill && runnerState !== 'loading' && runnerState !== 'no_plan' && runnerState !== 'all_done' && (
          <div className="bg-[#1C1C1E] rounded-2xl p-4">
            {plan && (
              <div className="text-xs text-white/50 mb-1">{plan.title}</div>
            )}
            
            <div className="flex items-center gap-2 mb-2">
              {currentSubskill.route && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  currentSubskill.route === 'recall' ? 'bg-blue-500/20 text-blue-400' :
                  currentSubskill.route === 'practice' ? 'bg-purple-500/20 text-purple-400' :
                  'bg-orange-500/20 text-orange-400'
                }`}>
                  {currentSubskill.route.toUpperCase()}
                </span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                currentSubskill.status === 'active' || currentSubskill.status === 'in_progress'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-white/10 text-white/50'
              }`}>
                {currentSubskill.status === 'in_progress' ? 'ACTIVE' : currentSubskill.status?.toUpperCase()}
              </span>
            </div>
            
            <h3 className="text-white font-medium text-lg">{currentSubskill.title}</h3>
            <p className="text-white/50 text-sm mt-1">{currentSubskill.description}</p>
            
            {/* Progress */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-white/40">
                  Session {sessionNumber}/{totalSessions}
                </span>
                <span className="text-white/40">
                  {Math.round((currentSubskill.progress || 0) * 100)}%
                </span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${(currentSubskill.progress || 0) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* State: IDLE - Need to start subskill */}
        {runnerState === 'idle' && (
          <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-2xl p-5 border border-green-500/20">
            <div className="text-center mb-4">
              <span className="text-4xl">🚀</span>
              <h3 className="text-white font-medium text-lg mt-2">Ready to Learn?</h3>
              <p className="text-white/50 text-sm mt-1">
                Start this subskill to generate your personalized lesson plan.
              </p>
            </div>
            
            <button
              onClick={handleStartSubskill}
              disabled={isLoading}
              className="w-full py-4 bg-green-500 text-black font-medium rounded-xl disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  Generating Plan...
                </span>
              ) : (
                'Start Subskill'
              )}
            </button>
          </div>
        )}

        {/* State: HAS_LESSON_PLAN - Need to start session */}
        {runnerState === 'has_lesson_plan' && (
          <div className="space-y-4">
            {/* Lesson Plan Summary */}
            {lessonPlan && (
              <div className="bg-[#1C1C1E] rounded-2xl p-4">
                <h4 className="text-white/50 text-sm mb-3">📋 Lesson Plan</h4>
                
                {lessonPlan.learningObjectives && lessonPlan.learningObjectives.length > 0 && (
                  <div className="mb-4">
                    <p className="text-white/40 text-xs mb-2">Learning Objectives:</p>
                    <ul className="space-y-1">
                      {lessonPlan.learningObjectives.map((obj, i) => (
                        <li key={i} className="text-white/70 text-sm flex gap-2">
                          <span className="text-green-400">•</span>
                          {obj}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {lessonPlan.sessionOutline && lessonPlan.sessionOutline.length > 0 && (
                  <div>
                    <p className="text-white/40 text-xs mb-2">Sessions:</p>
                    <div className="space-y-2">
                      {lessonPlan.sessionOutline.map((session, i) => (
                        <div 
                          key={i}
                          className={`p-3 rounded-xl ${
                            i + 1 === sessionNumber 
                              ? 'bg-green-500/10 border border-green-500/20' 
                              : 'bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              i + 1 === sessionNumber
                                ? 'bg-green-500 text-black'
                                : i + 1 < sessionNumber
                                  ? 'bg-white/20 text-white/60'
                                  : 'bg-white/10 text-white/40'
                            }`}>
                              {i + 1 < sessionNumber ? '✓' : i + 1}
                            </span>
                            <span className="text-white text-sm font-medium">
                              {session.title}
                            </span>
                            <span className="text-white/30 text-xs ml-auto">
                              ~{session.estimatedMinutes}min
                            </span>
                          </div>
                          <p className="text-white/50 text-xs">{session.focus}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Start Session Button */}
            <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-2xl p-5 border border-green-500/20">
              <div className="text-center mb-4">
                <span className="text-4xl">📖</span>
                <h3 className="text-white font-medium text-lg mt-2">
                  Session {sessionNumber} Ready
                </h3>
                <p className="text-white/50 text-sm mt-1">
                  Generate today's lesson content to start learning.
                </p>
              </div>
              
              <button
                onClick={handleStartSession}
                disabled={isLoading}
                className="w-full py-4 bg-green-500 text-black font-medium rounded-xl disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    Generating Lesson...
                  </span>
                ) : (
                  'Start Session'
                )}
              </button>
            </div>
          </div>
        )}

        {/* State: HAS_SESSION - Show lesson content */}
        {runnerState === 'has_session' && dailyLesson && currentSubskill && (
          <LessonContent
            lesson={dailyLesson}
            totalSessions={totalSessions}
            previousSummaries={previousSummaries}
            onCompleteActivity={handleCompleteActivity}
            onCompleteSession={handleCompleteSession}
            onRegenerate={handleRegenerate}
            isRegenerating={isRegenerating}
          />
        )}
      </div>

      {/* All Subskills Progress (Footer) */}
      {allSubskills.length > 0 && (
        <div className="px-5 py-3 border-t border-white/5 flex-shrink-0">
          <div className="flex items-center justify-between text-xs text-white/40 mb-2">
            <span>All Subskills</span>
            <span>
              {allSubskills.filter(s => s.status === 'mastered' || s.status === 'skipped').length}
              /{allSubskills.length}
            </span>
          </div>
          <div className="flex gap-1">
            {allSubskills.map((subskill) => (
              <div
                key={subskill.id}
                className={`flex-1 h-1.5 rounded-full ${
                  subskill.status === 'mastered' || subskill.status === 'skipped'
                    ? 'bg-green-500'
                    : subskill.id === currentSubskill?.id
                      ? 'bg-blue-500'
                      : 'bg-white/10'
                }`}
                title={subskill.title}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
