// ═══════════════════════════════════════════════════════════════════════════════
// MODULES PAGE — Module List
// ═══════════════════════════════════════════════════════════════════════════════

import { useUIStore } from '@/shared/stores';
import { useHaptic } from '@/shared/hooks';
import { ChevronRightIcon } from '@/shared/components';
import type { ModuleType } from '@/shared/types';

const modules: { id: ModuleType; label: string; emoji: string; description: string }[] = [
  { id: 'finance', label: 'Finance', emoji: '💰', description: 'Portfolio & investments' },
  { id: 'health', label: 'Health', emoji: '❤️', description: 'Recovery & vitals' },
  { id: 'calendar', label: 'Calendar', emoji: '📅', description: 'Events & schedule' },
  { id: 'reminders', label: 'Reminders', emoji: '✅', description: 'Tasks & to-dos' },
  { id: 'weather', label: 'Weather', emoji: '🌤️', description: 'Forecast & conditions' },
  { id: 'email', label: 'Email', emoji: '📧', description: 'Inbox & messages' },
];

export function ModulesPage() {
  const { openModule } = useUIStore();
  const haptic = useHaptic();

  const handleModuleClick = (id: ModuleType) => {
    haptic('light');
    openModule(id);
  };

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
        <h1 className="text-[20px] font-semibold tracking-tight">Modules</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-5 mt-4">
        <div className="space-y-2">
          {modules.map((module) => (
            <button
              key={module.id}
              onClick={() => handleModuleClick(module.id)}
              className="w-full bg-nova-dark rounded-2xl p-4 flex items-center gap-4 active:bg-nova-dark/80 transition-colors"
            >
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-2xl">
                {module.emoji}
              </div>
              <div className="flex-1 text-left">
                <div className="text-white font-medium">{module.label}</div>
                <div className="text-white/50 text-sm">{module.description}</div>
              </div>
              <ChevronRightIcon size={20} className="text-white/30" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
