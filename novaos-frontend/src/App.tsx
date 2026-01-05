// ═══════════════════════════════════════════════════════════════════════════════
// APP — Main Application Component
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';

import { DashboardPage, ChatPage, ControlPage, SwordPage, ModulePage } from './pages';
import { useAuthStore, useAppStore, useChatStore } from './stores';

// ─────────────────────────────────────────────────────────────────────────────────
// QUERY CLIENT
// ─────────────────────────────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

// ─────────────────────────────────────────────────────────────────────────────────
// APP SHELL — iPhone-like frame for desktop viewing
// ─────────────────────────────────────────────────────────────────────────────────

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      {/* iPhone frame (only visible on larger screens) */}
      <div className="hidden md:block relative">
        {/* Phone frame */}
        <div className="w-[390px] h-[844px] bg-black rounded-[50px] p-3 shadow-2xl ring-1 ring-gray-800">
          {/* Dynamic Island */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[126px] h-[37px] bg-black rounded-full z-50" />
          
          {/* Screen */}
          <div className="w-full h-full bg-gray-950 rounded-[38px] overflow-hidden relative">
            {children}
          </div>
          
          {/* Home indicator */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-36 h-1 bg-white/30 rounded-full" />
        </div>
      </div>
      
      {/* Mobile view (full screen) */}
      <div className="md:hidden w-full h-screen bg-gray-950 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// APP INITIALIZER
// ─────────────────────────────────────────────────────────────────────────────────

function AppInitializer({ children }: { children: React.ReactNode }) {
  const { checkAuth, isAuthenticated } = useAuthStore();
  const { loadConversations } = useChatStore();
  const { theme } = useAppStore();

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Load conversations when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
    }
  }, [isAuthenticated, loadConversations]);

  // Apply theme
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return <>{children}</>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────────

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppInitializer>
          <AppShell>
            <AnimatePresence mode="wait">
              <Routes>
                {/* Main Routes */}
                <Route path="/" element={<DashboardPage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/chat/:conversationId" element={<ChatPage />} />
                
                {/* Special Modes */}
                <Route path="/control" element={<ControlPage />} />
                <Route path="/sword" element={<SwordPage />} />
                
                {/* Modules */}
                <Route path="/module/:moduleId" element={<ModulePage />} />
                
                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AnimatePresence>
          </AppShell>
        </AppInitializer>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
