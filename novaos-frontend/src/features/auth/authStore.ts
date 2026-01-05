// ═══════════════════════════════════════════════════════════════════════════════
// AUTH FEATURE — Zustand Store
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { register, verify } from './authApi';
import { setStoredToken, clearStoredToken, getStoredToken } from '../../shared/api/client';
import type { User } from '../../shared/types';

// ─────────────────────────────────────────────────────────────────────────────────
// STATE INTERFACE
// ─────────────────────────────────────────────────────────────────────────────────

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: () => Promise<void>;
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
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await register();
          setStoredToken(response.token);
          set({
            user: { id: response.userId, createdAt: new Date().toISOString() },
            token: response.token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Login failed',
            isLoading: false,
          });
        }
      },

      logout: () => {
        clearStoredToken();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        });
      },

      checkAuth: async () => {
        const token = getStoredToken();
        if (!token) {
          // Auto-register if no token
          await get().login();
          return;
        }

        set({ isLoading: true });
        try {
          const response = await verify();
          if (response.valid) {
            set({
              user: { id: response.userId, createdAt: '' },
              token,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            // Token invalid, re-register
            await get().login();
          }
        } catch {
          // Token verification failed, re-register
          await get().login();
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'novaos-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
