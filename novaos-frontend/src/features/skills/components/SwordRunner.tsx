// ═══════════════════════════════════════════════════════════════════════════════
// SWORD RUNNER — Execute Learning Session
// Daily learning with content, sparks, and progress tracking
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useUIStore } from '@/shared/stores';
import { 
  getToday, 
  getCurrentSpark,
  completeSpark as completeSparkApi,
  skipSpark as skipSparkApi,
  generateSpark,
  getPlan,
  type TodayState, 
  type Spark,
  type LearningPlan,
} from '@/shared/api/sword';

interface SwordRunnerProps {
  planId?: string;
}

export function SwordRunner({ planId }: SwordRunnerProps) {
  const { closeSword, openChat } = useUIStore();
  
  const [todayState, setTodayState] = useState<TodayState | null>(null);
  const [currentSpark, setCurrentSpark] = useState<Spark | null>(null);
  const [plan, setPlan] = useState<LearningPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial state
  useEffect(() => {
    async function fetchState() {
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch today's state
        const today = await getToday();
        setTodayState(today);
        
        // Fetch current spark
        const spark = await getCurrentSpark();
        setCurrentSpark(spark);
        
        // Fetch plan details if we have a planId
        if (planId) {
          const planData = await getPlan(planId);
          setPlan(planData);
        } else if (today.plan) {
          setPlan(today.plan);
        }
      } catch (err) {
        console.error('[RUNNER] Failed to fetch state:', err);
        setError(err instanceof Error ? err.message : 'Failed to load learning session');
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchState();
  }, [planId]);

  // Handle complete spark
  const handleCompleteSpark = async () => {
    if (!currentSpark || isActionLoading) return;
    
    setIsActionLoading(true);
    try {
      await completeSparkApi(currentSpark.id);
      
      // Generate next spark
      const nextSpark = await generateSpark();
      setCurrentSpark(nextSpark);
      
      // Update today state
      if (todayState) {
        setTodayState({
          ...todayState,
          progress: {
            ...todayState.progress,
            completedToday: todayState.progress.completedToday + 1,
          },
        });
      }
    } catch (err) {
      console.error('[RUNNER] Failed to complete spark:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete spark');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle skip spark
  const handleSkipSpark = async () => {
    if (!currentSpark || isActionLoading) return;
    
    setIsActionLoading(true);
    try {
      await skipSparkApi(currentSpark.id, 'user_skip');
      
      // Generate next spark
      const nextSpark = await generateSpark();
      setCurrentSpark(nextSpark);
    } catch (err) {
      console.error('[RUNNER] Failed to skip spark:', err);
      setError(err instanceof Error ? err.message : 'Failed to skip spark');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-green-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-white/50 text-sm">Loading your session...</p>
        </div>
      </div>
    );
  }

  // No active plan state
  if (!todayState?.hasActivePlan && !plan) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-5 text-center">
        <span className="text-5xl mb-4">📭</span>
        <h2 className="text-xl font-medium text-white mb-2">No Active Plan</h2>
        <p className="text-sm text-white/50 mb-6">
          {planId ? "This plan couldn't be found" : "Start a learning plan to begin"}
        </p>
        <button
          onClick={openChat}
          className="px-6 py-3 bg-white text-black rounded-full font-medium"
        >
          Start Learning
        </button>
      </div>
    );
  }

  const progress = todayState?.progress || { completedToday: 0, targetToday: 3, streak: 0 };
  const progressPercent = progress.targetToday > 0 
    ? Math.round((progress.completedToday / progress.targetToday) * 100)
    : 0;

  return (
    <div className="flex flex-col h-full p-5">
      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Streak & Progress Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔥</span>
          <div>
            <div className="text-white font-medium">{progress.streak} day streak</div>
            <div className="text-white/50 text-xs">Keep it going!</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-white font-medium">
            {progress.completedToday}/{progress.targetToday}
          </div>
          <div className="text-white/50 text-xs">Today's sparks</div>
        </div>
      </div>

      {/* Current Plan/Subskill */}
      {(plan || todayState?.currentSubskill) && (
        <div className="bg-[#1C1C1E] rounded-2xl p-4 mb-4">
          {plan && (
            <div className="text-xs text-white/50 mb-1">
              {plan.title}
            </div>
          )}
          {todayState?.currentSubskill && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400`}>
                  {todayState.currentSubskill.status === 'in_progress' ? 'IN PROGRESS' : 'CURRENT'}
                </span>
              </div>
              <h3 className="text-white font-medium text-lg">{todayState.currentSubskill.title}</h3>
              <p className="text-white/50 text-sm mt-1">{todayState.currentSubskill.description}</p>
              
              {/* Subskill progress */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-white/40">
                    Session {todayState.currentSubskill.completedSessions + 1}/{todayState.currentSubskill.totalSessions}
                  </span>
                  <span className="text-white/40">
                    {Math.round(todayState.currentSubskill.progress * 100)}%
                  </span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${todayState.currentSubskill.progress * 100}%` }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Current Spark */}
      {currentSpark && (
        <div className="bg-gradient-to-br from-green-500/20 to-green-500/5 rounded-2xl p-5 border border-green-500/20 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">⚡</span>
            <span className="text-green-400 text-sm font-medium">CURRENT SPARK</span>
            <span className="text-white/30 text-xs ml-auto">
              ~{currentSpark.estimatedMinutes} min
            </span>
          </div>
          
          <p className="text-white text-lg mb-6">{currentSpark.task}</p>
          
          {currentSpark.context && (
            <p className="text-white/40 text-sm mb-4">
              Context: {currentSpark.context}
            </p>
          )}
          
          <div className="flex gap-3">
            <button
              onClick={handleCompleteSpark}
              disabled={isActionLoading}
              className="flex-1 py-3 bg-green-500 text-black font-medium rounded-full disabled:opacity-50 active:opacity-80 transition-opacity"
            >
              {isActionLoading ? 'Saving...' : '✓ Complete'}
            </button>
            <button
              onClick={handleSkipSpark}
              disabled={isActionLoading}
              className="px-4 py-3 bg-white/10 text-white/70 font-medium rounded-full active:bg-white/20 transition-colors"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* No More Sparks */}
      {!currentSpark && !isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <span className="text-5xl mb-4">🎉</span>
          <h3 className="text-xl font-medium text-white mb-2">All Done for Today!</h3>
          <p className="text-sm text-white/50 mb-6">
            Great work! Come back tomorrow to continue learning.
          </p>
          <button
            onClick={closeSword}
            className="px-6 py-3 bg-white/10 text-white rounded-full font-medium"
          >
            Back to Home
          </button>
        </div>
      )}

      {/* Progress Bar */}
      {(currentSpark || progress.completedToday > 0) && (
        <div className="mt-auto pt-4">
          <div className="flex items-center justify-between text-xs text-white/50 mb-2">
            <span>Today's Progress</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
