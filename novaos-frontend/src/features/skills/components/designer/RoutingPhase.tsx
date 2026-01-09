// ═══════════════════════════════════════════════════════════════════════════════
// ROUTING PHASE — Review learning path
// User reviews the order and approach for each skill
// ═══════════════════════════════════════════════════════════════════════════════

import { useSwordDesignerStore } from '@/shared/stores/swordDesignerStore';

// Route type labels and colors
const ROUTE_CONFIG: Record<string, { label: string; color: string; icon: string; description: string }> = {
  tutorial: { 
    label: 'Tutorial', 
    color: 'bg-blue-500/20 text-blue-400', 
    icon: '📖',
    description: 'Step-by-step instruction',
  },
  practice: { 
    label: 'Practice', 
    color: 'bg-purple-500/20 text-purple-400', 
    icon: '🎯',
    description: 'Hands-on exercises',
  },
  project: { 
    label: 'Project', 
    color: 'bg-orange-500/20 text-orange-400', 
    icon: '🛠️',
    description: 'Build something real',
  },
  assessment: { 
    label: 'Assessment', 
    color: 'bg-green-500/20 text-green-400', 
    icon: '✓',
    description: 'Test your knowledge',
  },
};

export function RoutingPhase() {
  const {
    routing,
    subskills,
    isLoading,
    confirmRoutingAction,
  } = useSwordDesignerStore();

  if (!routing || routing.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-green-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-white/50 text-sm">Planning your learning journey...</p>
        </div>
      </div>
    );
  }

  const handleConfirm = async () => {
    if (isLoading) return;
    await confirmRoutingAction();
  };

  // Group routing by subskill
  const getSubskillName = (subskillId: string): string => {
    const skill = subskills.find(s => s.id === subskillId);
    return skill?.title || 'Unknown Skill';
  };

  // Get unique route types used
  const routeTypes = [...new Set(routing.map(r => r.route))];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-3">
        <h2 className="text-lg font-semibold text-white">Your Learning Path</h2>
        <p className="text-sm text-white/50 mt-1">
          Here's how we'll structure your learning
        </p>
      </div>

      {/* Path Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {/* Route Types Legend */}
        <div className="flex flex-wrap gap-2 mb-4">
          {routeTypes.map(route => {
            const config = ROUTE_CONFIG[route] || { label: route, color: 'bg-white/20 text-white', icon: '📚' };
            return (
              <div key={route} className={`px-2 py-1 rounded-full text-xs ${config.color}`}>
                {config.icon} {config.label}
              </div>
            );
          })}
        </div>

        {/* Path Timeline */}
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-white/10" />

          {/* Path items */}
          <div className="space-y-4">
            {routing.map((item, index) => {
              const config = ROUTE_CONFIG[item.route] || { 
                label: item.route, 
                color: 'bg-white/20 text-white', 
                icon: '📚',
                description: 'Learning content',
              };
              const skillName = getSubskillName(item.subskillId);

              return (
                <div key={`${item.subskillId}-${item.order}`} className="relative pl-10">
                  {/* Timeline dot */}
                  <div className={`
                    absolute left-2 w-5 h-5 rounded-full flex items-center justify-center text-xs
                    ${index === 0 ? 'bg-green-500 text-black' : 'bg-[#1C1C1E] text-white/50 border border-white/10'}
                  `}>
                    {index + 1}
                  </div>

                  {/* Card */}
                  <div className="bg-[#1C1C1E] rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-white text-sm font-medium">{skillName}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${config.color}`}>
                            {config.icon} {config.label}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="text-white/40 text-xs mt-2">{config.description}</p>
                  </div>
                </div>
              );
            })}

            {/* Finish */}
            <div className="relative pl-10">
              <div className="absolute left-2 w-5 h-5 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs">
                🎉
              </div>
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                <h4 className="text-green-400 text-sm font-medium">Capstone Complete!</h4>
                <p className="text-white/40 text-xs mt-1">You'll have achieved your learning goal</p>
              </div>
            </div>
          </div>
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
              Creating your plan...
            </span>
          ) : (
            'Create My Learning Plan'
          )}
        </button>
      </div>
    </div>
  );
}
