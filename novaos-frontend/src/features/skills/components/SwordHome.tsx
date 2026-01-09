// ═══════════════════════════════════════════════════════════════════════════════
// SWORD HOME — Learning Hub Landing
// Shows when no active sword session
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useUIStore } from '@/shared/stores';
import { getPlans, type LearningPlan } from '@/shared/api/sword';

export function SwordHome() {
  const { openSwordDesigner, openSwordRunner } = useUIStore();
  const [plans, setPlans] = useState<LearningPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPlans() {
      try {
        const data = await getPlans();
        setPlans(data || []);
      } catch (err) {
        console.error('[SWORD_HOME] Failed to fetch plans:', err);
        setError(err instanceof Error ? err.message : 'Failed to load plans');
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchPlans();
  }, []);

  const activePlans = plans.filter(p => p.status === 'active' || p.status === 'paused');
  const completedPlans = plans.filter(p => p.status === 'completed');

  const handleStartNew = () => {
    openSwordDesigner();
  };

  const handleContinuePlan = (planId: string) => {
    openSwordRunner(planId);
  };

  return (
    <div className="flex-1 flex flex-col px-5 py-4">
      {/* Hero Section */}
      <div className="flex flex-col items-center justify-center text-center py-8">
        <span className="text-5xl mb-4">⚔️</span>
        <h2 className="text-xl font-medium text-white mb-2">SwordGate</h2>
        <p className="text-sm text-white/50 mb-6 max-w-xs">
          Learn anything with personalized, structured lessons
        </p>
        <button
          onClick={handleStartNew}
          className="px-6 py-3 bg-white text-black rounded-full font-medium active:opacity-80 transition-opacity"
        >
          Start Learning Something New
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="mt-8 flex justify-center">
          <div className="w-6 h-6 border-2 border-white/20 border-t-green-500 rounded-full animate-spin" />
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-red-400 text-sm text-center">{error}</p>
        </div>
      )}

      {/* Active Plans */}
      {!isLoading && activePlans.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-white/50 mb-3">CONTINUE LEARNING</h3>
          <div className="space-y-3">
            {activePlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onClick={() => handleContinuePlan(plan.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed Plans */}
      {!isLoading && completedPlans.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-white/50 mb-3">COMPLETED</h3>
          <div className="space-y-3">
            {completedPlans.slice(0, 3).map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onClick={() => handleContinuePlan(plan.id)}
                isCompleted
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && activePlans.length === 0 && (
        <div className="mt-8 text-center">
          <p className="text-sm text-white/30">
            No active learning plans yet.
            <br />
            Start something new above!
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// PLAN CARD COMPONENT
// ─────────────────────────────────────────────────────────────────────────────────

interface PlanCardProps {
  plan: LearningPlan;
  onClick: () => void;
  isCompleted?: boolean;
}

function PlanCard({ plan, onClick, isCompleted }: PlanCardProps) {
  const progressPercent = Math.round(plan.progress * 100);
  
  return (
    <button
      onClick={onClick}
      className="w-full bg-[#1C1C1E] rounded-2xl p-4 text-left active:bg-[#2C2C2E] transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-white font-medium">{plan.title}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          isCompleted 
            ? 'bg-green-500/20 text-green-400'
            : plan.status === 'active' 
              ? 'bg-green-500/20 text-green-400' 
              : 'bg-yellow-500/20 text-yellow-400'
        }`}>
          {isCompleted ? 'Completed' : plan.status === 'active' ? 'Active' : 'Paused'}
        </span>
      </div>
      
      {plan.capstone && (
        <p className="text-sm text-white/50 mb-3 line-clamp-2">
          {plan.capstone.title}
        </p>
      )}
      
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all ${
              isCompleted ? 'bg-green-500' : 'bg-green-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className="text-xs text-white/30">{progressPercent}%</span>
      </div>

      {/* Subskills count */}
      {plan.subskills && plan.subskills.length > 0 && (
        <div className="mt-2 text-xs text-white/30">
          {plan.subskills.filter(s => s.status === 'completed').length}/{plan.subskills.length} skills completed
        </div>
      )}
    </button>
  );
}
