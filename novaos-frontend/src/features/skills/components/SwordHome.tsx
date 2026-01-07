// ═══════════════════════════════════════════════════════════════════════════════
// SWORD HOME — Learning Hub Landing
// Shows when no active sword session
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useUIStore } from '@/shared/stores';

interface LessonPlanSummary {
  id: string;
  topic: string;
  capstone?: string;
  progress: number;
  status: 'active' | 'paused' | 'completed' | 'abandoned';
}

// TODO: Replace with actual API call
async function fetchPlans(): Promise<LessonPlanSummary[]> {
  // Simulated - replace with: return api.get('/sword/plans');
  return [];
}

export function SwordHome() {
  const { openChat, openSwordRunner } = useUIStore();
  const [plans, setPlans] = useState<LessonPlanSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPlans()
      .then(setPlans)
      .finally(() => setIsLoading(false));
  }, []);

  const activePlans = plans.filter(p => p.status === 'active' || p.status === 'paused');

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
          onClick={openChat}
          className="px-6 py-3 bg-white text-black rounded-full font-medium active:opacity-80 transition-opacity"
        >
          Start Learning Something New
        </button>
      </div>

      {/* Active Plans */}
      {!isLoading && activePlans.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-white/50 mb-3">CONTINUE LEARNING</h3>
          <div className="space-y-3">
            {activePlans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => openSwordRunner(plan.id)}
                className="w-full bg-[#1C1C1E] rounded-2xl p-4 text-left active:bg-[#2C2C2E] transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-medium">{plan.topic}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    plan.status === 'active' 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {plan.status === 'active' ? 'Active' : 'Paused'}
                  </span>
                </div>
                {plan.capstone && (
                  <p className="text-sm text-white/50 mb-3 line-clamp-2">{plan.capstone}</p>
                )}
                {/* Progress bar */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${plan.progress * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-white/30">{Math.round(plan.progress * 100)}%</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && activePlans.length === 0 && (
        <div className="mt-8 text-center">
          <p className="text-sm text-white/30">
            No active learning plans yet.
            <br />
            Tell Nova what you want to learn!
          </p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="mt-8 flex justify-center">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
