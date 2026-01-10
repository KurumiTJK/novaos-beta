// ═══════════════════════════════════════════════════════════════════════════════
// API CLIENT — NovaOS
// With token refresh interceptor, idempotency keys, and SSE streaming
// ═══════════════════════════════════════════════════════════════════════════════

const API_BASE = '/api/v1';

// ─────────────────────────────────────────────────────────────────────────────────
// TOKEN STORAGE
// ─────────────────────────────────────────────────────────────────────────────────

const TOKEN_KEY = 'novaux_token';
const REFRESH_TOKEN_KEY = 'novaux_refresh_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  setToken(accessToken);
  setRefreshToken(refreshToken);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
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
  /** Skip idempotency key generation for this request */
  skipIdempotency?: boolean;
  /** Custom idempotency key (otherwise auto-generated) */
  idempotencyKey?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// IDEMPOTENCY KEY GENERATION
// ─────────────────────────────────────────────────────────────────────────────────

function generateIdempotencyKey(): string {
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

// ─────────────────────────────────────────────────────────────────────────────────
// TOKEN REFRESH STATE
// ─────────────────────────────────────────────────────────────────────────────────

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;
let refreshSubscribers: Array<(success: boolean) => void> = [];

function subscribeToRefresh(callback: (success: boolean) => void): void {
  refreshSubscribers.push(callback);
}

function notifyRefreshSubscribers(success: boolean): void {
  refreshSubscribers.forEach(callback => callback(success));
  refreshSubscribers = [];
}

// ─────────────────────────────────────────────────────────────────────────────────
// TOKEN REFRESH LOGIC
// ─────────────────────────────────────────────────────────────────────────────────

async function refreshTokens(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  
  if (!refreshToken) {
    console.warn('[API] No refresh token available');
    return false;
  }

  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Send cookies with refresh request too
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      console.warn('[API] Token refresh failed:', response.status);
      return false;
    }

    const data = await response.json();
    
    if (data.success && data.data?.tokens) {
      const { accessToken, refreshToken: newRefreshToken } = data.data.tokens;
      setTokens(accessToken, newRefreshToken);
      console.log('[API] Tokens refreshed successfully');
      return true;
    }

    return false;
  } catch (error) {
    console.error('[API] Token refresh error:', error);
    return false;
  }
}

