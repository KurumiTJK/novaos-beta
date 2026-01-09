// ═══════════════════════════════════════════════════════════════════════════════
// PLAN CARD — Learning Plan List Item
// ═══════════════════════════════════════════════════════════════════════════════

import { useHaptic } from '@/shared/hooks';
import { ChevronRightIcon } from '@/shared/components';
import type { LearningPlan } from '@/shared/api/sword';

interface PlanCardProps {
  plan: LearningPlan;
  onContinue: (planId: string) => void;
  onActivate?: (planId: string) => void;
}

export function PlanCard({ plan, onContinue, onActivate }: PlanCardProps) {
  const haptic = useHaptic();
  
  const isActive = plan.status === 'active';
  const isPaused = plan.status === 'paused';
  const isCompleted = plan.status === 'completed';
  
  // Calculate progress percentage (handle undefined)
  const progressPercent = Math.round((plan.progress ?? 0) * 100);
  
  // Get status badge color
  const getStatusColor = () => {
    switch (plan.status) {
      case 'active': return 'bg-green-500/20 text-green-400';
      case 'paused': return 'bg-yellow-500/20 text-yellow-400';
      case 'completed': return 'bg-blue-500/20 text-blue-400';
      case 'abandoned': return 'bg-red-500/20 text-red-400';
      default: return 'bg-white/10 text-white/50';
    }
  };
  
  // Get status label
  const getStatusLabel = () => {
    switch (plan.status) {
      case 'active': return 'Active';
      case 'paused': return 'Paused';
      case 'completed': return 'Completed';
      case 'abandoned': return 'Abandoned';
      default: return plan.status;
    }
  };

  const handlePress = () => {
    haptic('light');
    if (isActive) {
      onContinue(plan.id);
    } else if (isPaused && onActivate) {
      onActivate(plan.id);
    }
  };

  // Generate emoji based on plan title
  const getEmoji = () => {
    const title = plan.title.toLowerCase();
    if (title.includes('guitar') || title.includes('music')) return '🎸';
    if (title.includes('python') || title.includes('code') || title.includes('programming')) return '🐍';
    if (title.includes('design') || title.includes('ui') || title.includes('ux')) return '🎨';
    if (title.includes('math') || title.includes('calculus')) return '📐';
    if (title.includes('language') || title.includes('spanish') || title.includes('french')) return '🌍';
    if (title.includes('fitness') || title.includes('exercise')) return '💪';
    if (title.includes('cooking') || title.includes('chef')) return '👨‍🍳';
    if (title.includes('photo')) return '📷';
    if (title.includes('write') || title.includes('writing')) return '✍️';
    return '📚';
  };

  return (
    <button
      onClick={handlePress}
      disabled={isCompleted}
      className={`
        w-full bg-[#1C1C1E] rounded-2xl p-4 text-left transition-colors
        ${isCompleted ? 'opacity-60' : 'active:bg-[#2C2C2E]'}
      `}
    >
      <div className="flex items-start gap-3">
        {/* Emoji Icon */}
        <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
          {getEmoji()}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title + Status */}
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-white font-medium truncate flex-1">
              {plan.capstone?.title || plan.title}
            </h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-medium ${getStatusColor()}`}>
              {getStatusLabel()}
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isCompleted ? 'bg-blue-500' : isActive ? 'bg-green-500' : 'bg-white/30'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-white/50 text-xs w-8 text-right">
              {progressPercent}%
            </span>
          </div>
          
          {/* Stats */}
          <div className="flex items-center gap-3 mt-2 text-xs text-white/40">
            {plan.subskills && (
              <span>
                {plan.subskills.filter(s => s.status === 'completed').length}/{plan.subskills.length} skills
              </span>
            )}
            {plan.estimatedTimeDisplay && (
              <span>~{plan.estimatedTimeDisplay}</span>
            )}
          </div>
        </div>
        
        {/* Arrow */}
        {!isCompleted && (
          <ChevronRightIcon size={20} className="text-white/30 flex-shrink-0 mt-2" />
        )}
      </div>
    </button>
  );
}
