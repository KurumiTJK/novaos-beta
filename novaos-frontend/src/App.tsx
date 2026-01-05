// ═══════════════════════════════════════════════════════════════════════════════
// APP — Root Component with Routing
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';

// Features
import { DashboardPage } from './features/dashboard';
import { ChatPage, useChatStore } from './features/chat';
import { ControlPage } from './features/control';
import { SwordPage } from './features/sword';
import { ModulePage } from './features/modules';
import { useAuthStore } from './features/auth';

// Styles
import './styles/index.css';

// ─────────────────────────────────────────────────────────────────────────────────
// QUERY CLIENT
// ─────────────────────────────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// ─────────────────────────────────────────────────────────────────────────────────
// APP SHELL (iPhone Frame for Desktop)
// ─────────────────────────────────────────────────────────────────────────────────

function AppShell({ children }: { children: React.ReactNode }) {
  const isDesktop = window.matchMedia('(min-width: 768px)').matches;

  if (!isDesktop) {
    // Mobile: Full screen
    return <div className="h-screen w-screen bg-gray-950">{children}</div>;
  }

  // Desktop: iPhone frame
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-8">
      <div className="relative">
        {/* iPhone Frame */}
        <div className="w-[390px] h-[844px] bg-gray-950 rounded-[50px] overflow-hidden border-[8px] border-gray-800 shadow-2xl">
          {/* Dynamic Island */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[120px] h-[35px] bg-black rounded-full z-50" />

          {/* Content */}
          <div className="h-full overflow-hidden">
            {children}
          </div>
        </div>

        {/* Device Label */}
        <p className="text-center text-gray-600 text-xs mt-4">
          NovaOS Preview • iPhone 14 Pro
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// ANIMATED ROUTES
// ─────────────────────────────────────────────────────────────────────────────────

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <PageTransition>
              <DashboardPage />
            </PageTransition>
          }
        />
        <Route
          path="/chat"
          element={
            <PageTransition>
              <ChatPage />
            </PageTransition>
          }
        />
        <Route
          path="/chat/:conversationId"
          element={
            <PageTransition>
              <ChatPage />
            </PageTransition>
          }
        />
        <Route
          path="/control"
          element={
            <PageTransition>
              <ControlPage />
            </PageTransition>
          }
        />
        <Route
          path="/sword"
          element={
            <PageTransition>
              <SwordPage />
            </PageTransition>
          }
        />
        <Route
          path="/module/:moduleId"
          element={
            <PageTransition>
              <ModulePage />
            </PageTransition>
          }
        />
      </Routes>
    </AnimatePresence>
  );
}

function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.2 }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// APP INITIALIZER
// ─────────────────────────────────────────────────────────────────────────────────

function AppInitializer({ children }: { children: React.ReactNode }) {
  const { checkAuth, isAuthenticated } = useAuthStore();
  const { loadConversations } = useChatStore();

  useEffect(() => {
    // Check auth on mount
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    // Load conversations when authenticated
    if (isAuthenticated) {
      loadConversations();
    }
  }, [isAuthenticated, loadConversations]);

  useEffect(() => {
    // Apply theme
    document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';
  }, []);

  return <>{children}</>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppInitializer>
          <AppShell>
            <AnimatedRoutes />
          </AppShell>
        </AppInitializer>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
