// ═══════════════════════════════════════════════════════════════════════════════
// AUTH API — Authentication Endpoints
// ═══════════════════════════════════════════════════════════════════════════════

import { apiClient, setStoredToken, clearStoredToken } from './client';
import type { RegisterResponse, AuthStatusResponse, VerifyResponse, UserTier } from '../types';

// ─────────────────────────────────────────────────────────────────────────────────
// AUTH API
// ─────────────────────────────────────────────────────────────────────────────────

export const authApi = {
  /**
   * Register a new user and get tokens.
   */
  async register(email: string, tier: UserTier = 'free'): Promise<RegisterResponse> {
    const response = await apiClient.post<RegisterResponse>('/auth/register', {
      email,
      tier,
    });
    
    // Store token automatically
    if (response.token) {
      setStoredToken(response.token);
    }
    
    return response;
  },

  /**
   * Verify the current token.
   */
  async verify(): Promise<VerifyResponse> {
    return apiClient.get<VerifyResponse>('/auth/verify');
  },

  /**
   * Get current auth status.
   */
  async getStatus(): Promise<AuthStatusResponse> {
    return apiClient.get<AuthStatusResponse>('/auth/status');
  },

  /**
   * Logout — clear stored token.
   */
  logout(): void {
    clearStoredToken();
  },
};

export default authApi;
