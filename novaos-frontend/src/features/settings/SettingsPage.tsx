// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS PAGE
// ═══════════════════════════════════════════════════════════════════════════════

import { useAuthStore } from '@/shared/stores';
import { ChevronRightIcon } from '@/shared/components';

export function SettingsPage() {
  const { userId, isAuthenticated } = useAuthStore();

  return (
    <div 
      className="flex flex-col h-full pb-[calc(70px+env(safe-area-inset-bottom))]"
      style={{ paddingTop: 'calc(24px + env(safe-area-inset-top))' }}
    >
      <header className="px-5 pb-4">
        <h1 className="text-[34px] font-light tracking-tight">Settings</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-5">
        {/* Account Section */}
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
            Account
          </h2>
          <div className="bg-nova-dark rounded-2xl overflow-hidden">
            <div className="p-4 flex items-center justify-between border-b border-white/5">
              <span className="text-white">Status</span>
              <span className="text-white/50">
                {isAuthenticated ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="p-4 flex items-center justify-between">
              <span className="text-white">User ID</span>
              <span className="text-white/50 text-sm font-mono">
                {userId ? `${userId.slice(0, 8)}...` : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Preferences Section */}
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
            Preferences
          </h2>
          <div className="bg-nova-dark rounded-2xl overflow-hidden">
            <button className="w-full p-4 flex items-center justify-between border-b border-white/5 active:bg-white/5">
              <span className="text-white">Notifications</span>
              <ChevronRightIcon size={20} className="text-white/30" />
            </button>
            <button className="w-full p-4 flex items-center justify-between border-b border-white/5 active:bg-white/5">
              <span className="text-white">Appearance</span>
              <ChevronRightIcon size={20} className="text-white/30" />
            </button>
            <button className="w-full p-4 flex items-center justify-between active:bg-white/5">
              <span className="text-white">Privacy</span>
              <ChevronRightIcon size={20} className="text-white/30" />
            </button>
          </div>
        </div>

        {/* About Section */}
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
            About
          </h2>
          <div className="bg-nova-dark rounded-2xl overflow-hidden">
            <div className="p-4 flex items-center justify-between border-b border-white/5">
              <span className="text-white">Version</span>
              <span className="text-white/50">1.0.0</span>
            </div>
            <button className="w-full p-4 flex items-center justify-between active:bg-white/5">
              <span className="text-white">Terms of Service</span>
              <ChevronRightIcon size={20} className="text-white/30" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