async function handleTokenRefresh(): Promise<boolean> {
  // If already refreshing, wait for the existing refresh to complete
  if (isRefreshing && refreshPromise) {
    return new Promise(resolve => subscribeToRefresh(resolve));
  }

  isRefreshing = true;
  refreshPromise = refreshTokens();

  try {
    const success = await refreshPromise;
    notifyRefreshSubscribers(success);
    return success;
  } finally {
    isRefreshing = false;
    refreshPromise = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// CORE REQUEST FUNCTION
// ─────────────────────────────────────────────────────────────────────────────────

async function request<T>(
  method: string,
  endpoint: string,
  body?: unknown,
  options: RequestOptions = {},
  isRetry = false
): Promise<T> {
  const { requiresAuth = true, skipIdempotency = false, idempotencyKey } = options;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add auth header
  if (requiresAuth) {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  // Add idempotency key for mutating requests
  if (!skipIdempotency && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    headers['Idempotency-Key'] = idempotencyKey || generateIdempotencyKey();
  }

  const config: RequestInit = {
    method,
    headers,
    credentials: 'include', // CRITICAL: Send cookies with requests (for Authentik session)
  };

  if (body && method !== 'GET') {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config);

  // ─────────────────────────────────────────────────────────────────────────────
  // HANDLE 401 — Token expired, attempt refresh
  // ─────────────────────────────────────────────────────────────────────────────
  if (response.status === 401 && requiresAuth && !isRetry) {
    console.log('[API] 401 received, attempting token refresh...');
    
    const refreshSuccess = await handleTokenRefresh();
    
    if (refreshSuccess) {
      // Retry the original request with new token
      return request<T>(method, endpoint, body, options, true);
    } else {
      // Refresh failed — clear tokens and redirect to login
      clearToken();
      // Dispatch event for auth store to handle
      window.dispatchEvent(new CustomEvent('auth:logout', { detail: { reason: 'token_refresh_failed' } }));
      throw new ApiError('Session expired. Please log in again.', 401, 'AUTH_TOKEN_EXPIRED');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HANDLE OTHER ERRORS
  // ─────────────────────────────────────────────────────────────────────────────
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(
      error.error?.message || error.error || 'Request failed',
      response.status,
      error.error?.code || error.code
    );
  }

  // Handle empty responses
  const text = await response.text();
  if (!text) return {} as T;
  
  const data = JSON.parse(text);
  
  // Unwrap { success: true, data: ... } format
  if (data.success !== undefined && data.data !== undefined) {
    return data.data as T;
  }
  
  return data as T;
}

// ─────────────────────────────────────────────────────────────────────────────────
// SSE STREAMING TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface StreamEvent {
  type: 'meta' | 'token' | 'done' | 'error' | 'thinking';
  text?: string;
  conversationId?: string;
  stance?: string;
  tokensUsed?: number;
  model?: string;
  isNewConversation?: boolean;
  provider?: string;
  error?: string;
  code?: string;
}

export interface StreamCallbacks {
  onToken: (text: string) => void;
  onDone: (data: { conversationId: string; stance?: string; tokensUsed: number; isNewConversation: boolean }) => void;
  onError: (error: string) => void;
  onMeta?: (data: { provider: string; conversationId: string; isNewConversation: boolean }) => void;
  onThinking?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────────
// SSE STREAMING FUNCTION
// ─────────────────────────────────────────────────────────────────────────────────

export async function streamRequest(
  endpoint: string,
  body: unknown,
  callbacks: StreamCallbacks
): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Add idempotency key
  headers['Idempotency-Key'] = generateIdempotencyKey();

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(body),
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CHECK FOR NON-STREAMING RESPONSE (shield block, redirect, etc.)
  // ─────────────────────────────────────────────────────────────────────────────
  const contentType = response.headers.get('content-type');
  
  if (contentType?.includes('application/json')) {
    // Server returned JSON instead of SSE - handle special cases
    const data = await response.json();
    
    // Return the JSON data for the caller to handle
    throw { isJsonResponse: true, data };
  }

  if (!response.ok) {
    throw new ApiError('Stream request failed', response.status);
  }

  if (!response.body) {
    throw new ApiError('No response body', 500);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PROCESS SSE STREAM
  // ─────────────────────────────────────────────────────────────────────────────
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      // Process complete events in buffer
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      let currentData = '';
      
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          // Event type line - we use parsed.type from JSON data instead
          continue;
        } else if (line.startsWith('data: ')) {
          currentData = line.slice(6);
          
          // Process event
          if (currentData) {
            try {
              const parsed: StreamEvent = JSON.parse(currentData);
              
              switch (parsed.type) {
                case 'meta':
                  callbacks.onMeta?.({
                    provider: parsed.provider!,
                    conversationId: parsed.conversationId!,
                    isNewConversation: parsed.isNewConversation!,
                  });
                  break;
                
                case 'thinking':
                  // Server is processing (high-risk path)
                  // Frontend can show a different indicator
                  callbacks.onThinking?.();
                  break;
                  
                case 'token':
                  callbacks.onToken(parsed.text || '');
                  break;
                  
                case 'done':
                  callbacks.onDone({
                    conversationId: parsed.conversationId!,
                    stance: parsed.stance,
                    tokensUsed: parsed.tokensUsed || 0,
                    isNewConversation: parsed.isNewConversation!,
                  });
                  break;
                  
                case 'error':
                  callbacks.onError(parsed.error || 'Unknown error');
                  break;
              }
            } catch (e) {
              console.warn('[STREAM] Failed to parse event:', currentData);
            }
          }
          
          currentData = '';
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
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
    
  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) => 
    request<T>('PUT', endpoint, body, options),
    
  delete: <T>(endpoint: string, options?: RequestOptions) => 
    request<T>('DELETE', endpoint, undefined, options),
    
  stream: streamRequest,
};

// ─────────────────────────────────────────────────────────────────────────────────
// AUTH LOGOUT LISTENER
// ─────────────────────────────────────────────────────────────────────────────────
// Components can listen for this event to handle forced logout

export function onAuthLogout(callback: (reason: string) => void): () => void {
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<{ reason: string }>;
    callback(customEvent.detail.reason);
  };
  
  window.addEventListener('auth:logout', handler);
  
  // Return unsubscribe function
  return () => window.removeEventListener('auth:logout', handler);
}
