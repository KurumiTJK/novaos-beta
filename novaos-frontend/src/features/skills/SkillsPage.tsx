// ═══════════════════════════════════════════════════════════════════════════════
// ACTIONS PAGE — Quick Actions
// ═══════════════════════════════════════════════════════════════════════════════

export function SkillsPage() {
  return (
    <div 
      className="flex flex-col h-full overflow-hidden"
      style={{ paddingBottom: 'calc(70px + env(safe-area-inset-bottom))' }}
    >
      {/* Header */}
      <header 
        className="px-5 flex-shrink-0 flex items-center justify-center"
        style={{ paddingTop: 'calc(12px + env(safe-area-inset-top))' }}
      >
        <h1 className="text-[20px] font-semibold tracking-tight">Actions</h1>
      </header>

      <div className="flex-1 flex items-center justify-center px-5">
        <div className="text-center text-white/50">
          <span className="text-5xl mb-4 block">⚡</span>
          <h2 className="text-xl font-medium text-white mb-2">Coming Soon</h2>
          <p className="text-sm">
            Quick actions and automations
          </p>
        </div>
      </div>
    </div>
  );
}
