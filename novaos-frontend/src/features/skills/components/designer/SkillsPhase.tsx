// ═══════════════════════════════════════════════════════════════════════════════
// SKILLS PHASE — Review generated learning plan
// Shows capstone, subskills, and routing all together for review
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { useSwordDesignerStore } from '@/shared/stores/swordDesignerStore';

// Route type labels and colors
const ROUTE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  learn: { label: 'Learn', color: 'bg-blue-500/20 text-blue-400', icon: '📖' },
  practice: { label: 'Practice', color: 'bg-purple-500/20 text-purple-400', icon: '🎯' },
  assess: { label: 'Assess', color: 'bg-green-500/20 text-green-400', icon: '✓' },
  skip: { label: 'Skip', color: 'bg-gray-500/20 text-gray-400', icon: '⏭️' },
  // Legacy route types
  tutorial: { label: 'Tutorial', color: 'bg-blue-500/20 text-blue-400', icon: '📖' },
  project: { label: 'Project', color: 'bg-orange-500/20 text-orange-400', icon: '🛠️' },
  assessment: { label: 'Assessment', color: 'bg-green-500/20 text-green-400', icon: '✓' },
};

export function SkillsPhase() {
  const {
    capstone,
    reviewData,
    isLoading,
    confirmSkills,
  } = useSwordDesignerStore();

  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  // Use reviewData if available, otherwise fall back to store data
  const displayCapstone = reviewData?.capstone || capstone;
  const displaySubskills = reviewData?.subskills || [];
  const totalSessions = reviewData?.totalSessions || displaySubskills.reduce((sum, s) => sum + (s.estimatedSessions || s.totalSessions || 0), 0);
  const estimatedWeeks = reviewData?.estimatedWeeks || Math.ceil(totalSessions / 5);
  const estimatedTimeDisplay = reviewData?.estimatedTimeDisplay || `~${estimatedWeeks} weeks`;

  if (!displayCapstone && !displaySubskills.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-green-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-white/50 text-sm">Loading your learning plan...</p>
        </div>
      </div>
    );
  }

  const handleConfirm = async () => {
    if (isLoading) return;
    await confirmSkills();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-3">
        <h2 className="text-lg font-semibold text-white">Your Learning Plan</h2>
        <p className="text-sm text-white/50 mt-1">
          Review your personalized learning path
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
        {/* Capstone Card */}
        {displayCapstone && (
          <div className="bg-gradient-to-br from-green-500/20 to-green-500/5 rounded-2xl p-4 border border-green-500/20">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-xl">🎯</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-semibold">{displayCapstone.title}</h3>
                <p className="text-white/60 text-sm mt-1 line-clamp-2">
                  {displayCapstone.description}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className="flex gap-3">
          <div className="flex-1 bg-[#1C1C1E] rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-white">{displaySubskills.length}</div>
            <div className="text-xs text-white/50">Skills</div>
          </div>
          <div className="flex-1 bg-[#1C1C1E] rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-white">{totalSessions}</div>
            <div className="text-xs text-white/50">Sessions</div>
          </div>
          <div className="flex-1 bg-[#1C1C1E] rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-white">{estimatedTimeDisplay}</div>
            <div className="text-xs text-white/50">Duration</div>
          </div>
        </div>

        {/* Skills List */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-white/70">Skills you'll learn</h4>
          
          {displaySubskills.map((skill, index) => {
            const routeKey = skill.route || 'learn';
            const routeConfig = ROUTE_CONFIG[routeKey] || ROUTE_CONFIG.learn;
            const isExpanded = expandedSkill === skill.id;
            const sessions = skill.estimatedSessions || skill.totalSessions || 1;
            
            return (
              <div key={skill.id} className="bg-[#1C1C1E] rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedSkill(isExpanded ? null : skill.id)}
                  className="w-full p-3 flex items-center gap-3 text-left"
                >
                  {/* Order number */}
                  <div className="w-7 h-7 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-green-400 text-sm font-medium">{index + 1}</span>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-medium truncate">{skill.title}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] ${routeConfig.color}`}>
                        {routeConfig.icon} {routeConfig.label}
                      </span>
                    </div>
                    <div className="text-white/40 text-xs mt-0.5">
                      {sessions} session{sessions !== 1 ? 's' : ''}
                    </div>
                  </div>
                  
                  {/* Expand icon */}
                  <span className={`text-white/30 text-sm transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>
                
                {/* Expanded content */}
                {isExpanded && skill.description && (
                  <div className="px-3 pb-3 pt-0">
                    <div className="pl-10 pt-2 border-t border-white/5">
                      <p className="text-white/60 text-sm">{skill.description}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Info Note */}
        <div className="p-3 bg-white/5 rounded-xl">
          <p className="text-white/40 text-xs text-center">
            💡 Your plan is personalized based on your goals and experience level
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
              Creating plan...
            </span>
          ) : (
            'Create My Learning Plan'
          )}
        </button>
      </div>
    </div>
  );
}
