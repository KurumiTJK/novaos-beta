// ═══════════════════════════════════════════════════════════════════════════════
// SKILLS PAGE — SwordGate Learning Hub
// ═══════════════════════════════════════════════════════════════════════════════

import { useUIStore } from '@/shared/stores';
import { SwordDesigner } from './components/SwordDesigner';
import { SwordRunner } from './components/SwordRunner';
import { SwordHome } from './components/SwordHome';

export function SkillsPage() {
  const { swordState, closeSword } = useUIStore();

  return (
    <div 
      className="flex flex-col h-full overflow-hidden"
      style={{ paddingBottom: 'calc(70px + env(safe-area-inset-bottom))' }}
    >
      {/* Header */}
      <header 
        className="px-5 flex-shrink-0 flex items-center justify-between"
        style={{ paddingTop: 'calc(12px + env(safe-area-inset-top))' }}
      >
        <h1 className="text-[20px] font-semibold tracking-tight">Learn</h1>
        {swordState.isActive && (
          <button
            onClick={closeSword}
            className="text-sm text-white/50 hover:text-white active:text-white/70 transition-colors"
          >
            Exit
          </button>
        )}
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!swordState.isActive && <SwordHome />}
        {swordState.isActive && swordState.mode === 'designer' && (
          <SwordDesigner topic={swordState.topic} />
        )}
        {swordState.isActive && swordState.mode === 'runner' && (
          <SwordRunner planId={swordState.planId} />
        )}
      </div>
    </div>
  );
}
