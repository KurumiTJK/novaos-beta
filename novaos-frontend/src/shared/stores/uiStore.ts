// ═══════════════════════════════════════════════════════════════════════════════
// UI STORE — Novaux
// With SwordGate navigation support
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import type { TabId, ModuleType, SwordRedirect, SwordState } from '../types';

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
  
  // ─────────────────────────────────────────────────────────────────────────────
  // SWORDGATE STATE
  // ─────────────────────────────────────────────────────────────────────────────
  swordState: SwordState;
  openSword: (redirect: SwordRedirect) => void;
  openSwordDesigner: (topic?: string) => void;
  openSwordRunner: (planId?: string) => void;
  closeSword: () => void;
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
  
  // ─────────────────────────────────────────────────────────────────────────────
  // SWORDGATE STATE
  // ─────────────────────────────────────────────────────────────────────────────
  swordState: {
    isActive: false,
    mode: null,
  },
  
  /**
   * Open SwordGate from redirect signal (called by chatStore on confirm)
   */
  openSword: (redirect) => set({
    swordState: {
      isActive: true,
      mode: redirect.mode,
      planId: redirect.planId,
      topic: redirect.topic,
    },
    activeTab: 'skills',
    isChatOpen: false,
  }),
  
  /**
   * Open designer mode directly (from UI button)
   */
  openSwordDesigner: (topic) => set({
    swordState: {
      isActive: true,
      mode: 'designer',
      topic,
    },
    activeTab: 'skills',
    isChatOpen: false,
  }),
  
  /**
   * Open runner mode directly (from UI button)
   */
  openSwordRunner: (planId) => set({
    swordState: {
      isActive: true,
      mode: 'runner',
      planId,
    },
    activeTab: 'skills',
    isChatOpen: false,
  }),
  
  /**
   * Close SwordGate and return to home state
   */
  closeSword: () => set({
    swordState: {
      isActive: false,
      mode: null,
      planId: undefined,
      topic: undefined,
    },
  }),
}));
