// ═══════════════════════════════════════════════════════════════════════════════
// AUTH API — Novaux
// ═══════════════════════════════════════════════════════════════════════════════

import { api } from './client';
import type { RegisterResponse, AuthStatusResponse } from '../types';

export async function register(): Promise<RegisterResponse> {
  return api.post<RegisterResponse>('/auth/register', {}, { requiresAuth: false });
}

export async function getAuthStatus(): Promise<AuthStatusResponse> {
  return api.get<AuthStatusResponse>('/auth/status');
}
