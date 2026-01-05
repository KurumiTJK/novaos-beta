// ═══════════════════════════════════════════════════════════════════════════════
// AUTH FEATURE — API Endpoints
// ═══════════════════════════════════════════════════════════════════════════════

import { api } from '../../shared/api/client';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface RegisterResponse {
  userId: string;
  token: string;
}

export interface VerifyResponse {
  valid: boolean;
  userId: string;
}

export interface AuthStatusResponse {
  authenticated: boolean;
  userId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────────

export async function register(): Promise<RegisterResponse> {
  return api.post<RegisterResponse>('/auth/register', {}, { requiresAuth: false });
}

export async function verify(): Promise<VerifyResponse> {
  return api.get<VerifyResponse>('/auth/verify');
}

export async function getAuthStatus(): Promise<AuthStatusResponse> {
  return api.get<AuthStatusResponse>('/auth/status');
}
