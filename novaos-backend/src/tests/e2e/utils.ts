// ═══════════════════════════════════════════════════════════════════════════════
// E2E TEST UTILITIES — Setup and Helpers for End-to-End Tests
// ═══════════════════════════════════════════════════════════════════════════════

import type { Express } from 'express';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface TestUser {
  userId: string;
  email: string;
  token: string;
  apiKey: string;
  tier: 'free' | 'pro' | 'enterprise';
}

export interface TestContext {
  baseUrl: string;
  users: Map<string, TestUser>;
  conversationIds: string[];
  goalIds: string[];
  cleanup: () => Promise<void>;
}

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  token?: string;
  apiKey?: string;
}

export interface TestResponse<T = unknown> {
  status: number;
  headers: Headers;
  data: T;
  latencyMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// TEST SERVER
// ─────────────────────────────────────────────────────────────────────────────────

let testServer: { close: () => void } | null = null;
let testPort = 0;

/**
 * Start test server on random available port
 */
export async function startTestServer(app: Express): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      testServer = app.listen(0, () => {
        const address = (testServer as any).address();
        testPort = address.port;
        resolve(`http://localhost:${testPort}`);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Stop test server
 */
export async function stopTestServer(): Promise<void> {
  return new Promise((resolve) => {
    if (testServer) {
      testServer.close();
      testServer = null;
    }
    resolve();
  });
}

// ─────────────────────────────────────────────────────────────────────────────────
// HTTP CLIENT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Make HTTP request with timing
 */
export async function request<T = unknown>(
  url: string,
  options: RequestOptions = {}
): Promise<TestResponse<T>> {
  const startTime = performance.now();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  } else if (options.apiKey) {
    headers['X-API-Key'] = options.apiKey;
  }
  
  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  
  const latencyMs = performance.now() - startTime;
  const data = await response.json() as T;
  
  return {
    status: response.status,
    headers: response.headers,
    data,
    latencyMs,
  };
}

/**
 * Create authenticated request helper
 */
export function createAuthenticatedClient(baseUrl: string, user: TestUser) {
  return {
    get: <T = unknown>(path: string) => 
      request<T>(`${baseUrl}${path}`, { token: user.token }),
    
    post: <T = unknown>(path: string, body?: unknown) =>
      request<T>(`${baseUrl}${path}`, { method: 'POST', token: user.token, body }),
    
    patch: <T = unknown>(path: string, body?: unknown) =>
      request<T>(`${baseUrl}${path}`, { method: 'PATCH', token: user.token, body }),
    
    delete: <T = unknown>(path: string, body?: unknown) =>
      request<T>(`${baseUrl}${path}`, { method: 'DELETE', token: user.token, body }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// USER MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a test user
 */
export async function createTestUser(
  baseUrl: string,
  email: string,
  tier: 'free' | 'pro' | 'enterprise' = 'free'
): Promise<TestUser> {
  const response = await request<{
    userId: string;
    token: string;
    apiKey: string;
    tier: string;
  }>(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    body: { email, tier },
  });
  
  if (response.status !== 200) {
    throw new Error(`Failed to create test user: ${JSON.stringify(response.data)}`);
  }
  
  return {
    userId: response.data.userId,
    email,
    token: response.data.token,
    apiKey: response.data.apiKey,
    tier,
  };
}

/**
 * Create multiple test users
 */
export async function createTestUsers(
  baseUrl: string,
  count: number,
  tierDistribution?: { free?: number; pro?: number; enterprise?: number }
): Promise<TestUser[]> {
  const users: TestUser[] = [];
  const distribution = tierDistribution ?? { free: count };
  
  let userIndex = 0;
  
  for (const [tier, tierCount] of Object.entries(distribution)) {
    for (let i = 0; i < (tierCount ?? 0); i++) {
      const user = await createTestUser(
        baseUrl,
        `test${userIndex}@example.com`,
        tier as 'free' | 'pro' | 'enterprise'
      );
      users.push(user);
      userIndex++;
    }
  }
  
  return users;
}

// ─────────────────────────────────────────────────────────────────────────────────
// TEST CONTEXT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create test context with cleanup
 */
export async function createTestContext(baseUrl: string): Promise<TestContext> {
  const users = new Map<string, TestUser>();
  const conversationIds: string[] = [];
  const goalIds: string[] = [];
  
  return {
    baseUrl,
    users,
    conversationIds,
    goalIds,
    cleanup: async () => {
      // Clean up created resources
      for (const [_, user] of users) {
        try {
          const client = createAuthenticatedClient(baseUrl, user);
          
          // Delete conversations
          for (const convId of conversationIds) {
            await client.delete(`/api/v1/conversations/${convId}`);
          }
          
          // Clear memories
          await client.delete('/api/v1/memories');
        } catch (error) {
          // Ignore cleanup errors
        }
      }
      
      users.clear();
      conversationIds.length = 0;
      goalIds.length = 0;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// ASSERTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Assert response status
 */
export function assertStatus(response: TestResponse, expected: number): void {
  if (response.status !== expected) {
    throw new Error(
      `Expected status ${expected}, got ${response.status}: ${JSON.stringify(response.data)}`
    );
  }
}

/**
 * Assert response time under threshold
 */
export function assertLatency(response: TestResponse, maxMs: number): void {
  if (response.latencyMs > maxMs) {
    throw new Error(
      `Expected latency < ${maxMs}ms, got ${response.latencyMs.toFixed(2)}ms`
    );
  }
}

/**
 * Assert property exists and optionally matches
 */
export function assertProperty<T>(
  data: T,
  path: string,
  expected?: unknown
): void {
  const parts = path.split('.');
  let value: unknown = data;
  
  for (const part of parts) {
    if (value === null || value === undefined || typeof value !== 'object') {
      throw new Error(`Property ${path} not found at ${part}`);
    }
    value = (value as Record<string, unknown>)[part];
  }
  
  if (expected !== undefined && value !== expected) {
    throw new Error(`Expected ${path} to be ${expected}, got ${value}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// TIMING UTILITIES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Wait for specified milliseconds
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry until condition is met or timeout
 */
export async function waitUntil(
  condition: () => Promise<boolean>,
  options: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<void> {
  const { timeoutMs = 10000, intervalMs = 100 } = options;
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return;
    }
    await wait(intervalMs);
  }
  
  throw new Error(`Condition not met within ${timeoutMs}ms`);
}

/**
 * Measure execution time
 */
export async function measure<T>(
  fn: () => Promise<T>
): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  const result = await fn();
  const durationMs = performance.now() - start;
  return { result, durationMs };
}

// ─────────────────────────────────────────────────────────────────────────────────
// DATA GENERATORS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generate random string
 */
export function randomString(length: number = 8): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

/**
 * Generate random email
 */
export function randomEmail(): string {
  return `test_${randomString()}@example.com`;
}

/**
 * Generate sample goal
 */
export function sampleGoal(overrides: Record<string, unknown> = {}) {
  return {
    title: `Test Goal ${randomString()}`,
    description: 'A test goal for E2E testing',
    desiredOutcome: 'Successfully complete E2E tests',
    interestLevel: 'career_capital',
    ...overrides,
  };
}

/**
 * Generate sample memory
 */
export function sampleMemory(overrides: Record<string, unknown> = {}) {
  return {
    category: 'fact',
    key: `test_key_${randomString()}`,
    value: `Test value ${randomString()}`,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// METRICS COLLECTION
// ─────────────────────────────────────────────────────────────────────────────────

export interface TestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  latencies: number[];
  errors: Array<{ endpoint: string; error: string }>;
}

/**
 * Create metrics collector
 */
export function createMetricsCollector(): TestMetrics & {
  record: (endpoint: string, latencyMs: number, success: boolean, error?: string) => void;
  summary: () => {
    avgLatencyMs: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    successRate: number;
  };
} {
  const metrics: TestMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    latencies: [],
    errors: [],
  };
  
  return {
    ...metrics,
    record(endpoint: string, latencyMs: number, success: boolean, error?: string) {
      metrics.totalRequests++;
      metrics.latencies.push(latencyMs);
      
      if (success) {
        metrics.successfulRequests++;
      } else {
        metrics.failedRequests++;
        if (error) {
          metrics.errors.push({ endpoint, error });
        }
      }
    },
    summary() {
      const sorted = [...metrics.latencies].sort((a, b) => a - b);
      const len = sorted.length;
      
      return {
        avgLatencyMs: len > 0 ? sorted.reduce((a, b) => a + b, 0) / len : 0,
        p50LatencyMs: len > 0 ? sorted[Math.floor(len * 0.5)]! : 0,
        p95LatencyMs: len > 0 ? sorted[Math.floor(len * 0.95)]! : 0,
        p99LatencyMs: len > 0 ? sorted[Math.floor(len * 0.99)]! : 0,
        successRate: metrics.totalRequests > 0 
          ? metrics.successfulRequests / metrics.totalRequests 
          : 0,
      };
    },
  };
}
