// ═══════════════════════════════════════════════════════════════════════════════
// SWORD RUNNER — Execute Learning Session
// Daily learning with nodes, sparks, and progress tracking
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useUIStore } from '@/shared/stores';

interface SwordRunnerProps {
  planId?: string;
}

interface TodayState {
  hasActivePlan: boolean;
  currentNode?: {
    id: string;
    title: string;
    route: string;
  };
  currentSpark?: {
    id: string;
    task: string;
    estimatedMinutes: number;
  };
  progress: {
    completedToday: number;
    targetToday: number;
    streak: number;
  };
}

// TODO: Replace with actual API call
async function fetchTodayState(planId?: string): Promise<TodayState> {
  // Simulated - replace with: return api.get(`/sword/today?planId=${planId}`);
  return {
    hasActivePlan: true,
    currentNode: {
      id: 'node-1',
      title: 'Introduction to Fingerpicking',
      route: 'tutorial',
    },
    currentSpark: {
      id: 'spark-1',
      task: 'Practice the basic thumb pattern for 2 minutes',
      estimatedMinutes: 2,
    },
    progress: {
      completedToday: 1,
      targetToday: 3,
      streak: 5,
    },
  };
}

export function SwordRunner({ planId }: SwordRunnerProps) {
  const { closeSword, openChat } = useUIStore();
  const [todayState, setTodayState] = useState<TodayState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCompletingSpark, setIsCompletingSpark] = useState(false);

  useEffect(() => {
    fetchTodayState(planId)
      .then(setTodayState)
      .finally(() => setIsLoading(false));
  }, [planId]);

  const handleCompleteSpark = async () => {
    if (!todayState?.currentSpark) return;
    
    setIsCompletingSpark(true);
    try {
      // TODO: Call API to complete spark
      // await api.post(`/sword/sessions/${sessionId}/spark/complete`);
      
      // Refresh state
      const newState = await fetchTodayState(planId);
      setTodayState(newState);
    } catch (error) {
      console.error('Failed to complete spark:', error);
    } finally {
      setIsCompletingSpark(false);
    }
  };

  const handleSkipSpark = async () => {
    if (!todayState?.currentSpark) return;
    
    // TODO: Call API to skip spark
    // await api.post(`/sword/sessions/${sessionId}/spark/skip`, { reason: 'user_skip' });
    
    // Refresh state
    const newState = await fetchTodayState(planId);
    setTodayState(newState);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!todayState?.hasActivePlan) {
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

  return (
    <div className="flex flex-col h-full p-5">
      {/* Streak & Progress Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔥</span>
          <div>
            <div className="text-white font-medium">{todayState.progress.streak} day streak</div>
            <div className="text-white/50 text-xs">Keep it going!</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-white font-medium">
            {todayState.progress.completedToday}/{todayState.progress.targetToday}
          </div>
          <div className="text-white/50 text-xs">Today's sparks</div>
        </div>
      </div>

      {/* Current Node */}
      {todayState.currentNode && (
        <div className="bg-[#1C1C1E] rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              todayState.currentNode.route === 'tutorial' ? 'bg-blue-500/20 text-blue-400' :
              todayState.currentNode.route === 'practice' ? 'bg-purple-500/20 text-purple-400' :
              todayState.currentNode.route === 'project' ? 'bg-orange-500/20 text-orange-400' :
              'bg-white/20 text-white'
            }`}>
              {todayState.currentNode.route.toUpperCase()}
            </span>
          </div>
          <h3 className="text-white font-medium text-lg">{todayState.currentNode.title}</h3>
        </div>
      )}

      {/* Current Spark */}
      {todayState.currentSpark && (
        <div className="bg-gradient-to-br from-green-500/20 to-green-500/5 rounded-2xl p-5 border border-green-500/20 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">⚡</span>
            <span className="text-green-400 text-sm font-medium">CURRENT SPARK</span>
            <span className="text-white/30 text-xs ml-auto">
              ~{todayState.currentSpark.estimatedMinutes} min
            </span>
          </div>
          
          <p className="text-white text-lg mb-6">{todayState.currentSpark.task}</p>
          
          <div className="flex gap-3">
            <button
              onClick={handleCompleteSpark}
              disabled={isCompletingSpark}
              className="flex-1 py-3 bg-green-500 text-black font-medium rounded-full disabled:opacity-50 active:opacity-80 transition-opacity"
            >
              {isCompletingSpark ? 'Saving...' : '✓ Complete'}
            </button>
            <button
              onClick={handleSkipSpark}
              className="px-4 py-3 bg-white/10 text-white/70 font-medium rounded-full active:bg-white/20 transition-colors"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* No More Sparks */}
      {!todayState.currentSpark && (
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
      <div className="mt-auto pt-4">
        <div className="flex items-center justify-between text-xs text-white/50 mb-2">
          <span>Today's Progress</span>
          <span>{Math.round((todayState.progress.completedToday / todayState.progress.targetToday) * 100)}%</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-green-500 rounded-full transition-all duration-500"
            style={{ 
              width: `${(todayState.progress.completedToday / todayState.progress.targetToday) * 100}%` 
            }}
          />
        </div>
      </div>
    </div>
  );
}
