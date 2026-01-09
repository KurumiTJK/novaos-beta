// ═══════════════════════════════════════════════════════════════════════════════
// AUTH STORE — NovaOS
// With refresh token support and logout event handling
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  getToken, 
  setToken, 
  setTokens,
  clearToken, 
  onAuthLogout,
  getRefreshToken,
  ApiError,
} from '../api/client';
import { register, getAuthStatus, logout as logoutApi } from '../api/auth';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

interface AuthStore {
  // State
  token: string | null;
  refreshToken: string | null;
  userId: string | null;
  tier: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  initialize: () => Promise<void>;
  logout: () => Promise<void>;
  
  // Internal
  setAuth: (token: string, refreshToken: string | null, userId: string, tier?: string) => void;
  clearAuth: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      token: getToken(),
      refreshToken: getRefreshToken(),
      userId: null,
      tier: 'free',
      isAuthenticated: false,
      isLoading: true,
      error: null,

      // ─────────────────────────────────────────────────────────────────────────
      // INITIALIZE
      // ─────────────────────────────────────────────────────────────────────────
      // Called on app mount to verify existing token or register new user
      
      initialize: async () => {
        const existingToken = getToken();
        
        // If we have a token, verify it
        if (existingToken) {
          try {
            const status = await getAuthStatus();
            if (status.authenticated) {
              set({
                token: existingToken,
                refreshToken: getRefreshToken(),
                userId: status.userId || null,
                tier: status.tier || 'free',
                isAuthenticated: true,
                isLoading: false,
              });
              return;
            }
            // Status returned but not authenticated - clear and re-register
            console.log('[AUTH] Token not authenticated, will re-register');
            clearToken();
          } catch (error) {
            // FIXED: Only clear token on actual auth failures (401/403)
            // Don't clear on network errors or server errors - just use existing token
            if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
              console.log('[AUTH] Token rejected by server, clearing');
              clearToken();
            } else {
              // Network error or server error - keep the token and try to continue
              console.warn('[AUTH] Could not verify token (network/server error), keeping existing token:', error);
              set({
                token: existingToken,
                refreshToken: getRefreshToken(),
                userId: null, // We don't know the userId but keep the token
                tier: 'free',
                isAuthenticated: true, // Assume authenticated, will fail on actual API calls if not
                isLoading: false,
              });
              return;
            }
          }
        }

        // No valid token, auto-register
        try {
          const response = await register();
          
          // Handle both old format (token only) and new format (tokens object)
          const accessToken = response.token;
          const refreshToken = (response as any).refreshToken || null;
          
          if (refreshToken) {
            setTokens(accessToken, refreshToken);
          } else {
            setToken(accessToken);
          }
          
          set({
            token: accessToken,
            refreshToken: refreshToken,
            userId: response.userId,
            tier: 'free',
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

      // ─────────────────────────────────────────────────────────────────────────
      // LOGOUT
      // ─────────────────────────────────────────────────────────────────────────
      // Clears local state and invalidates refresh token on server
      
      logout: async () => {
        try {
          await logoutApi();
        } catch {
          // Ignore errors, still clear local state
        }
        
        get().clearAuth();
      },

      // ─────────────────────────────────────────────────────────────────────────
      // INTERNAL HELPERS
      // ─────────────────────────────────────────────────────────────────────────
      
      setAuth: (token, refreshToken, userId, tier = 'free') => {
        if (refreshToken) {
          setTokens(token, refreshToken);
        } else {
          setToken(token);
        }
        
        set({
          token,
          refreshToken,
          userId,
          tier,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      },
      
      clearAuth: () => {
        clearToken();
        set({
          token: null,
          refreshToken: null,
          userId: null,
          tier: 'free',
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      },
    }),
    {
      name: 'nova-auth',
      // Only persist these fields
      partialize: (state) => ({
        userId: state.userId,
        tier: state.tier,
      }),
    }
  )
);

// ─────────────────────────────────────────────────────────────────────────────────
// LOGOUT EVENT LISTENER
// ─────────────────────────────────────────────────────────────────────────────────
// Listen for forced logout events from the API client (e.g., token refresh failed)

if (typeof window !== 'undefined') {
  onAuthLogout((reason) => {
    console.log('[AUTH] Forced logout:', reason);
    useAuthStore.getState().clearAuth();
  });
}
