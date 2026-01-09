// ═══════════════════════════════════════════════════════════════════════════════
// COMPLETE PHASE — Plan created successfully
// Shows summary and option to start learning
// ═══════════════════════════════════════════════════════════════════════════════

import type { LearningPlan } from '@/shared/api/sword';

interface CompletePhaseProps {
  plan: LearningPlan;
  onStart: () => void;
}

export function CompletePhase({ plan, onStart }: CompletePhaseProps) {
  const totalSubskills = plan.subskills?.length || 0;
  const totalSessions = plan.subskills?.reduce((sum, s) => sum + s.totalSessions, 0) || 0;

  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      {/* Success Animation */}
      <div className="relative mb-6">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
          <span className="text-4xl">🎉</span>
        </div>
        {/* Pulse rings */}
        <div className="absolute inset-0 rounded-full bg-green-500/10 animate-ping" />
      </div>

      {/* Title */}
      <h2 className="text-2xl font-bold text-white mb-2">Plan Created!</h2>
      <p className="text-white/50 text-sm mb-8 max-w-xs">
        Your personalized learning path is ready. Let's start learning!
      </p>

      {/* Plan Summary Card */}
      <div className="w-full bg-[#1C1C1E] rounded-2xl p-5 mb-6 text-left">
        {/* Capstone */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-lg">🎯</span>
          </div>
          <div>
            <div className="text-xs text-white/50 mb-1">YOUR GOAL</div>
            <h3 className="text-white font-medium">{plan.capstone?.title || plan.title}</h3>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/10 my-4" />

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-2xl font-semibold text-white">{totalSubskills}</div>
            <div className="text-xs text-white/40">Skills</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-white">{totalSessions}</div>
            <div className="text-xs text-white/40">Sessions</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-white">~{Math.ceil(totalSessions * 15 / 60)}h</div>
            <div className="text-xs text-white/40">Total</div>
          </div>
        </div>
      </div>

      {/* Skills Preview */}
      {plan.subskills && plan.subskills.length > 0 && (
        <div className="w-full mb-6">
          <div className="text-xs text-white/50 mb-2 text-left">WHAT YOU'LL LEARN</div>
          <div className="flex flex-wrap gap-2">
            {plan.subskills.slice(0, 5).map((skill) => (
              <span
                key={skill.id}
                className="px-3 py-1.5 bg-white/5 rounded-full text-white/70 text-sm"
              >
                {skill.title}
              </span>
            ))}
            {plan.subskills.length > 5 && (
              <span className="px-3 py-1.5 bg-white/5 rounded-full text-white/50 text-sm">
                +{plan.subskills.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Start Button */}
      <button
        onClick={onStart}
        className="w-full py-4 bg-green-500 text-black font-semibold rounded-full active:opacity-80 transition-opacity text-lg"
      >
        Start Learning →
      </button>

      {/* Later option */}
      <p className="text-white/30 text-xs mt-3">
        Your plan is saved. You can start anytime.
      </p>
    </div>
  );
}
