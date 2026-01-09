// ═══════════════════════════════════════════════════════════════════════════════
// LEARNING MODULE — Learning Hub
// Shows active plan, plan list, stats, and create plan button
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { useUIStore, useLessonStore } from '@/shared/stores';
import { useHaptic } from '@/shared/hooks';
import { CloseIcon, PlusIcon } from '@/shared/components';
import { getPlans, getToday, activatePlan, type LearningPlan } from '@/shared/api/sword';
import { PlanCard } from './PlanCard';

// ─────────────────────────────────────────────────────────────────────────────────
// DERIVED STATS TYPE (from today + plans)
// ─────────────────────────────────────────────────────────────────────────────────

interface DerivedStats {
  totalSubskillsCompleted: number;
  currentStreak: number;
  sparksCompletedToday: number;
}

interface LearningModuleProps {
  onClose: () => void;
}

export function LearningModule({ onClose }: LearningModuleProps) {
  const haptic = useHaptic();
  const { openSwordDesigner, openSwordRunner, closeModule } = useUIStore();
  const { stats: lessonStats } = useLessonStore();
  
  // Local state
  const [plans, setPlans] = useState<LearningPlan[]>([]);
  const [stats, setStats] = useState<DerivedStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data on mount
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch plans and today state (no getStats - endpoint doesn't exist)
        const [plansData, todayData] = await Promise.all([
          getPlans(),
          getToday().catch(() => null),
        ]);
        
        setPlans(plansData || []);
        
        // Derive stats from today + plans data
        const derivedStats: DerivedStats = {
          currentStreak: todayData?.progress?.streak ?? 0,
          sparksCompletedToday: todayData?.progress?.completedToday ?? 0,
          totalSubskillsCompleted: (plansData || []).reduce((sum, p) => 
            sum + (p.subskills?.filter(s => s.status === 'completed').length ?? 0), 0),
        };
        
        setStats(derivedStats);
      } catch (err) {
        console.error('[LEARNING_MODULE] Fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchData();
  }, []);

  // Get active plan from list
  const activePlan = plans.find(p => p.status === 'active');
  const otherPlans = plans.filter(p => p.id !== activePlan?.id);

  // Handlers
  const handleCreatePlan = () => {
    haptic('medium');
    closeModule();
    // Small delay to let module close animation complete
    setTimeout(() => {
      openSwordDesigner();
    }, 100);
  };

  const handleContinueLearning = (planId?: string) => {
    haptic('medium');
    closeModule();
    setTimeout(() => {
      openSwordRunner(planId);
    }, 100);
  };

  const handleActivatePlan = async (planId: string) => {
    haptic('light');
    try {
      await activatePlan(planId);
      // Refresh plans
      const updatedPlans = await getPlans();
      setPlans(updatedPlans || []);
    } catch (err) {
      console.error('[LEARNING_MODULE] Activate error:', err);
    }
  };

  return (
    <div className="fixed inset-0 max-w-[430px] mx-auto bg-black flex flex-col z-50">
      {/* Header */}
      <header 
        className="flex items-center justify-between px-5 py-3 border-b border-white/10"
        style={{ paddingTop: 'calc(12px + env(safe-area-inset-top))' }}
      >
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-xl text-white active:bg-white/10"
        >
          <CloseIcon size={24} />
        </button>
        <h2 className="text-white font-semibold text-lg">Learning</h2>
        <div className="w-10" />
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-white/20 border-t-green-500 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="p-5 text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-white/10 text-white rounded-xl text-sm"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Active Plan Banner */}
            {activePlan && (
              <div className="bg-gradient-to-br from-green-600/20 to-green-900/20 rounded-3xl p-5 border border-green-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-green-400 text-sm font-medium">🎯 Active Plan</span>
                </div>
                <h3 className="text-white text-lg font-semibold mb-2">
                  {activePlan.capstone?.title || activePlan.title}
                </h3>
                
                {/* Progress */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-2 bg-black/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${Math.round((activePlan.progress ?? 0) * 100)}%` }}
                    />
                  </div>
                  <span className="text-green-400 text-sm font-medium">
                    {Math.round((activePlan.progress ?? 0) * 100)}%
                  </span>
                </div>
                
                {/* Quick Stats */}
                <div className="flex gap-4 mb-4 text-sm">
                  <div className="text-white/60">
                    <span className="text-white font-medium">
                      {activePlan.subskills?.filter(s => s.status === 'completed').length || 0}
                    </span>
                    /{activePlan.subskills?.length || 0} skills
                  </div>
                  {activePlan.estimatedTimeDisplay && (
                    <div className="text-white/60">
                      ~{activePlan.estimatedTimeDisplay} left
                    </div>
                  )}
                </div>
                
                {/* Continue Button */}
                <button
                  onClick={() => handleContinueLearning(activePlan.id)}
                  className="w-full py-3 bg-green-500 text-black font-medium rounded-2xl active:opacity-80 transition-opacity"
                >
                  Continue Learning
                </button>
              </div>
            )}

            {/* Stats Grid */}
            {stats && (
              <div>
                <h3 className="text-white/50 text-sm font-medium mb-3 px-1">📊 Your Progress</h3>
                <div className="grid grid-cols-3 gap-3">
                  <StatCard
                    label="Sessions"
                    value={lessonStats.totalSessionsCompleted || 0}
                  />
                  <StatCard
                    label="Skills"
                    value={stats.totalSubskillsCompleted || 0}
                  />
                  <StatCard
                    label="Streak"
                    value={`${stats.currentStreak || 0}d`}
                    highlight={(stats.currentStreak || 0) > 0}
                  />
                </div>
              </div>
            )}

            {/* Other Plans */}
            {otherPlans.length > 0 && (
              <div>
                <h3 className="text-white/50 text-sm font-medium mb-3 px-1">📚 Your Plans</h3>
                <div className="space-y-2">
                  {otherPlans.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      onContinue={handleContinueLearning}
                      onActivate={handleActivatePlan}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Active Plan in List (if exists) */}
            {activePlan && otherPlans.length > 0 && (
              <div className="text-center text-white/30 text-xs py-2">
                Active plan shown above
              </div>
            )}

            {/* Empty State */}
            {plans.length === 0 && (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">📚</div>
                <h3 className="text-white font-medium mb-2">No Learning Plans Yet</h3>
                <p className="text-white/50 text-sm mb-6">
                  Create your first learning plan to start your journey
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Plan Button */}
      <div 
        className="px-5 py-4 border-t border-white/5"
        style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={handleCreatePlan}
          className="w-full py-4 bg-[#1C1C1E] rounded-2xl text-white font-medium flex items-center justify-center gap-2 active:bg-[#2C2C2E] transition-colors"
        >
          <PlusIcon size={20} />
          Create Learning Plan
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// STAT CARD COMPONENT
// ─────────────────────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  highlight?: boolean;
}

function StatCard({ label, value, highlight }: StatCardProps) {
  return (
    <div className="bg-[#1C1C1E] rounded-2xl p-4 text-center">
      <div className={`text-2xl font-semibold ${highlight ? 'text-orange-400' : 'text-white'}`}>
        {value}
      </div>
      <div className="text-white/40 text-xs mt-1">{label}</div>
    </div>
  );
}
