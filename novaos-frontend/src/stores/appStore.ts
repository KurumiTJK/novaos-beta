// ═══════════════════════════════════════════════════════════════════════════════
// APP STORE — Global Application State
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppMode, ModuleType, Stance } from '../types';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

interface AppState {
  // UI State
  mode: AppMode;
  activeModule: ModuleType | null;
  activeStance: Stance;
  isSidebarOpen: boolean;
  isOnboarded: boolean;

  // Theme
  theme: 'dark' | 'light';

  // Notifications
  notifications: Notification[];

  // Actions
  setMode: (mode: AppMode) => void;
  setActiveModule: (module: ModuleType | null) => void;
  setActiveStance: (stance: Stance) => void;
  toggleSidebar: () => void;
  setOnboarded: (value: boolean) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;

  // Navigation helpers
  enterChatMode: () => void;
  enterModuleMode: (module: ModuleType) => void;
  enterControlMode: () => void;
  enterSwordMode: () => void;
  exitCurrentMode: () => void;
}

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  timestamp: number;
  duration?: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      mode: 'chat',
      activeModule: null,
      activeStance: 'lens',
      isSidebarOpen: false,
      isOnboarded: false,
      theme: 'dark',
      notifications: [],

      // Basic setters
      setMode: (mode) => set({ mode }),
      setActiveModule: (module) => set({ activeModule: module }),
      setActiveStance: (stance) => set({ activeStance: stance }),
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setOnboarded: (value) => set({ isOnboarded: value }),
      setTheme: (theme) => set({ theme }),

      // Notifications
      addNotification: (notification) => {
        const id = `notif-${Date.now()}`;
        set((state) => ({
          notifications: [
            ...state.notifications,
            { ...notification, id, timestamp: Date.now() },
          ],
        }));
      },
      removeNotification: (id) => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      },
      clearNotifications: () => set({ notifications: [] }),

      // Navigation helpers
      enterChatMode: () => {
        set({ mode: 'chat', activeModule: null });
      },
      enterModuleMode: (module) => {
        set({ mode: 'module', activeModule: module });
      },
      enterControlMode: () => {
        set({ mode: 'control', activeModule: null, activeStance: 'control' });
      },
      enterSwordMode: () => {
        set({ mode: 'sword', activeModule: null, activeStance: 'sword' });
      },
      exitCurrentMode: () => {
        set({ mode: 'chat', activeModule: null, activeStance: 'lens' });
      },
    }),
    {
      name: 'novaos-app',
      partialize: (state) => ({
        theme: state.theme,
        isOnboarded: state.isOnboarded,
      }),
    }
  )
);

export default useAppStore;
