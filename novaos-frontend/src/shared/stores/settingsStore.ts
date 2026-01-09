// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS STORE — NovaOS
// User preferences and app configuration
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import {
  getSettings,
  updateSettings,
  DEFAULT_SETTINGS,
  type Settings,
  type SettingsUpdate,
  type Theme,
  type DefaultStance,
  type NotificationSettings,
} from '../api/settings';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

interface SettingsStore {
  // ─────────────────────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────────────────────
  
  settings: Settings | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  /** Track if settings have been loaded at least once */
  isInitialized: boolean;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────────────────────────
  
  /** Fetch settings from server */
  fetchSettings: () => Promise<void>;
  
  /** Update a single setting */
  updateSetting: <K extends keyof SettingsUpdate>(
    key: K,
    value: SettingsUpdate[K]
  ) => Promise<void>;
  
  /** Update multiple settings at once */
  updateMultiple: (updates: SettingsUpdate) => Promise<void>;
  
  /** Update notification settings */
  updateNotification: <K extends keyof NotificationSettings>(
    key: K,
    value: boolean
  ) => Promise<void>;
  
  /** Reset to defaults (local only - doesn't call API) */
  resetToDefaults: () => void;
  
  /** Clear error */
  clearError: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────────

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: null,
  isLoading: false,
  isSaving: false,
  error: null,
  isInitialized: false,

  // ═══════════════════════════════════════════════════════════════════════════
  // FETCH SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════
  
  fetchSettings: async () => {
    // Don't refetch if already loading
    if (get().isLoading) return;
    
    set({ isLoading: true, error: null });
    
    try {
      const settings = await getSettings();
      set({ 
        settings, 
        isLoading: false, 
        isInitialized: true,
      });
    } catch (error) {
      console.error('[SETTINGS] Fetch failed:', error);
      
      // Use defaults on error
      set({
        settings: {
          ...DEFAULT_SETTINGS,
          id: '',
          userId: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as Settings,
        isLoading: false,
        isInitialized: true,
        error: error instanceof Error ? error.message : 'Failed to load settings',
      });
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // UPDATE SINGLE SETTING
  // ═══════════════════════════════════════════════════════════════════════════
  
  updateSetting: async (key, value) => {
    const { settings } = get();
    if (!settings) return;
    
    // Optimistic update
    set({
      settings: { ...settings, [key]: value },
      isSaving: true,
      error: null,
    });
    
    try {
      const updated = await updateSettings({ [key]: value });
      set({ settings: updated, isSaving: false });
    } catch (error) {
      console.error('[SETTINGS] Update failed:', error);
      
      // Revert on error
      set({
        settings,
        isSaving: false,
        error: error instanceof Error ? error.message : 'Failed to save setting',
      });
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // UPDATE MULTIPLE SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════
  
  updateMultiple: async (updates) => {
    const { settings } = get();
    if (!settings) return;
    
    // Build optimistic settings - handle notifications separately
    const optimisticSettings: Settings = {
      ...settings,
      theme: updates.theme ?? settings.theme,
      defaultStance: updates.defaultStance ?? settings.defaultStance,
      hapticFeedback: updates.hapticFeedback ?? settings.hapticFeedback,
      notifications: updates.notifications 
        ? { ...settings.notifications, ...updates.notifications }
        : settings.notifications,
    };
    
    set({
      settings: optimisticSettings,
      isSaving: true,
      error: null,
    });
    
    try {
      const updated = await updateSettings(updates);
      set({ settings: updated, isSaving: false });
    } catch (error) {
      console.error('[SETTINGS] Update failed:', error);
      
      // Revert on error
      set({
        settings,
        isSaving: false,
        error: error instanceof Error ? error.message : 'Failed to save settings',
      });
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // UPDATE NOTIFICATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  updateNotification: async (key, value) => {
    const { settings } = get();
    if (!settings) return;
    
    const newNotifications: NotificationSettings = {
      ...settings.notifications,
      [key]: value,
    };
    
    // Optimistic update
    set({
      settings: { ...settings, notifications: newNotifications },
      isSaving: true,
      error: null,
    });
    
    try {
      const updated = await updateSettings({ notifications: { [key]: value } });
      set({ settings: updated, isSaving: false });
    } catch (error) {
      console.error('[SETTINGS] Update notification failed:', error);
      
      // Revert on error
      set({
        settings,
        isSaving: false,
        error: error instanceof Error ? error.message : 'Failed to save notification setting',
      });
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // RESET TO DEFAULTS
  // ═══════════════════════════════════════════════════════════════════════════
  
  resetToDefaults: () => {
    const { settings } = get();
    if (!settings) return;
    
    set({
      settings: {
        ...settings,
        theme: DEFAULT_SETTINGS.theme,
        defaultStance: DEFAULT_SETTINGS.defaultStance,
        hapticFeedback: DEFAULT_SETTINGS.hapticFeedback,
        notifications: DEFAULT_SETTINGS.notifications,
      },
    });
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEAR ERROR
  // ═══════════════════════════════════════════════════════════════════════════
  
  clearError: () => {
    set({ error: null });
  },
}));

// ─────────────────────────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────────────────────────

export const selectTheme = (state: { settings: Settings | null }) => 
  state.settings?.theme ?? DEFAULT_SETTINGS.theme;

export const selectDefaultStance = (state: { settings: Settings | null }) => 
  state.settings?.defaultStance ?? DEFAULT_SETTINGS.defaultStance;

export const selectHapticFeedback = (state: { settings: Settings | null }) => 
  state.settings?.hapticFeedback ?? DEFAULT_SETTINGS.hapticFeedback;

export const selectNotifications = (state: { settings: Settings | null }) => 
  state.settings?.notifications ?? DEFAULT_SETTINGS.notifications;

// ─────────────────────────────────────────────────────────────────────────────────
// RE-EXPORT TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type { Settings, SettingsUpdate, Theme, DefaultStance, NotificationSettings };
