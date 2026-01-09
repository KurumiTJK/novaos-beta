// ═══════════════════════════════════════════════════════════════════════════════
// AUTH API — NovaOS
// ═══════════════════════════════════════════════════════════════════════════════

import { api, setTokens, clearToken, getRefreshToken } from './client';
import type { RegisterResponse, AuthStatusResponse } from '../types';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt?: string;
  refreshExpiresAt?: string;
}

export interface RefreshResponse {
  tokens: TokenPair;
}

// ─────────────────────────────────────────────────────────────────────────────────
// REGISTER — Get new token (auto-creates user)
// ─────────────────────────────────────────────────────────────────────────────────

export async function register(): Promise<RegisterResponse> {
  const response = await api.post<RegisterResponse>('/auth/register', {}, { 
    requiresAuth: false,
    skipIdempotency: true, // Registration should be idempotent by nature
  });
  
  // If response includes refresh token, store both
  if ('refreshToken' in response && response.refreshToken) {
    setTokens(response.token, response.refreshToken as string);
  }
  
  return response;
}

// ─────────────────────────────────────────────────────────────────────────────────
// AUTH STATUS — Check if token is valid
// ─────────────────────────────────────────────────────────────────────────────────

export async function getAuthStatus(): Promise<AuthStatusResponse> {
  return api.get<AuthStatusResponse>('/auth/status');
}

// ─────────────────────────────────────────────────────────────────────────────────
// VERIFY — Verify token (alternative to status)
// ─────────────────────────────────────────────────────────────────────────────────

export async function verifyToken(): Promise<{ valid: boolean; userId?: string }> {
  return api.get<{ valid: boolean; userId?: string }>('/auth/verify');
}

// ─────────────────────────────────────────────────────────────────────────────────
// REFRESH — Get new tokens using refresh token
// ─────────────────────────────────────────────────────────────────────────────────
// Note: This is typically called automatically by the client interceptor
// but exposed here for manual refresh if needed

export async function refreshTokens(): Promise<TokenPair | null> {
  const refreshToken = getRefreshToken();
  
  if (!refreshToken) {
    return null;
  }

  try {
    const response = await api.post<RefreshResponse>(
      '/auth/refresh', 
      { refreshToken },
      { requiresAuth: false, skipIdempotency: true }
    );
    
    if (response.tokens) {
      setTokens(response.tokens.accessToken, response.tokens.refreshToken);
      return response.tokens;
    }
    
    return null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// LOGOUT — Invalidate refresh token on server
// ─────────────────────────────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  
  try {
    if (refreshToken) {
      await api.post('/auth/logout', { refreshToken }, { skipIdempotency: true });
    }
  } catch (error) {
    // Log but don't throw — we still want to clear local tokens
    console.warn('[AUTH] Logout request failed:', error);
  } finally {
    // Always clear local tokens
    clearToken();
  }
}
