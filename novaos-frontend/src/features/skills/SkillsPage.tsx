// ═══════════════════════════════════════════════════════════════════════════════
// ACTIONS PAGE — Quick Actions
// ═══════════════════════════════════════════════════════════════════════════════

import { useUIStore } from '@/shared/stores';
import { useHaptic } from '@/shared/hooks';
import { formatDate } from '@/shared/utils';
import { SettingsIcon } from '@/shared/components';

export function SkillsPage() {
  const { setActiveTab } = useUIStore();
  const haptic = useHaptic();

  const handleSettingsClick = () => {
    haptic('light');
    setActiveTab('settings');
  };

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
        {/* Settings Icon */}
        <button 
          onClick={handleSettingsClick}
          className="w-10 h-10 flex items-center justify-center rounded-full active:bg-white/10"
        >
          <SettingsIcon size={22} className="text-white/70" />
        </button>

        {/* Centered Title */}
        <div className="text-center">
          <p className="text-[13px] text-white/50">{formatDate(new Date())}</p>
          <h1 className="text-[20px] font-semibold tracking-tight">Actions</h1>
        </div>

        {/* Empty spacer for balance */}
        <div className="w-10 h-10" />
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
