// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS PAGE — NovaOS
// User preferences and app configuration
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { useSettingsStore, type Theme, type DefaultStance } from '@/shared/stores/settingsStore';
import { useAuthStore } from '@/shared/stores';
import { SettingToggle } from './components/SettingToggle';
import { SettingSelect } from './components/SettingSelect';
import { SettingSection } from './components/SettingSection';

export function SettingsPage() {
  const {
    settings,
    isLoading,
    isSaving,
    error,
    isInitialized,
    fetchSettings,
    updateSetting,
    updateNotification,
    clearError,
  } = useSettingsStore();
  
  const { logout, userId, tier } = useAuthStore();

  // Fetch settings on mount
  useEffect(() => {
    if (!isInitialized) {
      fetchSettings();
    }
  }, [isInitialized, fetchSettings]);

  // Loading state
  if (isLoading && !isInitialized) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  const handleLogout = async () => {
    if (confirm('Are you sure you want to log out?')) {
      await logout();
      // App will handle redirect
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5">
        <h1 className="text-xl font-semibold text-white">Settings</h1>
        <p className="text-sm text-white/50 mt-1">Customize your Nova experience</p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-5 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={clearError} className="text-red-400/50 hover:text-red-400">
            ✕
          </button>
        </div>
      )}

      {/* Saving Indicator */}
      {isSaving && (
        <div className="mx-5 mt-4 p-2 bg-purple-500/10 border border-purple-500/20 rounded-xl">
          <p className="text-purple-400 text-xs text-center">Saving...</p>
        </div>
      )}

      <div className="px-5 py-4 space-y-6">
        {/* ─────────────────────────────────────────────────────────────────────── */}
        {/* APPEARANCE */}
        {/* ─────────────────────────────────────────────────────────────────────── */}
        <SettingSection title="Appearance" icon="🎨">
          <SettingSelect<Theme>
            label="Theme"
            description="Choose your preferred color scheme"
            value={settings?.theme ?? 'dark'}
            options={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
              { value: 'system', label: 'System' },
            ]}
            onChange={(value) => updateSetting('theme', value)}
          />
        </SettingSection>

        {/* ─────────────────────────────────────────────────────────────────────── */}
        {/* NOVA BEHAVIOR */}
        {/* ─────────────────────────────────────────────────────────────────────── */}
        <SettingSection title="Nova Behavior" icon="🤖">
          <SettingSelect<DefaultStance>
            label="Default Stance"
            description="Nova's default mode when starting a conversation"
            value={settings?.defaultStance ?? 'lens'}
            options={[
              { value: 'lens', label: '🔮 Lens — Clarity & analysis' },
              { value: 'sword', label: '⚔️ Sword — Forward motion' },
              { value: 'shield', label: '🛡️ Shield — Protection' },
              { value: 'control', label: '🛑 Control — Safety first' },
            ]}
            onChange={(value) => updateSetting('defaultStance', value)}
          />
        </SettingSection>

        {/* ─────────────────────────────────────────────────────────────────────── */}
        {/* FEEDBACK */}
        {/* ─────────────────────────────────────────────────────────────────────── */}
        <SettingSection title="Feedback" icon="📳">
          <SettingToggle
            label="Haptic Feedback"
            description="Vibrate on button presses and actions"
            value={settings?.hapticFeedback ?? true}
            onChange={(value) => updateSetting('hapticFeedback', value)}
          />
        </SettingSection>

        {/* ─────────────────────────────────────────────────────────────────────── */}
        {/* NOTIFICATIONS */}
        {/* ─────────────────────────────────────────────────────────────────────── */}
        <SettingSection title="Notifications" icon="🔔">
          <SettingToggle
            label="Spark Reminders"
            description="Daily reminders to complete your sparks"
            value={settings?.notifications?.sparkReminders ?? true}
            onChange={(value) => updateNotification('sparkReminders', value)}
          />
          
          <SettingToggle
            label="Daily Summary"
            description="Receive a summary of your day"
            value={settings?.notifications?.dailySummary ?? false}
            onChange={(value) => updateNotification('dailySummary', value)}
          />
          
          <SettingToggle
            label="Weekly Report"
            description="Weekly progress and insights"
            value={settings?.notifications?.weeklyReport ?? true}
            onChange={(value) => updateNotification('weeklyReport', value)}
          />
          
          <SettingToggle
            label="Achievements"
            description="Celebrate milestones and streaks"
            value={settings?.notifications?.achievements ?? true}
            onChange={(value) => updateNotification('achievements', value)}
          />
        </SettingSection>

        {/* ─────────────────────────────────────────────────────────────────────── */}
        {/* ACCOUNT */}
        {/* ─────────────────────────────────────────────────────────────────────── */}
        <SettingSection title="Account" icon="👤">
          {/* User Info */}
          <div className="bg-[#1C1C1E] rounded-xl p-4 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/50 text-xs">User ID</p>
                <p className="text-white text-sm font-mono">
                  {userId ? `${userId.slice(0, 8)}...` : 'Unknown'}
                </p>
              </div>
              <div className="px-3 py-1 bg-purple-500/20 rounded-full">
                <span className="text-purple-400 text-xs font-medium capitalize">
                  {tier || 'Free'}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button
              className="w-full flex items-center justify-between p-4 bg-[#1C1C1E] rounded-xl active:bg-[#2C2C2E] transition-colors"
              onClick={() => {/* TODO: Export data */}}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">📤</span>
                <span className="text-white">Export My Data</span>
              </div>
              <span className="text-white/30">→</span>
            </button>
            
            <button
              className="w-full flex items-center justify-between p-4 bg-[#1C1C1E] rounded-xl active:bg-[#2C2C2E] transition-colors"
              onClick={() => {/* TODO: Delete account */}}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">🗑️</span>
                <span className="text-red-400">Delete Account</span>
              </div>
              <span className="text-white/30">→</span>
            </button>
          </div>
        </SettingSection>

        {/* ─────────────────────────────────────────────────────────────────────── */}
        {/* LOGOUT */}
        {/* ─────────────────────────────────────────────────────────────────────── */}
        <button
          onClick={handleLogout}
          className="w-full py-4 bg-white/5 text-white/70 font-medium rounded-xl active:bg-white/10 transition-colors"
        >
          Log Out
        </button>

        {/* ─────────────────────────────────────────────────────────────────────── */}
        {/* FOOTER */}
        {/* ─────────────────────────────────────────────────────────────────────── */}
        <div className="text-center py-4">
          <p className="text-white/20 text-xs">NovaOS v1.0.0</p>
          <p className="text-white/20 text-xs mt-1">Made with ❤️ for you</p>
        </div>
      </div>
    </div>
  );
}
