// ═══════════════════════════════════════════════════════════════════════════════
// HOME PAGE — Pillowtalk Design
// ═══════════════════════════════════════════════════════════════════════════════

import { useUIStore } from '@/shared/stores';
import { useHaptic } from '@/shared/hooks';
import { formatDate } from '@/shared/utils';
import { BellIcon, PlusIcon } from '@/shared/components';

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
  const { homeTab, setHomeTab, openChat, openModule } = useUIStore();
  const haptic = useHaptic();

  const handleWidgetClick = (type: string) => {
    haptic('light');
    openModule(type as any);
  };

  const handleAddClick = () => {
    haptic('medium');
    openChat();
  };

  return (
    <div className="flex flex-col h-full pb-[calc(70px+env(safe-area-inset-bottom))]">
      {/* Header */}
      <header 
        className="px-5 pb-1"
        style={{ paddingTop: 'calc(24px + env(safe-area-inset-top))' }}
      >
        <p className="text-[15px] text-white/50">{formatDate(new Date())}</p>
        <h1 className="text-[34px] font-light tracking-tight">Overview</h1>
      </header>

      {/* Overview/Lessons Tab */}
      <div className="mx-5 mt-1.5 mb-6 bg-nova-dark rounded-full p-1 flex">
        <button
          onClick={() => { haptic('light'); setHomeTab('overview'); }}
          className={`flex-1 py-2.5 px-5 rounded-full text-[15px] font-medium transition-all flex items-center justify-center gap-2 ${
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
          className={`flex-1 py-2.5 px-5 rounded-full text-[15px] font-medium transition-all flex items-center justify-center gap-2 ${
            homeTab === 'lessons'
              ? 'bg-cream text-nova-black'
              : 'text-white/50'
          }`}
        >
          {homeTab === 'lessons' && <span>📚</span>}
          Lessons
        </button>
      </div>

      {/* Widget Grid */}
      {homeTab === 'overview' && (
        <div className="px-5 grid grid-cols-2 gap-2.5" style={{ height: '260px' }}>
          {Object.entries(widgetData).map(([key, data]) => (
            <button
              key={key}
              onClick={() => handleWidgetClick(key)}
              className="bg-cream rounded-3xl p-4 text-left flex flex-col justify-between active:scale-[0.98] transition-transform"
            >
              <span className="text-nova-black/60 text-sm font-medium">
                {data.label}
              </span>
              <div>
                <div className="text-nova-black text-[48px] font-light leading-none">
                  {data.value}
                </div>
                <div className="text-nova-black/50 text-sm mt-1">
                  {data.sublabel}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Lessons Tab Content */}
      {homeTab === 'lessons' && (
        <div className="px-5 flex-1 flex items-center justify-center">
          <div className="text-center text-white/50">
            <span className="text-4xl mb-4 block">📚</span>
            <p>Lessons coming soon</p>
          </div>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Spark Section (Task) */}
      <div className="mx-5 mb-0 bg-nova-spark rounded-t-3xl relative overflow-hidden">
        {/* Task Badge */}
        <div className="flex items-center gap-2 px-5 pt-5">
          <div className="flex items-center gap-2 bg-white/10 rounded-full px-3.5 py-2">
            <BellIcon size={14} className="text-white" />
            <span className="text-white text-sm font-medium">task</span>
          </div>
        </div>

        {/* Task Content */}
        <div className="px-5 pt-4 pb-16">
          <p className="text-accent text-[15px] leading-relaxed">
            Review your Q4 investment allocations and rebalance if equity exposure exceeds 70% threshold.
          </p>
        </div>

        {/* Wave Background */}
        <div className="absolute bottom-0 left-0 right-0 h-[60px] overflow-hidden pointer-events-none">
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
          className="absolute bottom-3 right-5 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform z-10"
        >
          <PlusIcon size={24} className="text-nova-black" />
        </button>
      </div>
    </div>
  );
}
