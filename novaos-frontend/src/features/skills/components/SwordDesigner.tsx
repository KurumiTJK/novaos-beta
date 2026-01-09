// ═══════════════════════════════════════════════════════════════════════════════
// SWORD DESIGNER — Create Learning Plan
// Flow: Orient → Clarify → Capstone → Subskills → Routing → Complete
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { useUIStore } from '@/shared/stores';
import { useSwordDesignerStore, selectPhaseIndex, type DesignerPhase } from '@/shared/stores/swordDesignerStore';
import { OrientPhase } from './designer/OrientPhase';
import { ClarifyPhase } from './designer/ClarifyPhase';
import { CapstonePhase } from './designer/CapstonePhase';
import { SubskillsPhase } from './designer/SubskillsPhase';
import { RoutingPhase } from './designer/RoutingPhase';
import { CompletePhase } from './designer/CompletePhase';

// ─────────────────────────────────────────────────────────────────────────────────
// PHASE CONFIG
// ─────────────────────────────────────────────────────────────────────────────────

interface PhaseInfo {
  id: DesignerPhase;
  title: string;
  shortTitle: string;
  icon: string;
}

const PHASES: PhaseInfo[] = [
  { id: 'orient', title: 'Explore', shortTitle: 'Explore', icon: '💭' },
  { id: 'clarify', title: 'Clarify', shortTitle: 'Clarify', icon: '✏️' },
  { id: 'capstone', title: 'Capstone', shortTitle: 'Goal', icon: '🎯' },
  { id: 'subskills', title: 'Skills', shortTitle: 'Skills', icon: '🧩' },
  { id: 'routing', title: 'Path', shortTitle: 'Path', icon: '🗺️' },
];

// ─────────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────────

interface SwordDesignerProps {
  topic?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────────

export function SwordDesigner({ topic }: SwordDesignerProps) {
  const { openSwordRunner, closeSword } = useUIStore();
  const { 
    phase, 
    isLoading, 
    error,
    plan,
    initialize, 
    reset,
    abandon,
  } = useSwordDesignerStore();

  // Initialize on mount
  useEffect(() => {
    initialize(topic);
    
    // Cleanup on unmount
    return () => {
      // Don't reset - let user resume later
    };
  }, [initialize, topic]);

  // Handle complete - navigate to runner
  const handleComplete = () => {
    if (plan) {
      // Reset designer state
      reset();
      // Navigate to runner with new plan
      openSwordRunner(plan.id);
    }
  };

  // Handle abandon
  const handleAbandon = async () => {
    await abandon();
    closeSword();
  };

  const currentPhaseIndex = selectPhaseIndex(phase);

  // Show complete phase
  if (phase === 'complete' && plan) {
    return (
      <div className="flex flex-col h-full p-5">
        <CompletePhase plan={plan} onStart={handleComplete} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Phase Progress Bar */}
      <div className="px-5 pt-4 pb-2">
        <PhaseProgress phases={PHASES} currentIndex={currentPhaseIndex} />
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-5 mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Phase Content */}
      <div className="flex-1 overflow-y-auto">
        {phase === 'orient' && <OrientPhase />}
        {phase === 'clarify' && <ClarifyPhase />}
        {phase === 'capstone' && <CapstonePhase />}
        {phase === 'subskills' && <SubskillsPhase />}
        {phase === 'routing' && <RoutingPhase />}
      </div>

      {/* Footer with abandon option */}
      {!isLoading && phase !== 'orient' && (
        <div className="px-5 py-3 border-t border-white/5">
          <button
            onClick={handleAbandon}
            className="text-white/30 text-xs hover:text-white/50 transition-colors"
          >
            Start over
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// PHASE PROGRESS COMPONENT
// ─────────────────────────────────────────────────────────────────────────────────

interface PhaseProgressProps {
  phases: PhaseInfo[];
  currentIndex: number;
}

function PhaseProgress({ phases, currentIndex }: PhaseProgressProps) {
  return (
    <div className="flex items-center justify-between">
      {phases.map((phase, index) => (
        <div key={phase.id} className="flex items-center">
          {/* Phase indicator */}
          <div className="flex flex-col items-center">
            <div
              className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all
                ${index < currentIndex 
                  ? 'bg-green-500 text-black' 
                  : index === currentIndex 
                    ? 'bg-green-500/20 text-green-400 ring-2 ring-green-500' 
                    : 'bg-white/10 text-white/30'
                }
              `}
            >
              {index < currentIndex ? '✓' : phase.icon}
            </div>
            <span 
              className={`text-[10px] mt-1 ${
                index <= currentIndex ? 'text-white/70' : 'text-white/30'
              }`}
            >
              {phase.shortTitle}
            </span>
          </div>
          
          {/* Connector line */}
          {index < phases.length - 1 && (
            <div 
              className={`w-6 h-0.5 mx-1 mb-4 ${
                index < currentIndex ? 'bg-green-500' : 'bg-white/10'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
