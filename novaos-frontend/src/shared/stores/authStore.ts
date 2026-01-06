// ═══════════════════════════════════════════════════════════════════════════════
// AUTH STORE — Novaux
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { getToken, setToken, clearToken } from '../api/client';
import { register, getAuthStatus } from '../api/auth';

interface AuthStore {
  token: string | null;
  userId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  initialize: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  token: getToken(),
  userId: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  initialize: async () => {
    const existingToken = getToken();
    
    // If we have a token, verify it
    if (existingToken) {
      try {
        const status = await getAuthStatus();
        if (status.authenticated) {
          set({
            token: existingToken,
            userId: status.userId || null,
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        }
      } catch {
        // Token invalid, clear it
        clearToken();
      }
    }

    // No valid token, auto-register
    try {
      const { token, userId } = await register();
      setToken(token);
      set({
        token,
        userId,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to authenticate',
      });
    }
  },

  logout: () => {
    clearToken();
    set({
      token: null,
      userId: null,
      isAuthenticated: false,
    });
  },
}));
