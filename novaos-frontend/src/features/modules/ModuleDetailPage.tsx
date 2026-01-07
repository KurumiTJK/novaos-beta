// ═══════════════════════════════════════════════════════════════════════════════
// MODULE DETAIL PAGE
// ═══════════════════════════════════════════════════════════════════════════════

import { useUIStore } from '@/shared/stores';
import { useLessonStore } from '@/shared/stores/lessonStore';
import { useHaptic } from '@/shared/hooks';
import { CloseIcon } from '@/shared/components';
import type { ModuleType, ModuleData } from '@/shared/types';
import { LessonCard } from '@/features/home/components';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ═══════════════════════════════════════════════════════════════════════════════
// TODO: Replace with API calls when backend is wired
// ═══════════════════════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────────────────────────

const moduleData: Record<Exclude<ModuleType, 'learning'>, ModuleData> = {
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
// LEARNING MODULE DETAIL
// ─────────────────────────────────────────────────────────────────────────────────

function LearningModuleDetail({ onClose }: { onClose: () => void }) {
  const { lessons, stats, activePath } = useLessonStore();
  
  const completedLessons = lessons.filter(l => l.status === 'completed').length;
  const inProgressLessons = lessons.filter(l => l.status === 'in_progress').length;

  return (
    <div className="fixed inset-0 max-w-[430px] mx-auto bg-black flex flex-col z-50">
      {/* Header */}
      <header 
        className="flex items-center justify-between px-5 py-3 border-b border-white/10"
        style={{ paddingTop: 'calc(12px + env(safe-area-inset-top))' }}
      >
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-xl text-white active:bg-white/10"
        >
          <CloseIcon size={24} />
        </button>
        <h2 className="text-white font-semibold text-lg">Learning</h2>
        <div className="w-10" />
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* Hero Stats */}
        <div className="bg-gradient-to-br from-purple-600/30 to-purple-900/30 rounded-3xl p-6 text-center mb-5 border border-purple-500/20">
          <div className="text-white text-[48px] font-light leading-none">
            {stats.currentStreak}
          </div>
          <div className="text-white/50 mt-2">Day Streak 🔥</div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-nova-dark rounded-2xl p-4">
            <div className="text-white/50 text-sm">Completed</div>
            <div className="text-white text-2xl font-medium mt-1">
              {completedLessons}
            </div>
          </div>
          <div className="bg-nova-dark rounded-2xl p-4">
            <div className="text-white/50 text-sm">In Progress</div>
            <div className="text-white text-2xl font-medium mt-1">
              {inProgressLessons}
            </div>
          </div>
          <div className="bg-nova-dark rounded-2xl p-4">
            <div className="text-white/50 text-sm">Sessions</div>
            <div className="text-white text-2xl font-medium mt-1">
              {stats.totalSessionsCompleted}
            </div>
          </div>
          <div className="bg-nova-dark rounded-2xl p-4">
            <div className="text-white/50 text-sm">Sparks Today</div>
            <div className="text-white text-2xl font-medium mt-1">
              {stats.sparksCompletedToday}
            </div>
          </div>
        </div>

        {/* Active Path */}
        {activePath && (
          <div className="mb-5">
            <h3 className="text-white/70 text-sm font-medium mb-3 px-1">🎯 Current Goal</h3>
            <div className="bg-nova-dark rounded-2xl p-4">
              <p className="text-white font-medium mb-2">{activePath.goal}</p>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full"
                    style={{ width: `${activePath.progress * 100}%` }}
                  />
                </div>
                <span className="text-purple-400 text-sm">{Math.round(activePath.progress * 100)}%</span>
              </div>
              <p className="text-white/40 text-xs">
                {activePath.milestones.filter(m => m.completed).length}/{activePath.milestones.length} milestones complete
              </p>
            </div>
          </div>
        )}

        {/* Lessons List */}
        <div>
          <h3 className="text-white/70 text-sm font-medium mb-3 px-1">📚 All Lessons</h3>
          <div className="space-y-2">
            {lessons.map((lesson) => (
              <LessonCard key={lesson.id} lesson={lesson} />
            ))}
          </div>
        </div>
      </div>

      {/* Exit Button */}
      <div 
        className="px-5 py-4"
        style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={onClose}
          className="w-full py-4 bg-nova-dark rounded-2xl text-white font-medium active:bg-nova-dark/80"
        >
          Exit
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// STANDARD MODULE DETAIL
// ─────────────────────────────────────────────────────────────────────────────────

function StandardModuleDetail({ 
  module, 
  data, 
  onClose 
}: { 
  module: ModuleType; 
  data: ModuleData; 
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 max-w-[430px] mx-auto bg-black flex flex-col z-50">
      {/* Header */}
      <header 
        className="flex items-center justify-between px-5 py-3 border-b border-white/10"
        style={{ paddingTop: 'calc(12px + env(safe-area-inset-top))' }}
      >
        <button
          onClick={onClose}
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
          onClick={onClose}
          className="w-full py-4 bg-nova-dark rounded-2xl text-white font-medium active:bg-nova-dark/80"
        >
          Exit
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────────

export function ModuleDetailPage() {
  const { activeModule, closeModule } = useUIStore();
  const haptic = useHaptic();

  if (!activeModule) return null;

  const handleClose = () => {
    haptic('light');
    closeModule();
  };

  // Special handling for learning module
  if (activeModule === 'learning') {
    return <LearningModuleDetail onClose={handleClose} />;
  }

  // Standard module handling
  const data = moduleData[activeModule];
  if (!data) return null;

  return <StandardModuleDetail module={activeModule} data={data} onClose={handleClose} />;
}
