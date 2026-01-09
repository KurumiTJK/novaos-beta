// ═══════════════════════════════════════════════════════════════════════════════
// PATH PHASE — Plan created successfully
// User can activate the plan and start learning
// ═══════════════════════════════════════════════════════════════════════════════

import { useSwordDesignerStore } from '@/shared/stores/swordDesignerStore';
import type { LearningPlan } from '@/shared/api/sword';

interface PathPhaseProps {
  plan: LearningPlan | null;
  onStart: () => void;
}

export function PathPhase({ plan, onStart }: PathPhaseProps) {
  const { isLoading, activateCreatedPlan } = useSwordDesignerStore();

  if (!plan) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-green-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-white/50 text-sm">Creating your plan...</p>
        </div>
      </div>
    );
  }

  const handleActivateAndStart = async () => {
    if (isLoading) return;
    
    // If plan is already active, just navigate to runner
    if (plan.status === 'active') {
      onStart();
      return;
    }
    
    // Otherwise activate it first, then the store will handle navigation
    await activateCreatedPlan();
    onStart();
  };

  const totalSubskills = plan.subskills?.length || plan.totalSubskills || 0;
  const totalSessions = plan.estimatedSessions || plan.subskills?.reduce((sum, s) => sum + (s.totalSessions || 0), 0) || 0;

  return (
    <div className="flex flex-col h-full">
      {/* Success Header */}
      <div className="px-5 py-6 text-center">
        <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-4xl">🎉</span>
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">
          Your Learning Plan is Ready!
        </h2>
        <p className="text-white/50 text-sm">
          You're all set to start your learning journey
        </p>
      </div>

      {/* Plan Summary */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {/* Plan Card */}
        <div className="bg-gradient-to-br from-green-500/20 to-green-500/5 rounded-2xl p-5 border border-green-500/20 mb-4">
          <h3 className="text-lg font-semibold text-white mb-1">
            {plan.title}
          </h3>
          {plan.capstoneStatement && (
            <p className="text-white/70 text-sm mb-4">
              {plan.capstoneStatement}
            </p>
          )}
          
          {/* Stats */}
          <div className="flex gap-4 pt-4 border-t border-white/10">
            <div>
              <div className="text-2xl font-bold text-green-400">{totalSubskills}</div>
              <div className="text-xs text-white/50">Skills</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">{totalSessions}</div>
              <div className="text-xs text-white/50">Sessions</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">
                {plan.estimatedTimeDisplay || `~${plan.estimatedWeeks || '?'} weeks`}
              </div>
              <div className="text-xs text-white/50">Duration</div>
            </div>
          </div>
        </div>

        {/* Skills Preview */}
        {plan.subskills && plan.subskills.length > 0 && (
          <div className="bg-[#1C1C1E] rounded-2xl p-4">
            <h4 className="text-sm font-medium text-white/70 mb-3">Your learning path:</h4>
            <div className="space-y-2">
              {plan.subskills.slice(0, 5).map((skill, index) => (
                <div key={skill.id} className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-green-400 text-xs font-medium">{index + 1}</span>
                  </div>
                  <span className="text-white text-sm truncate">{skill.title}</span>
                </div>
              ))}
              {plan.subskills.length > 5 && (
                <div className="text-white/40 text-xs pl-9">
                  +{plan.subskills.length - 5} more skills
                </div>
              )}
            </div>
          </div>
        )}

        {/* Info */}
        <div className="mt-4 p-3 bg-white/5 rounded-xl">
          <p className="text-white/40 text-xs text-center">
            💡 You can adjust your pace and skip skills based on your progress
          </p>
        </div>
      </div>

      {/* Start Button */}
      <div className="px-5 py-4 border-t border-white/5">
        <button
          onClick={handleActivateAndStart}
          disabled={isLoading}
          className="w-full py-3 bg-green-500 text-black font-semibold rounded-full disabled:opacity-50 disabled:cursor-not-allowed active:opacity-80 transition-opacity"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              Activating...
            </span>
          ) : (
            'Start Learning 🚀'
          )}
        </button>
      </div>
    </div>
  );
}
