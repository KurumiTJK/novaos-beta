// ═══════════════════════════════════════════════════════════════════════════════
// UI STORE — Novaux
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import type { TabId, ModuleType } from '../types';

interface UIStore {
  // Tab navigation
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  
  // Chat screen
  isChatOpen: boolean;
  openChat: () => void;
  closeChat: () => void;
  
  // Module detail
  activeModule: ModuleType | null;
  openModule: (module: ModuleType) => void;
  closeModule: () => void;
  
  // Home screen tab (Overview/Lessons)
  homeTab: 'overview' | 'lessons';
  setHomeTab: (tab: 'overview' | 'lessons') => void;
}

export const useUIStore = create<UIStore>((set) => ({
  // Tab navigation
  activeTab: 'home',
  setActiveTab: (tab) => set({ activeTab: tab }),
  
  // Chat screen
  isChatOpen: false,
  openChat: () => set({ isChatOpen: true }),
  closeChat: () => set({ isChatOpen: false }),
  
  // Module detail
  activeModule: null,
  openModule: (module) => set({ activeModule: module }),
  closeModule: () => set({ activeModule: null }),
  
  // Home screen tab
  homeTab: 'overview',
  setHomeTab: (tab) => set({ homeTab: tab }),
}));
