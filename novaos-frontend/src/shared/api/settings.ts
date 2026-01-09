// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS API — NovaOS
// ═══════════════════════════════════════════════════════════════════════════════

import { api } from './client';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type Theme = 'light' | 'dark' | 'system';
export type DefaultStance = 'control' | 'shield' | 'lens' | 'sword';

export interface NotificationSettings {
  sparkReminders: boolean;
  dailySummary: boolean;
  weeklyReport: boolean;
  achievements: boolean;
}

export interface Settings {
  id: string;
  userId: string;
  theme: Theme;
  defaultStance: DefaultStance;
  hapticFeedback: boolean;
  notifications: NotificationSettings;
  createdAt: string;
  updatedAt: string;
}

export interface SettingsUpdate {
  theme?: Theme;
  defaultStance?: DefaultStance;
  hapticFeedback?: boolean;
  notifications?: Partial<NotificationSettings>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// DEFAULTS
// ─────────────────────────────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS: Omit<Settings, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
  theme: 'dark',
  defaultStance: 'lens',
  hapticFeedback: true,
  notifications: {
    sparkReminders: true,
    dailySummary: false,
    weeklyReport: true,
    achievements: true,
  },
};

// ─────────────────────────────────────────────────────────────────────────────────
// API FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<Settings> {
  return api.get<Settings>('/settings');
}

export async function updateSettings(updates: SettingsUpdate): Promise<Settings> {
  return api.patch<Settings>('/settings', updates);
}

// ─────────────────────────────────────────────────────────────────────────────────
// THEME HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

export interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  accent: string;
}

export function getThemeColors(theme: Theme): ThemeColors {
  if (theme === 'light') {
    return {
      background: '#FFFFFF',
      surface: '#F5F5F5',
      text: '#000000',
      textSecondary: '#666666',
      border: '#E0E0E0',
      accent: '#8B5CF6',
    };
  }
  
  // Default to dark
  return {
    background: '#000000',
    surface: '#1C1C1E',
    text: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.5)',
    border: 'rgba(255,255,255,0.1)',
    accent: '#8B5CF6',
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// STANCE HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

export function getStanceColor(stance: DefaultStance | string): string {
  const colors: Record<string, string> = {
    control: '#ef4444', // red-500
    shield: '#3b82f6',  // blue-500
    lens: '#8b5cf6',    // purple-500
    sword: '#22c55e',   // green-500
  };
  return colors[stance] || '#6b7280';
}

export function getStanceLabel(stance: DefaultStance | string): string {
  const labels: Record<string, string> = {
    control: 'Control',
    shield: 'Shield',
    lens: 'Lens',
    sword: 'Sword',
  };
  return labels[stance] || 'Unknown';
}

export function getStanceIcon(stance: DefaultStance | string): string {
  const icons: Record<string, string> = {
    control: '🛑',
    shield: '🛡️',
    lens: '🔮',
    sword: '⚔️',
  };
  return icons[stance] || '✨';
}

export function getStanceDescription(stance: DefaultStance | string): string {
  const descriptions: Record<string, string> = {
    control: 'Safety & crisis mode',
    shield: 'Protection mode',
    lens: 'Clarity & analysis',
    sword: 'Forward motion',
  };
  return descriptions[stance] || 'AI Assistant';
}
