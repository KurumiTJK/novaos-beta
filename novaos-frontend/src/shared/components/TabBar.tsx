// ═══════════════════════════════════════════════════════════════════════════════
// TAB BAR — Novaux
// ═══════════════════════════════════════════════════════════════════════════════

import { useUIStore } from '../stores';
import { useHaptic } from '../hooks';
import { HomeIcon, ModulesIcon, SkillsIcon, SettingsIcon } from './Icons';
import type { TabId } from '../types';

const tabs: { id: TabId; label: string; Icon: typeof HomeIcon }[] = [
  { id: 'home', label: 'Home', Icon: HomeIcon },
  { id: 'modules', label: 'Modules', Icon: ModulesIcon },
  { id: 'skills', label: 'Skills', Icon: SkillsIcon },
  { id: 'settings', label: 'Settings', Icon: SettingsIcon },
];

export function TabBar() {
  const { activeTab, setActiveTab, isChatOpen, activeModule } = useUIStore();
  const haptic = useHaptic();

  // Hide tab bar when chat or module is open
  if (isChatOpen || activeModule) return null;

  const handleTabClick = (id: TabId) => {
    haptic('light');
    setActiveTab(id);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto bg-black z-50">
      <div 
        className="flex items-center justify-around px-6 py-3"
        style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}
      >
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => handleTabClick(id)}
            className={`flex flex-col items-center gap-1 px-3 py-1 transition-colors ${
              activeTab === id ? 'text-white' : 'text-white/50'
            }`}
          >
            <Icon size={24} />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
