// ═══════════════════════════════════════════════════════════════════════════════
// AUTH STORE — Authentication State Management
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '../api';
import { getStoredToken, clearStoredToken } from '../api/client';
import type { UserTier } from '../types';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

interface User {
  userId: string;
  email?: string;
  tier: UserTier;
  role?: string;
}

interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, tier?: UserTier) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Login with email
      login: async (email: string, tier: UserTier = 'free') => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await authApi.register(email, tier);
          
          set({
            user: {
              userId: response.userId,
              email,
              tier: response.tier,
            },
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: (error as Error).message || 'Login failed',
            isLoading: false,
          });
        }
      },

      // Logout
      logout: () => {
        authApi.logout();
        clearStoredToken();
        set({
          user: null,
          isAuthenticated: false,
          error: null,
        });
      },

      // Check if currently authenticated
      checkAuth: async () => {
        const token = getStoredToken();
        
        if (!token) {
          set({ isAuthenticated: false, user: null });
          return;
        }

        set({ isLoading: true });
        
        try {
          const response = await authApi.verify();
          
          if (response.valid) {
            set({
              user: {
                userId: response.user.userId,
                tier: response.user.tier,
                role: response.user.role,
              },
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            get().logout();
          }
        } catch {
          // Token invalid or expired
          get().logout();
          set({ isLoading: false });
        }
      },

      // Clear error
      clearError: () => set({ error: null }),
    }),
    {
      name: 'novaos-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;
