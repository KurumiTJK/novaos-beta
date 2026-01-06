// ═══════════════════════════════════════════════════════════════════════════════
// HOME PAGE — Pillowtalk Design (iPhone 16 Pro - No Scroll)
// ═══════════════════════════════════════════════════════════════════════════════

import { useUIStore } from '@/shared/stores';
import { useHaptic } from '@/shared/hooks';
import { formatDate } from '@/shared/utils';
import { BellIcon, PlusIcon, SettingsIcon } from '@/shared/components';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK DATA (will be replaced with real API later)
// ─────────────────────────────────────────────────────────────────────────────────

const widgetData = {
  finance: { label: 'Finance', value: '$47.8k', sublabel: '+2.4%' },
  health: { label: 'Health', value: '72%', sublabel: 'Recovery' },
  calendar: { label: 'Calendar', value: '3', sublabel: 'Events today' },
  reminders: { label: 'Reminders', value: '5', sublabel: 'Pending' },
};

// ─────────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────────

export function HomePage() {
  const { homeTab, setHomeTab, openChat, openModule, setActiveTab } = useUIStore();
  const haptic = useHaptic();

  const handleWidgetClick = (type: string) => {
    haptic('light');
    openModule(type as any);
  };

  const handleAddClick = () => {
    haptic('medium');
    openChat();
  };

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
          <h1 className="text-[20px] font-semibold tracking-tight">NovaOS Home</h1>
        </div>

        {/* Empty spacer for balance */}
        <div className="w-10 h-10" />
      </header>

      {/* Overview/Lessons Tab */}
      <div className="mx-5 mt-3 mb-4 bg-nova-dark rounded-full p-1 flex flex-shrink-0">
        <button
          onClick={() => { haptic('light'); setHomeTab('overview'); }}
          className={`flex-1 py-2 px-4 rounded-full text-[14px] font-medium transition-all flex items-center justify-center gap-2 ${
            homeTab === 'overview'
              ? 'bg-cream text-nova-black'
              : 'text-white/50'
          }`}
        >
          {homeTab === 'overview' && <span>📊</span>}
          Overview
        </button>
        <button
          onClick={() => { haptic('light'); setHomeTab('lessons'); }}
          className={`flex-1 py-2 px-4 rounded-full text-[14px] font-medium transition-all flex items-center justify-center gap-2 ${
            homeTab === 'lessons'
              ? 'bg-cream text-nova-black'
              : 'text-white/50'
          }`}
        >
          {homeTab === 'lessons' && <span>📚</span>}
          Lessons
        </button>
      </div>

      {/* Main Content Area - Flexbox fills remaining space */}
      <div className="flex-1 flex flex-col px-5 min-h-0">
        {/* Widget Grid */}
        {homeTab === 'overview' && (
          <>
            <div className="grid grid-cols-2 gap-2.5 flex-shrink-0" style={{ height: '45%' }}>
              {Object.entries(widgetData).map(([key, data]) => (
                <button
                  key={key}
                  onClick={() => handleWidgetClick(key)}
                  className="bg-cream rounded-2xl p-3 text-left flex flex-col justify-between active:scale-[0.98] transition-transform"
                >
                  <span className="text-nova-black/60 text-xs font-medium">
                    {data.label}
                  </span>
                  <div>
                    <div className="text-nova-black text-[36px] font-light leading-none">
                      {data.value}
                    </div>
                    <div className="text-nova-black/50 text-xs mt-0.5">
                      {data.sublabel}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Spark Section (Task) - Takes remaining space */}
            <div className="flex-1 mt-3 bg-nova-spark rounded-2xl relative overflow-hidden min-h-0">
              {/* Task Badge */}
              <div className="flex items-center gap-2 px-4 pt-4">
                <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5">
                  <BellIcon size={12} className="text-white" />
                  <span className="text-white text-xs font-medium">task</span>
                </div>
              </div>

              {/* Task Content */}
              <div className="px-4 pt-3">
                <p className="text-accent text-[14px] leading-relaxed">
                  Review your Q4 investment allocations and rebalance if equity exposure exceeds 70% threshold.
                </p>
              </div>

              {/* Wave Background */}
              <div className="absolute bottom-0 left-0 right-0 h-[50px] overflow-hidden pointer-events-none">
                <svg
                  className="absolute bottom-0 w-[200%] animate-wave"
                  viewBox="0 0 1200 120"
                  preserveAspectRatio="none"
                  style={{ height: '100%' }}
                >
                  <path
                    d="M0,60 C150,120 350,0 600,60 C850,120 1050,0 1200,60 L1200,120 L0,120 Z"
                    fill="rgba(167,139,250,0.15)"
                  />
                </svg>
                <svg
                  className="absolute bottom-0 w-[200%] animate-wave-slow"
                  viewBox="0 0 1200 120"
                  preserveAspectRatio="none"
                  style={{ height: '80%' }}
                >
                  <path
                    d="M0,60 C200,0 400,120 600,60 C800,0 1000,120 1200,60 L1200,120 L0,120 Z"
                    fill="rgba(167,139,250,0.1)"
                  />
                </svg>
              </div>

              {/* FAB Button */}
              <button
                onClick={handleAddClick}
                className="absolute bottom-3 right-4 w-11 h-11 bg-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform z-10"
              >
                <PlusIcon size={22} className="text-nova-black" />
              </button>
            </div>
          </>
        )}

        {/* Lessons Tab Content */}
        {homeTab === 'lessons' && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-white/50">
              <span className="text-4xl mb-4 block">📚</span>
              <p>Lessons coming soon</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
