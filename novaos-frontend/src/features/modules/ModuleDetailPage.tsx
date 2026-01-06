// ═══════════════════════════════════════════════════════════════════════════════
// MODULE DETAIL PAGE
// ═══════════════════════════════════════════════════════════════════════════════

import { useUIStore } from '@/shared/stores';
import { useHaptic } from '@/shared/hooks';
import { CloseIcon } from '@/shared/components';
import type { ModuleType, ModuleData } from '@/shared/types';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────────

const moduleData: Record<ModuleType, ModuleData> = {
  finance: {
    title: 'Finance',
    hero: { value: '$47,832', label: 'Total Portfolio' },
    cards: [
      { label: 'Day Change', value: '+$1,124' },
      { label: 'Week', value: '+2.4%' },
      { label: 'Holdings', value: '3' },
      { label: 'Best', value: 'NVDA' },
    ],
  },
  health: {
    title: 'Health',
    hero: { value: '72%', label: 'Recovery Score' },
    cards: [
      { label: 'RHR', value: '58 bpm' },
      { label: 'HRV', value: '34 ms' },
      { label: 'Sleep', value: '7.2h' },
      { label: 'Strain', value: '8.4' },
    ],
  },
  calendar: {
    title: 'Calendar',
    hero: { value: '3', label: 'Events Today' },
    cards: [
      { label: 'Next', value: '2:00 PM' },
      { label: 'Free', value: '4h' },
      { label: 'Week', value: '12' },
      { label: 'Busy', value: '3' },
    ],
  },
  reminders: {
    title: 'Reminders',
    hero: { value: '5', label: 'Tasks Pending' },
    cards: [
      { label: 'Urgent', value: '2' },
      { label: 'Done', value: '8' },
      { label: 'Streak', value: '5d' },
      { label: 'Late', value: '0' },
    ],
  },
  weather: {
    title: 'Weather',
    hero: { value: '72°F', label: 'Partly Cloudy' },
    cards: [
      { label: 'Feels', value: '70°F' },
      { label: 'Wind', value: '8 mph' },
      { label: 'Humid', value: '45%' },
      { label: 'UV', value: '3' },
    ],
  },
  email: {
    title: 'Email',
    hero: { value: '12', label: 'Unread' },
    cards: [
      { label: 'Today', value: '5' },
      { label: 'Flag', value: '3' },
      { label: 'Sent', value: '8' },
      { label: 'Draft', value: '2' },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────────

export function ModuleDetailPage() {
  const { activeModule, closeModule } = useUIStore();
  const haptic = useHaptic();

  if (!activeModule) return null;

  const data = moduleData[activeModule];

  const handleClose = () => {
    haptic('light');
    closeModule();
  };

  return (
    <div className="fixed inset-0 max-w-[430px] mx-auto bg-black flex flex-col z-50">
      {/* Header */}
      <header 
        className="flex items-center justify-between px-5 py-3 border-b border-white/10"
        style={{ paddingTop: 'calc(12px + env(safe-area-inset-top))' }}
      >
        <button
          onClick={handleClose}
          className="w-10 h-10 flex items-center justify-center rounded-xl text-white active:bg-white/10"
        >
          <CloseIcon size={24} />
        </button>
        <h2 className="text-white font-semibold text-lg">{data.title}</h2>
        <div className="w-10" />
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* Hero */}
        <div className="bg-nova-dark rounded-3xl p-8 text-center mb-5">
          <div className="text-white text-[56px] font-light leading-none">
            {data.hero.value}
          </div>
          <div className="text-white/50 mt-2">{data.hero.label}</div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {data.cards.map((card, index) => (
            <div
              key={index}
              className="bg-nova-dark rounded-2xl p-4"
            >
              <div className="text-white/50 text-sm">{card.label}</div>
              <div className="text-white text-2xl font-medium mt-1">
                {card.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Exit Button */}
      <div 
        className="px-5 py-4"
        style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={handleClose}
          className="w-full py-4 bg-nova-dark rounded-2xl text-white font-medium active:bg-nova-dark/80"
        >
          Exit
        </button>
      </div>
    </div>
  );
}
