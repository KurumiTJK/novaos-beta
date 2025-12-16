// ═══════════════════════════════════════════════════════════════════════════════
// SDK TESTS — NovaOS Client SDK Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  NovaClient,
  createNovaClient,
  NovaError,
  AuthenticationError,
  ValidationError,
  RateLimitError,
  TimeoutError,
  NetworkError,
  AckRequiredError,
  StoppedError,
  isNovaError,
  isRetryableError,
} from '../sdk/index.js';
import {
  withRetry,
  calculateDelay,
  sleep,
  DEFAULT_RETRY_OPTIONS,
} from '../sdk/retry.js';
import {
  parseSSELine,
  parseSSEEvent,
} from '../sdk/streaming.js';
import {
  createChatManager,
  createGoalsManager,
  createSparkManager,
  NovaStore,
} from '../sdk/hooks.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK FETCH
// ─────────────────────────────────────────────────────────────────────────────────

function createMockFetch(responses: Map<string, { status: number; body: unknown }>) {
  return async (url: string | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = url.toString();
    const path = new URL(urlStr).pathname;
    
    const response = responses.get(path) ?? responses.get('default');
    
    if (!response) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// CLIENT TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('NovaClient', () => {
  describe('constructor', () => {
    it('should create client with valid config', () => {
      const client = createNovaClient({
        baseUrl: 'http://localhost:3000',
        apiKey: 'test-key',
      });
      
      expect(client).toBeInstanceOf(NovaClient);
      expect(client.getBaseUrl()).toBe('http://localhost:3000');
    });
    
    it('should throw if baseUrl is missing', () => {
      expect(() => {
        new NovaClient({ baseUrl: '' });
      }).toThrow('baseUrl is required');
    });
    
    it('should use default timeout and retries', () => {
      const client = createNovaClient({
        baseUrl: 'http://localhost:3000',
      });
      
      expect(client).toBeDefined();
    });
  });
  
  describe('authentication', () => {
    it('should set token', () => {
      const client = createNovaClient({
        baseUrl: 'http://localhost:3000',
      });
      
      client.setToken('test-token');
      expect(client.hasAuth()).toBe(true);
    });
    
    it('should set API key', () => {
      const client = createNovaClient({
        baseUrl: 'http://localhost:3000',
      });
      
      client.setApiKey('test-key');
      expect(client.hasAuth()).toBe(true);
    });
    
    it('should clear auth', () => {
      const client = createNovaClient({
        baseUrl: 'http://localhost:3000',
        apiKey: 'test-key',
      });
      
      expect(client.hasAuth()).toBe(true);
      client.clearAuth();
      expect(client.hasAuth()).toBe(false);
    });
    
    it('should prefer token over API key', () => {
      const client = createNovaClient({
        baseUrl: 'http://localhost:3000',
        apiKey: 'test-key',
      });
      
      client.setToken('test-token');
      expect(client.hasAuth()).toBe(true);
    });
  });
  
  describe('API calls', () => {
    it('should call health endpoint', async () => {
      const mockFetch = createMockFetch(new Map([
        ['/api/v1/health', {
          status: 200,
          body: {
            status: 'healthy',
            version: '10.0.0',
            timestamp: new Date().toISOString(),
            uptime: 1000,
            storage: 'redis',
            verification: 'enabled',
          },
        }],
      ]));
      
      const client = createNovaClient({
        baseUrl: 'http://localhost:3000',
        fetch: mockFetch,
      });
      
      const health = await client.getHealth();
      
      expect(health.status).toBe('healthy');
      expect(health.version).toBe('10.0.0');
    });
    
    it('should call chat endpoint', async () => {
      const mockFetch = createMockFetch(new Map([
        ['/api/v1/chat', {
          status: 200,
          body: {
            type: 'success',
            message: 'Hello! How can I help you?',
            conversationId: 'conv123',
            stance: 'lens',
            confidence: 'high',
          },
        }],
      ]));
      
      const client = createNovaClient({
        baseUrl: 'http://localhost:3000',
        apiKey: 'test-key',
        fetch: mockFetch,
      });
      
      const response = await client.chat({ message: 'Hello!' });
      
      expect(response.type).toBe('success');
      expect(response.message).toBe('Hello! How can I help you?');
      expect(response.conversationId).toBe('conv123');
    });
    
    it('should handle await_ack response', async () => {
      const mockFetch = createMockFetch(new Map([
        ['/api/v1/chat', {
          status: 200,
          body: {
            type: 'await_ack',
            message: 'This action requires confirmation',
            conversationId: 'conv123',
            ackRequired: {
              token: 'ack123',
              requiredText: 'I understand',
              expiresAt: new Date(Date.now() + 300000).toISOString(),
            },
          },
        }],
      ]));
      
      const client = createNovaClient({
        baseUrl: 'http://localhost:3000',
        apiKey: 'test-key',
        fetch: mockFetch,
      });
      
      await expect(client.chat({ message: 'Risky action' }))
        .rejects.toThrow(AckRequiredError);
    });
    
    it('should handle stopped response', async () => {
      const mockFetch = createMockFetch(new Map([
        ['/api/v1/chat', {
          status: 200,
          body: {
            type: 'stopped',
            message: 'Action blocked',
            conversationId: 'conv123',
            stoppedReason: 'Safety violation',
          },
        }],
      ]));
      
      const client = createNovaClient({
        baseUrl: 'http://localhost:3000',
        apiKey: 'test-key',
        fetch: mockFetch,
      });
      
      await expect(client.chat({ message: 'Bad action' }))
        .rejects.toThrow(StoppedError);
    });
    
    it('should list goals', async () => {
      const mockFetch = createMockFetch(new Map([
        ['/api/v1/goals', {
          status: 200,
          body: {
            goals: [
              {
                id: 'goal1',
                title: 'Learn TypeScript',
                status: 'active',
                progress: 50,
              },
            ],
          },
        }],
      ]));
      
      const client = createNovaClient({
        baseUrl: 'http://localhost:3000',
        apiKey: 'test-key',
        fetch: mockFetch,
      });
      
      const result = await client.listGoals();
      
      expect(result.goals).toHaveLength(1);
      expect(result.goals[0]!.title).toBe('Learn TypeScript');
    });
    
    it('should create goal', async () => {
      const mockFetch = createMockFetch(new Map([
        ['/api/v1/goals', {
          status: 201,
          body: {
            goal: {
              id: 'goal1',
              title: 'New Goal',
              description: 'Description',
              desiredOutcome: 'Success',
              status: 'active',
              progress: 0,
            },
          },
        }],
      ]));
      
      const client = createNovaClient({
        baseUrl: 'http://localhost:3000',
        apiKey: 'test-key',
        fetch: mockFetch,
      });
      
      const result = await client.createGoal({
        title: 'New Goal',
        description: 'Description',
        desiredOutcome: 'Success',
      });
      
      expect(result.goal.title).toBe('New Goal');
    });
  });
  
  describe('error handling', () => {
    it('should handle 401 error', async () => {
      const mockFetch = createMockFetch(new Map([
        ['/api/v1/chat', {
          status: 401,
          body: { error: 'Invalid token', code: 'UNAUTHORIZED' },
        }],
      ]));
      
      const client = createNovaClient({
        baseUrl: 'http://localhost:3000',
        fetch: mockFetch,
        retries: 0,
      });
      
      await expect(client.chat({ message: 'Hello' }))
        .rejects.toThrow(AuthenticationError);
    });
    
    it('should handle 400 error', async () => {
      const mockFetch = createMockFetch(new Map([
        ['/api/v1/chat', {
          status: 400,
          body: { error: 'Invalid request', code: 'VALIDATION_ERROR' },
        }],
      ]));
      
      const client = createNovaClient({
        baseUrl: 'http://localhost:3000',
        apiKey: 'test-key',
        fetch: mockFetch,
        retries: 0,
      });
      
      await expect(client.chat({ message: '' }))
        .rejects.toThrow(ValidationError);
    });
    
    it('should handle 429 error', async () => {
      const mockFetch = createMockFetch(new Map([
        ['/api/v1/chat', {
          status: 429,
          body: { error: 'Rate limit exceeded', code: 'RATE_LIMITED' },
        }],
      ]));
      
      const client = createNovaClient({
        baseUrl: 'http://localhost:3000',
        apiKey: 'test-key',
        fetch: mockFetch,
        retries: 0,
      });
      
      await expect(client.chat({ message: 'Hello' }))
        .rejects.toThrow(RateLimitError);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// ERROR TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Errors', () => {
  describe('NovaError', () => {
    it('should create error with all properties', () => {
      const error = new NovaError('Test error', 'TEST_CODE', 400, { key: 'value' });
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ key: 'value' });
    });
    
    it('should convert to JSON', () => {
      const error = new NovaError('Test error', 'TEST_CODE', 400);
      const json = error.toJSON();
      
      expect(json.message).toBe('Test error');
      expect(json.code).toBe('TEST_CODE');
      expect(json.statusCode).toBe(400);
    });
  });
  
  describe('isNovaError', () => {
    it('should return true for NovaError', () => {
      expect(isNovaError(new NovaError('test'))).toBe(true);
    });
    
    it('should return true for subclasses', () => {
      expect(isNovaError(new AuthenticationError())).toBe(true);
      expect(isNovaError(new ValidationError('test'))).toBe(true);
    });
    
    it('should return false for other errors', () => {
      expect(isNovaError(new Error('test'))).toBe(false);
      expect(isNovaError('error')).toBe(false);
      expect(isNovaError(null)).toBe(false);
    });
  });
  
  describe('isRetryableError', () => {
    it('should return true for TimeoutError', () => {
      expect(isRetryableError(new TimeoutError(5000))).toBe(true);
    });
    
    it('should return true for NetworkError', () => {
      expect(isRetryableError(new NetworkError())).toBe(true);
    });
    
    it('should return true for RateLimitError', () => {
      expect(isRetryableError(new RateLimitError())).toBe(true);
    });
    
    it('should return false for ValidationError', () => {
      expect(isRetryableError(new ValidationError('test'))).toBe(false);
    });
    
    it('should return false for AuthenticationError', () => {
      expect(isRetryableError(new AuthenticationError())).toBe(false);
    });
  });
  
  describe('AckRequiredError', () => {
    it('should store ack details', () => {
      const error = new AckRequiredError('token123', 'I understand', '2024-01-01T00:00:00Z');
      
      expect(error.ackToken).toBe('token123');
      expect(error.requiredText).toBe('I understand');
      expect(error.expiresAt).toBe('2024-01-01T00:00:00Z');
    });
  });
  
  describe('StoppedError', () => {
    it('should store reason', () => {
      const error = new StoppedError('Safety violation');
      
      expect(error.reason).toBe('Safety violation');
      expect(error.message).toContain('Safety violation');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// RETRY TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Retry', () => {
  describe('calculateDelay', () => {
    it('should calculate exponential delay', () => {
      const options = {
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2,
        jitter: false,
      };
      
      expect(calculateDelay(0, options)).toBe(1000);
      expect(calculateDelay(1, options)).toBe(2000);
      expect(calculateDelay(2, options)).toBe(4000);
      expect(calculateDelay(3, options)).toBe(8000);
    });
    
    it('should cap at max delay', () => {
      const options = {
        initialDelayMs: 1000,
        maxDelayMs: 5000,
        backoffMultiplier: 2,
        jitter: false,
      };
      
      expect(calculateDelay(10, options)).toBe(5000);
    });
    
    it('should add jitter when enabled', () => {
      const options = {
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2,
        jitter: true,
      };
      
      const delay = calculateDelay(0, options);
      // With jitter, delay should be between 750 and 1000
      expect(delay).toBeGreaterThanOrEqual(750);
      expect(delay).toBeLessThanOrEqual(1000);
    });
  });
  
  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        return 'success';
      };
      
      const result = await withRetry(fn, { maxRetries: 3 });
      
      expect(result).toBe('success');
      expect(attempts).toBe(1);
    });
    
    it('should retry on failure', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        if (attempts < 3) {
          throw new NetworkError('Connection failed');
        }
        return 'success';
      };
      
      const result = await withRetry(fn, { 
        maxRetries: 3,
        initialDelayMs: 10,
      });
      
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });
    
    it('should throw after max retries', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        throw new NetworkError('Always fails');
      };
      
      await expect(withRetry(fn, { 
        maxRetries: 2,
        initialDelayMs: 10,
      })).rejects.toThrow(NetworkError);
      
      expect(attempts).toBe(3); // Initial + 2 retries
    });
    
    it('should not retry non-retryable errors', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        throw new ValidationError('Invalid input');
      };
      
      await expect(withRetry(fn, { maxRetries: 3 }))
        .rejects.toThrow(ValidationError);
      
      expect(attempts).toBe(1);
    });
    
    it('should call onRetry callback', async () => {
      const retryAttempts: number[] = [];
      let attempts = 0;
      
      const fn = async () => {
        attempts++;
        if (attempts < 3) {
          throw new NetworkError('Connection failed');
        }
        return 'success';
      };
      
      await withRetry(fn, {
        maxRetries: 3,
        initialDelayMs: 10,
        onRetry: (attempt) => retryAttempts.push(attempt),
      });
      
      expect(retryAttempts).toEqual([1, 2]);
    });
  });
  
  describe('sleep', () => {
    it('should delay for specified time', async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeGreaterThanOrEqual(45);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// STREAMING TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Streaming', () => {
  describe('parseSSELine', () => {
    it('should parse data field', () => {
      const result = parseSSELine('data: hello world');
      
      expect(result).toEqual({ field: 'data', value: 'hello world' });
    });
    
    it('should handle field without space after colon', () => {
      const result = parseSSELine('data:hello');
      
      expect(result).toEqual({ field: 'data', value: 'hello' });
    });
    
    it('should ignore comments', () => {
      const result = parseSSELine(': this is a comment');
      
      expect(result).toBeNull();
    });
    
    it('should handle empty lines', () => {
      const result = parseSSELine('');
      
      expect(result).toBeNull();
    });
    
    it('should handle field with empty value', () => {
      const result = parseSSELine('data:');
      
      expect(result).toEqual({ field: 'data', value: '' });
    });
  });
  
  describe('parseSSEEvent', () => {
    it('should parse chunk event', () => {
      const result = parseSSEEvent('{"type":"chunk","data":"Hello"}');
      
      expect(result).toEqual({ type: 'chunk', data: 'Hello' });
    });
    
    it('should parse done event', () => {
      const result = parseSSEEvent('{"type":"done","metadata":{"conversationId":"123"}}');
      
      expect(result).toEqual({ 
        type: 'done', 
        metadata: { conversationId: '123' } 
      });
    });
    
    it('should parse error event', () => {
      const result = parseSSEEvent('{"type":"error","error":"Something went wrong"}');
      
      expect(result).toEqual({ 
        type: 'error', 
        error: 'Something went wrong' 
      });
    });
    
    it('should treat non-JSON as raw chunk', () => {
      const result = parseSSEEvent('plain text');
      
      expect(result).toEqual({ type: 'chunk', data: 'plain text' });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// HOOKS / STATE MANAGEMENT TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('State Management', () => {
  describe('createChatManager', () => {
    it('should initialize with empty state', () => {
      const mockFetch = createMockFetch(new Map());
      const client = createNovaClient({
        baseUrl: 'http://localhost:3000',
        fetch: mockFetch,
      });
      
      const chat = createChatManager(client);
      const state = chat.getState();
      
      expect(state.messages).toEqual([]);
      expect(state.conversationId).toBeUndefined();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeUndefined();
    });
    
    it('should notify subscribers on state change', async () => {
      const mockFetch = createMockFetch(new Map([
        ['/api/v1/chat', {
          status: 200,
          body: {
            type: 'success',
            message: 'Hello!',
            conversationId: 'conv123',
          },
        }],
      ]));
      
      const client = createNovaClient({
        baseUrl: 'http://localhost:3000',
        apiKey: 'test',
        fetch: mockFetch,
      });
      
      const chat = createChatManager(client);
      const notifications: number[] = [];
      let count = 0;
      
      chat.subscribe(() => {
        count++;
        notifications.push(count);
      });
      
      await chat.send('Hello');
      
      // Should notify multiple times (loading start, message add, response, loading end)
      expect(notifications.length).toBeGreaterThan(0);
    });
    
    it('should clear state', () => {
      const mockFetch = createMockFetch(new Map());
      const client = createNovaClient({
        baseUrl: 'http://localhost:3000',
        fetch: mockFetch,
      });
      
      const chat = createChatManager(client);
      chat.clear();
      
      const state = chat.getState();
      expect(state.messages).toEqual([]);
      expect(state.conversationId).toBeUndefined();
    });
  });
  
  describe('createGoalsManager', () => {
    it('should initialize with empty goals', () => {
      const mockFetch = createMockFetch(new Map());
      const client = createNovaClient({
        baseUrl: 'http://localhost:3000',
        fetch: mockFetch,
      });
      
      const goals = createGoalsManager(client);
      const state = goals.getState();
      
      expect(state.goals).toEqual([]);
      expect(state.isLoading).toBe(false);
    });
    
    it('should fetch goals', async () => {
      const mockFetch = createMockFetch(new Map([
        ['/api/v1/goals', {
          status: 200,
          body: {
            goals: [
              { id: 'goal1', title: 'Goal 1', status: 'active' },
            ],
          },
        }],
      ]));
      
      const client = createNovaClient({
        baseUrl: 'http://localhost:3000',
        apiKey: 'test',
        fetch: mockFetch,
      });
      
      const goals = createGoalsManager(client);
      await goals.fetch();
      
      const state = goals.getState();
      expect(state.goals).toHaveLength(1);
      expect(state.goals[0]!.title).toBe('Goal 1');
    });
  });
  
  describe('createSparkManager', () => {
    it('should initialize with null spark', () => {
      const mockFetch = createMockFetch(new Map());
      const client = createNovaClient({
        baseUrl: 'http://localhost:3000',
        fetch: mockFetch,
      });
      
      const spark = createSparkManager(client);
      const state = spark.getState();
      
      expect(state.activeSpark).toBeNull();
      expect(state.isLoading).toBe(false);
    });
    
    it('should generate spark', async () => {
      const mockFetch = createMockFetch(new Map([
        ['/api/v1/sparks/generate', {
          status: 200,
          body: {
            spark: {
              id: 'spark1',
              action: 'Write one paragraph',
              status: 'suggested',
            },
          },
        }],
      ]));
      
      const client = createNovaClient({
        baseUrl: 'http://localhost:3000',
        apiKey: 'test',
        fetch: mockFetch,
      });
      
      const spark = createSparkManager(client);
      const result = await spark.generate();
      
      expect(result.action).toBe('Write one paragraph');
      expect(spark.getState().activeSpark).toEqual(result);
    });
  });
  
  describe('NovaStore', () => {
    it('should create store with all managers', () => {
      const mockFetch = createMockFetch(new Map());
      const client = createNovaClient({
        baseUrl: 'http://localhost:3000',
        fetch: mockFetch,
      });
      
      const store = new NovaStore(client);
      
      expect(store.getClient()).toBe(client);
      expect(store.getChat()).toBeDefined();
      expect(store.getGoals()).toBeDefined();
      expect(store.getSpark()).toBeDefined();
    });
    
    it('should initialize all data', async () => {
      const mockFetch = createMockFetch(new Map([
        ['/api/v1/goals', {
          status: 200,
          body: { goals: [] },
        }],
        ['/api/v1/sparks/active', {
          status: 200,
          body: { spark: null },
        }],
      ]));
      
      const client = createNovaClient({
        baseUrl: 'http://localhost:3000',
        apiKey: 'test',
        fetch: mockFetch,
      });
      
      const store = new NovaStore(client);
      await store.initialize();
      
      expect(store.getGoals().getState().goals).toEqual([]);
      expect(store.getSpark().getState().activeSpark).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// INTEGRATION-STYLE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Integration', () => {
  it('should complete full chat flow', async () => {
    const mockFetch = createMockFetch(new Map([
      ['/api/v1/chat', {
        status: 200,
        body: {
          type: 'success',
          message: 'I can help you with that!',
          conversationId: 'conv123',
          stance: 'lens',
          confidence: 'high',
        },
      }],
    ]));
    
    const client = createNovaClient({
      baseUrl: 'http://localhost:3000',
      apiKey: 'test-key',
      fetch: mockFetch,
    });
    
    // Send message
    const response = await client.chat({ message: 'Help me plan my day' });
    
    expect(response.type).toBe('success');
    expect(response.conversationId).toBe('conv123');
  });
  
  it('should complete goal creation flow', async () => {
    const mockFetch = createMockFetch(new Map([
      ['/api/v1/goals', {
        status: 201,
        body: {
          goal: {
            id: 'goal123',
            title: 'Learn TypeScript',
            description: 'Master TS',
            desiredOutcome: 'Write type-safe code',
            status: 'active',
            progress: 0,
            interestLevel: 'career_capital',
          },
        },
      }],
    ]));
    
    const client = createNovaClient({
      baseUrl: 'http://localhost:3000',
      apiKey: 'test-key',
      fetch: mockFetch,
    });
    
    const result = await client.createGoal({
      title: 'Learn TypeScript',
      description: 'Master TS',
      desiredOutcome: 'Write type-safe code',
      interestLevel: 'career_capital',
    });
    
    expect(result.goal.id).toBe('goal123');
    expect(result.goal.status).toBe('active');
  });
});
