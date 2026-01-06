// ═══════════════════════════════════════════════════════════════════════════════
// API CLIENT — Novaux
// ═══════════════════════════════════════════════════════════════════════════════

const API_BASE = '/api/v1';

// ─────────────────────────────────────────────────────────────────────────────────
// TOKEN STORAGE
// ─────────────────────────────────────────────────────────────────────────────────

const TOKEN_KEY = 'novaux_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ─────────────────────────────────────────────────────────────────────────────────
// API ERROR
// ─────────────────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// REQUEST OPTIONS
// ─────────────────────────────────────────────────────────────────────────────────

interface RequestOptions {
  requiresAuth?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CORE REQUEST FUNCTION
// ─────────────────────────────────────────────────────────────────────────────────

async function request<T>(
  method: string,
  endpoint: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<T> {
  const { requiresAuth = true } = options;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (requiresAuth) {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const config: RequestInit = {
    method,
    headers,
  };

  if (body && method !== 'GET') {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(
      error.error || 'Request failed',
      response.status,
      error.code
    );
  }

  // Handle empty responses
  const text = await response.text();
  if (!text) return {} as T;
  
  return JSON.parse(text);
}

// ─────────────────────────────────────────────────────────────────────────────────
// API METHODS
// ─────────────────────────────────────────────────────────────────────────────────

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) => 
    request<T>('GET', endpoint, undefined, options),
    
  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) => 
    request<T>('POST', endpoint, body, options),
    
  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) => 
    request<T>('PATCH', endpoint, body, options),
    
  delete: <T>(endpoint: string, options?: RequestOptions) => 
    request<T>('DELETE', endpoint, undefined, options),
};
