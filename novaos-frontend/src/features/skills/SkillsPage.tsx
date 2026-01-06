// ═══════════════════════════════════════════════════════════════════════════════
// SKILLS PAGE — Placeholder
// ═══════════════════════════════════════════════════════════════════════════════

export function SkillsPage() {
  return (
    <div 
      className="flex flex-col h-full pb-[calc(70px+env(safe-area-inset-bottom))]"
      style={{ paddingTop: 'calc(24px + env(safe-area-inset-top))' }}
    >
      <header className="px-5 pb-4">
        <h1 className="text-[34px] font-light tracking-tight">Skills</h1>
      </header>

      <div className="flex-1 flex items-center justify-center px-5">
        <div className="text-center text-white/50">
          <span className="text-5xl mb-4 block">⭐</span>
          <h2 className="text-xl font-medium text-white mb-2">Coming Soon</h2>
          <p className="text-sm">
            Track your learning progress and skill development
          </p>
        </div>
      </div>
    </div>
  );
}
