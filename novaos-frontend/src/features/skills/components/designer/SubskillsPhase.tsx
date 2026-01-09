// ═══════════════════════════════════════════════════════════════════════════════
// SUBSKILLS PHASE — Review generated subskills
// User reviews the skills they'll learn before continuing
// ═══════════════════════════════════════════════════════════════════════════════

import { useSwordDesignerStore } from '@/shared/stores/swordDesignerStore';

export function SubskillsPhase() {
  const {
    subskills,
    capstone,
    isLoading,
    confirmSubskillsAction,
  } = useSwordDesignerStore();

  if (!subskills || subskills.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-green-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-white/50 text-sm">Breaking down your learning path...</p>
        </div>
      </div>
    );
  }

  const handleConfirm = async () => {
    if (isLoading) return;
    await confirmSubskillsAction();
  };

  // Estimate total time
  const totalSessions = subskills.reduce((sum, s) => sum + s.totalSessions, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-3">
        <h2 className="text-lg font-semibold text-white">Skills You'll Learn</h2>
        <p className="text-sm text-white/50 mt-1">
          {subskills.length} skills • ~{totalSessions} sessions total
        </p>
      </div>

      {/* Subskills List */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {/* Goal Reference */}
        {capstone && (
          <div className="bg-white/5 rounded-xl p-3 mb-4">
            <div className="text-xs text-white/50 mb-1">🎯 YOUR GOAL</div>
            <p className="text-white text-sm">{capstone.title}</p>
          </div>
        )}

        {/* Skills */}
        <div className="space-y-3">
          {subskills.map((skill, index) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              index={index}
              total={subskills.length}
            />
          ))}
        </div>

        {/* Summary */}
        <div className="mt-4 p-3 bg-white/5 rounded-xl">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/50">Total sessions</span>
            <span className="text-white">{totalSessions}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-white/50">Estimated time</span>
            <span className="text-white">~{Math.ceil(totalSessions * 15 / 60)} hours</span>
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
              Creating learning path...
            </span>
          ) : (
            'Continue'
          )}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// SKILL CARD COMPONENT
// ─────────────────────────────────────────────────────────────────────────────────

interface SkillCardProps {
  skill: {
    id: string;
    title: string;
    description: string;
    totalSessions: number;
  };
  index: number;
  total: number;
}

function SkillCard({ skill, index, total }: SkillCardProps) {
  return (
    <div className="bg-[#1C1C1E] rounded-2xl p-4">
      <div className="flex items-start gap-3">
        {/* Number indicator */}
        <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-green-400 text-sm font-medium">{index + 1}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium">{skill.title}</h3>
          <p className="text-white/50 text-sm mt-1 line-clamp-2">{skill.description}</p>
          
          {/* Meta */}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-white/30 text-xs">
              {skill.totalSessions} sessions
            </span>
            {index < total - 1 && (
              <span className="text-white/20 text-xs">→</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
