// ═══════════════════════════════════════════════════════════════════════════════
// CAPSTONE PHASE — Review capstone goal
// User reviews the generated capstone project/goal before continuing
// ═══════════════════════════════════════════════════════════════════════════════

import { useSwordDesignerStore } from '@/shared/stores/swordDesignerStore';

export function CapstonePhase() {
  const {
    capstone,
    isLoading,
    confirmCapstoneAction,
  } = useSwordDesignerStore();

  if (!capstone) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-green-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-white/50 text-sm">Generating your capstone goal...</p>
        </div>
      </div>
    );
  }

  const handleConfirm = async () => {
    if (isLoading) return;
    await confirmCapstoneAction();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-3">
        <h2 className="text-lg font-semibold text-white">Your Capstone Goal</h2>
        <p className="text-sm text-white/50 mt-1">
          This is what you'll be able to do when you complete this learning path
        </p>
      </div>

      {/* Capstone Card */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        <div className="bg-gradient-to-br from-green-500/20 to-green-500/5 rounded-2xl p-5 border border-green-500/20">
          {/* Icon */}
          <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center mb-4">
            <span className="text-2xl">🎯</span>
          </div>

          {/* Title */}
          <h3 className="text-xl font-semibold text-white mb-2">
            {capstone.title}
          </h3>

          {/* Description */}
          <p className="text-white/70 text-sm leading-relaxed mb-4">
            {capstone.description}
          </p>

          {/* Success Criteria */}
          {capstone.successCriteria && capstone.successCriteria.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <h4 className="text-xs font-medium text-white/50 uppercase tracking-wide mb-3">
                Success Criteria
              </h4>
              <ul className="space-y-2">
                {capstone.successCriteria.map((criterion, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span className="text-white/80 text-sm">{criterion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Info Note */}
        <div className="mt-4 p-3 bg-white/5 rounded-xl">
          <p className="text-white/50 text-xs text-center">
            💡 Your learning path will be designed to help you achieve this goal
          </p>
        </div>
      </div>

      {/* Continue Button */}
      <div className="px-5 py-4 border-t border-white/5">
        <button
          onClick={handleConfirm}
          disabled={isLoading}
          className="w-full py-3 bg-green-500 text-black font-medium rounded-full disabled:opacity-50 disabled:cursor-not-allowed active:opacity-80 transition-opacity"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              Generating skills...
            </span>
          ) : (
            'Looks good — Continue'
          )}
        </button>
      </div>
    </div>
  );
}
