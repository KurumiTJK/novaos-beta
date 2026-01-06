// ═══════════════════════════════════════════════════════════════════════════════
// APP — Root Component
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { useAuthStore, useUIStore } from '@/shared/stores';
import { TabBar } from '@/shared/components';
import { HomePage } from '@/features/home';
import { ChatPage } from '@/features/chat';
import { ModulesPage, ModuleDetailPage } from '@/features/modules';
import { SkillsPage } from '@/features/skills';
import { SettingsPage } from '@/features/settings';

export function App() {
  const { initialize, isLoading, error } = useAuthStore();
  const { activeTab, isChatOpen, activeModule } = useUIStore();

  // Initialize auth on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/50">Connecting...</p>
        </div>
      </div>
    );
  }

  // Show error state (but still allow usage)
  if (error) {
    console.warn('Auth error:', error);
  }

  return (
    <div className="h-full max-w-[430px] mx-auto bg-black overflow-hidden" style={{ height: '100dvh' }}>
      {/* Main Tab Content */}
      <main className="h-full">
        {activeTab === 'home' && <HomePage />}
        {activeTab === 'modules' && <ModulesPage />}
        {activeTab === 'skills' && <SkillsPage />}
        {activeTab === 'settings' && <SettingsPage />}
      </main>

      {/* Tab Bar */}
      <TabBar />

      {/* Overlay Screens */}
      {isChatOpen && <ChatPage />}
      {activeModule && <ModuleDetailPage />}
    </div>
  );
}
