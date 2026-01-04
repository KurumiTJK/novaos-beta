// ═══════════════════════════════════════════════════════════════════════════════
// API ROUTES TESTS
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRouterAsync, errorHandler, ClientError } from '../../api/routes.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────────────────────────────────

// Must mock with a proper class
vi.mock('../../pipeline/execution-pipeline.js', () => {
  return {
    ExecutionPipeline: class MockExecutionPipeline {
      process = vi.fn().mockResolvedValue({
        status: 'success',
        response: 'Mock response',
        gateResults: {},
        metadata: { totalTimeMs: 100 },
      });
    },
  };
});

vi.mock('../../pipeline/llm_engine.js', () => ({
  pipeline_model: 'gpt-4o-mini',
  model_llm: 'gpt-4o',
  isOpenAIAvailable: vi.fn(() => true),
}));

vi.mock('../../storage/index.js', () => ({
  storeManager: {
    isUsingRedis: vi.fn(() => false),
  },
}));

vi.mock('../../core/memory/working_memory/index.js', () => ({
  workingMemory: {
    create: vi.fn().mockResolvedValue({ id: 'conv-123', userId: 'user-123' }),
    get: vi.fn().mockResolvedValue({ id: 'conv-123', userId: 'user-123' }),
    list: vi.fn().mockResolvedValue([]),
    getMessages: vi.fn().mockResolvedValue([]),
    addMessage: vi.fn().mockResolvedValue(undefined),
    updateTitle: vi.fn().mockResolvedValue({ id: 'conv-123' }),
    addTag: vi.fn().mockResolvedValue({ id: 'conv-123' }),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../config/index.js', () => ({
  loadConfig: vi.fn(() => ({
    environment: 'test',
    verification: { enabled: false },
    webFetch: { enabled: false },
    auth: { required: false },
    observability: { debugMode: true },
  })),
  canVerify: vi.fn(() => false),
}));

vi.mock('../../security/index.js', () => ({
  authenticate: vi.fn(() => (req: any, _res: any, next: any) => {
    req.user = { userId: 'user-123', tier: 'free' };
    req.userId = 'user-123';
    next();
  }),
  rateLimit: vi.fn(() => (_req: any, _res: any, next: any) => next()),
  validateBody: vi.fn(() => (_req: any, _res: any, next: any) => next()),
  validateQuery: vi.fn(() => (_req: any, _res: any, next: any) => next()),
  validateParams: vi.fn(() => (_req: any, _res: any, next: any) => next()),
  abuseProtection: vi.fn(() => (_req: any, _res: any, next: any) => next()),
  generateAccessToken: vi.fn(() => ({ token: 'test-token', expiresAt: Date.now() + 3600000 })),
  generateApiKey: vi.fn(() => ({ token: 'nova_test-key' })),
  getAckTokenStore: vi.fn(() => ({ generate: vi.fn() })),
  generateAckToken: vi.fn(() => 'ack-token'),
  blockUser: vi.fn(),
  unblockUser: vi.fn().mockResolvedValue(true),
  isUserBlocked: vi.fn().mockResolvedValue({ blocked: false }),
  trackVeto: vi.fn(),
  getRecentVetoCount: vi.fn().mockResolvedValue(0),
  logAudit: vi.fn(),
  getAuditStore: vi.fn(() => ({
    getUserLogs: vi.fn().mockResolvedValue([]),
    getGlobalLogs: vi.fn().mockResolvedValue([]),
  })),
  ChatMessageSchema: {},
  ParseCommandSchema: {},
  RegisterSchema: {},
  ConversationIdParamSchema: {},
  UpdateConversationSchema: {},
  ConversationQuerySchema: {},
}));

// ─────────────────────────────────────────────────────────────────────────────────
// TEST SETUP
// ─────────────────────────────────────────────────────────────────────────────────

async function createTestApp() {
  const app = express();
  app.use(express.json());
  const router = await createRouterAsync({ requireAuth: false });
  app.use('/api/v1', router);
  app.use(errorHandler);
  return app;
}

// ─────────────────────────────────────────────────────────────────────────────────
// PUBLIC ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Public Endpoints', () => {
  let app: express.Application;

  beforeEach(async () => {
    app = await createTestApp();
  });

  describe('GET /api/v1/health', () => {
    it('should return health status', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
    });
  });

  describe('GET /api/v1/version', () => {
    it('should return version info', async () => {
      const res = await request(app).get('/api/v1/version');
      expect(res.status).toBe(200);
      expect(res.body.api).toBe('1.0.0');
    });
  });

  describe('GET /api/v1/providers', () => {
    it('should return available providers', async () => {
      const res = await request(app).get('/api/v1/providers');
      expect(res.status).toBe(200);
      expect(res.body.available).toBeInstanceOf(Array);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// AUTH ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Auth Endpoints', () => {
  let app: express.Application;

  beforeEach(async () => {
    app = await createTestApp();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register and return tokens', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'test@example.com' });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });
  });

  describe('GET /api/v1/auth/verify', () => {
    it('should verify token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/verify')
        .set('Authorization', 'Bearer test-token');
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
    });
  });

  describe('GET /api/v1/auth/status', () => {
    it('should return auth status', async () => {
      const res = await request(app).get('/api/v1/auth/status');
      expect(res.status).toBe(200);
      expect(res.body.userId).toBeDefined();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// CHAT ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Chat Endpoints', () => {
  let app: express.Application;

  beforeEach(async () => {
    app = await createTestApp();
  });

  describe('POST /api/v1/chat', () => {
    it('should process chat message', async () => {
      const res = await request(app)
        .post('/api/v1/chat')
        .send({ message: 'Hello' });
      expect(res.status).toBe(200);
      expect(res.body.response).toBeDefined();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// ERROR HANDLER
// ─────────────────────────────────────────────────────────────────────────────────

describe('errorHandler', () => {
  it('should handle ClientError', () => {
    const app = express();
    app.get('/test', () => {
      throw new ClientError('Test error', 400);
    });
    app.use(errorHandler);

    return request(app)
      .get('/test')
      .then(res => {
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('CLIENT_ERROR');
      });
  });
});

describe('ClientError', () => {
  it('should create error with default status', () => {
    const error = new ClientError('Test');
    expect(error.statusCode).toBe(400);
  });
});
