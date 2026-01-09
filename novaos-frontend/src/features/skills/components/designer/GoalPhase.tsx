// ═══════════════════════════════════════════════════════════════════════════════
// GOAL PHASE — Auto-generating learning plan
// Shows loading state while capstone + subskills + routing are being generated
// ═══════════════════════════════════════════════════════════════════════════════

import { useSwordDesignerStore } from '@/shared/stores/swordDesignerStore';

const GENERATION_STEPS = [
  { id: 'capstone', label: 'Creating your capstone goal', icon: '🎯' },
  { id: 'subskills', label: 'Breaking down into skills', icon: '🧩' },
  { id: 'routing', label: 'Planning your learning path', icon: '🗺️' },
];

export function GoalPhase() {
  const { isGenerating, error, capstone, subskills, routing } = useSwordDesignerStore();

  // Determine current step based on what's been generated
  const getCurrentStep = () => {
    if (!capstone) return 0;
    if (!subskills || subskills.length === 0) return 1;
    if (!routing || routing.length === 0) return 2;
    return 3; // Done
  };

  const currentStep = getCurrentStep();

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5">
      <div className="text-center max-w-sm">
        {/* Main animation */}
        <div className="relative mb-8">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-green-500/20 to-yellow-500/20 rounded-2xl flex items-center justify-center">
            <span className="text-4xl animate-bounce">
              {GENERATION_STEPS[Math.min(currentStep, 2)]?.icon || '✨'}
            </span>
          </div>
          
          {/* Spinner ring */}
          <div className="absolute inset-0 -m-2">
            <div className="w-24 h-24 mx-auto border-4 border-transparent border-t-green-500 rounded-full animate-spin" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-white mb-2">
          Creating Your Learning Plan
        </h2>
        <p className="text-white/50 text-sm mb-8">
          This usually takes about 60 seconds...
        </p>

        {/* Progress steps */}
        <div className="space-y-3">
          {GENERATION_STEPS.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                index < currentStep
                  ? 'bg-green-500/10 border border-green-500/20'
                  : index === currentStep
                  ? 'bg-white/5 border border-white/10'
                  : 'opacity-40'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                index < currentStep
                  ? 'bg-green-500 text-black'
                  : index === currentStep
                  ? 'bg-white/10 text-white'
                  : 'bg-white/5 text-white/30'
              }`}>
                {index < currentStep ? '✓' : step.icon}
              </div>
              <span className={`text-sm ${
                index <= currentStep ? 'text-white' : 'text-white/30'
              }`}>
                {step.label}
              </span>
              {index === currentStep && isGenerating && (
                <div className="ml-auto">
                  <div className="w-4 h-4 border-2 border-white/20 border-t-green-500 rounded-full animate-spin" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Error state */}
        {error && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Tips */}
        <div className="mt-8 p-4 bg-white/5 rounded-xl">
          <p className="text-white/40 text-xs">
            💡 We're using AI to create a personalized learning path just for you,
            including optimal skill ordering and time estimates.
          </p>
        </div>
      </div>
    </div>
  );
}
