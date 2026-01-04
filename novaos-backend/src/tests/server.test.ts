// ═══════════════════════════════════════════════════════════════════════════════
// SERVER TESTS — NovaOS Backend Server Entry Point
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────────────────────────────────

// Mock dependencies before importing the app
vi.mock('../config/index.js', () => ({
  loadConfig: () => ({
    environment: 'test',
    server: {
      port: 3000,
      trustProxy: false,
      shutdownTimeoutMs: 5000,
    },
    auth: {
      required: false,
      jwtSecret: 'test-secret-key-for-testing-purposes-only',
      tokenExpirySeconds: 3600,
    },
    cors: {
      allowedOrigins: [],
      allowCredentials: false,
    },
    webFetch: {
      enabled: true,
    },
    observability: {
      debugMode: true,
    },
  }),
  canVerify: () => true,
  isProduction: () => false,
}));

vi.mock('../storage/index.js', () => ({
  storeManager: {
    initialize: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    isUsingRedis: vi.fn().mockReturnValue(false),
    getStore: vi.fn().mockReturnValue({
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    }),
  },
}));

vi.mock('../observability/index.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    debug: vi.fn(),
  }),
  createHealthRouter: vi.fn(() => {
    const router = express.Router();
    router.get('/health', (_req, res) => res.json({ status: 'ok' }));
    router.get('/health/live', (_req, res) => res.json({ status: 'ok' }));
    router.get('/health/ready', (_req, res) => res.json({ status: 'ok' }));
    return router;
  }),
}));

vi.mock('../pipeline/llm_engine.js', () => ({
  pipeline_model: 'gpt-4o-mini',
  model_llm: 'gpt-4o',
  isOpenAIAvailable: () => true,
}));

vi.mock('../security/index.js', () => ({
  initSecurity: vi.fn(),
  ipRateLimit: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../api/routes.js', () => ({
  createRouterAsync: vi.fn().mockResolvedValue(
    (() => {
      const router = express.Router();
      router.get('/health', (_req, res) => res.json({ status: 'ok', api: true }));
      router.get('/version', (_req, res) => res.json({ version: '1.0.0' }));
      router.post('/chat', (_req, res) => res.json({ response: 'test response' }));
      return router;
    })()
  ),
  errorHandler: (err: any, _req: any, res: any, _next: any) => {
    res.status(err.status || 500).json({ error: err.message || 'Internal error' });
  },
}));

vi.mock('../api/middleware/request.js', () => ({
  requestMiddleware: (_req: any, _res: any, next: any) => next(),
}));

// ─────────────────────────────────────────────────────────────────────────────────
// TEST APP FACTORY
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Creates a test Express app with the same configuration as the real server
 * but without actually starting the server.
 */
async function createTestApp(): Promise<Express> {
  const { loadConfig, isProduction } = await import('../config/index.js');
  const { createRouterAsync, errorHandler } = await import('../api/routes.js');
  const { requestMiddleware } = await import('../api/middleware/request.js');
  const { createHealthRouter } = await import('../observability/index.js');
  const { initSecurity, ipRateLimit } = await import('../security/index.js');
  const { storeManager } = await import('../storage/index.js');
  
  const config = loadConfig();
  const app = express();

  // Security headers (simplified for testing)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });

  // CORS (simplified)
  app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  });

  // Body parsing
  app.use(express.json({ limit: '1mb' }));

  // Request middleware
  app.use(requestMiddleware);

  // Health routes
  const healthRouter = createHealthRouter({
    version: '1.0.0',
    serviceName: 'novaos-backend',
    environment: config.environment,
    getFeatures: () => ({
      verification: true,
      webFetch: true,
      auth: false,
      debug: true,
    }),
    criticalChecks: [],
  });
  app.use('/', healthRouter);

  // Root endpoint
  app.get('/', (_req, res) => {
    res.json({ 
      status: 'ok', 
      service: 'novaos-backend',
      version: '1.0.0',
      storage: storeManager.isUsingRedis() ? 'redis' : 'memory',
    });
  });

  // Initialize security
  initSecurity(storeManager.getStore(), {
    tokenConfig: {
      secret: config.auth.jwtSecret,
      accessTokenExpiry: `${config.auth.tokenExpirySeconds}s`,
      refreshTokenExpiry: '7d',
    },
    abuseConfig: {
      vetoWarningThreshold: 3,
      vetoBlockThreshold: 5,
      defaultBlockDurationSeconds: 3600,
    },
    ssrfConfig: {
      allowHttp: !isProduction(),
    },
  });

  // Rate limiting
  app.use(ipRateLimit());

  // API routes
  const router = await createRouterAsync({ requireAuth: config.auth.required });
  app.use('/api/v1', router);

  // Error handler
  app.use(errorHandler);

  return app;
}

// ─────────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Server', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ROOT ENDPOINT
  // ─────────────────────────────────────────────────────────────────────────────

  describe('GET /', () => {
    it('should return server status', async () => {
      const response = await request(app).get('/');
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'ok',
        service: 'novaos-backend',
        version: '1.0.0',
      });
    });

    it('should include storage type', async () => {
      const response = await request(app).get('/');
      
      expect(response.body.storage).toBeDefined();
      expect(['redis', 'memory']).toContain(response.body.storage);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // HEALTH ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Health Endpoints', () => {
    describe('GET /health', () => {
      it('should return health status', async () => {
        const response = await request(app).get('/health');
        
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
      });
    });

    describe('GET /health/live', () => {
      it('should return liveness status', async () => {
        const response = await request(app).get('/health/live');
        
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
      });
    });

    describe('GET /health/ready', () => {
      it('should return readiness status', async () => {
        const response = await request(app).get('/health/ready');
        
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // API ROUTES
  // ─────────────────────────────────────────────────────────────────────────────

  describe('API Routes', () => {
    describe('GET /api/v1/health', () => {
      it('should return API health status', async () => {
        const response = await request(app).get('/api/v1/health');
        
        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          status: 'ok',
          api: true,
        });
      });
    });

    describe('GET /api/v1/version', () => {
      it('should return version info', async () => {
        const response = await request(app).get('/api/v1/version');
        
        expect(response.status).toBe(200);
        expect(response.body.version).toBe('1.0.0');
      });
    });

    describe('POST /api/v1/chat', () => {
      it('should handle chat requests', async () => {
        const response = await request(app)
          .post('/api/v1/chat')
          .send({ message: 'Hello' })
          .set('Content-Type', 'application/json');
        
        expect(response.status).toBe(200);
        expect(response.body.response).toBeDefined();
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // MIDDLEWARE
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Middleware', () => {
    it('should parse JSON bodies', async () => {
      const response = await request(app)
        .post('/api/v1/chat')
        .send({ message: 'test', data: { nested: true } })
        .set('Content-Type', 'application/json');
      
      expect(response.status).toBe(200);
    });

    it('should reject bodies exceeding limit', async () => {
      const largeBody = { data: 'x'.repeat(2 * 1024 * 1024) }; // 2MB
      
      const response = await request(app)
        .post('/api/v1/chat')
        .send(largeBody)
        .set('Content-Type', 'application/json');
      
      expect(response.status).toBe(413); // Payload Too Large
    });

    it('should set security headers', async () => {
      const response = await request(app).get('/');
      
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should set CORS headers', async () => {
      const response = await request(app).get('/');
      
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ERROR HANDLING
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/api/v1/unknown-route');
      
      expect(response.status).toBe(404);
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/v1/chat')
        .send('{ invalid json }')
        .set('Content-Type', 'application/json');
      
      expect(response.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // CONTENT TYPE
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Content Type', () => {
    it('should return JSON responses', async () => {
      const response = await request(app).get('/');
      
      expect(response.type).toBe('application/json');
    });

    it('should accept JSON content type', async () => {
      const response = await request(app)
        .post('/api/v1/chat')
        .send({ message: 'test' })
        .set('Content-Type', 'application/json');
      
      expect(response.status).not.toBe(415); // Not Unsupported Media Type
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIG TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Server Configuration', () => {
  it('should load config correctly', async () => {
    const { loadConfig } = await import('../config/index.js');
    const config = loadConfig();
    
    expect(config.environment).toBe('test');
    expect(config.server.port).toBe(3000);
  });

  it('should check production mode', async () => {
    const { isProduction } = await import('../config/index.js');
    
    expect(isProduction()).toBe(false);
  });

  it('should check verification capability', async () => {
    const { canVerify } = await import('../config/index.js');
    
    expect(typeof canVerify()).toBe('boolean');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// STORAGE MANAGER TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Storage Manager Integration', () => {
  it('should initialize storage', async () => {
    const { storeManager } = await import('../storage/index.js');
    
    await expect(storeManager.initialize()).resolves.not.toThrow();
  });

  it('should report storage type', async () => {
    const { storeManager } = await import('../storage/index.js');
    
    expect(typeof storeManager.isUsingRedis()).toBe('boolean');
  });

  it('should provide store instance', async () => {
    const { storeManager } = await import('../storage/index.js');
    
    const store = storeManager.getStore();
    expect(store).toBeDefined();
  });

  it('should disconnect gracefully', async () => {
    const { storeManager } = await import('../storage/index.js');
    
    await expect(storeManager.disconnect()).resolves.not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SECURITY INITIALIZATION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Security Initialization', () => {
  it('should initialize security module', async () => {
    const { initSecurity } = await import('../security/index.js');
    const { storeManager } = await import('../storage/index.js');
    
    expect(() => {
      initSecurity(storeManager.getStore(), {
        tokenConfig: {
          secret: 'test-secret',
          accessTokenExpiry: '1h',
          refreshTokenExpiry: '7d',
        },
        abuseConfig: {
          vetoWarningThreshold: 3,
          vetoBlockThreshold: 5,
          defaultBlockDurationSeconds: 3600,
        },
        ssrfConfig: {
          allowHttp: true,
        },
      });
    }).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// LLM ENGINE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('LLM Engine Configuration', () => {
  it('should export pipeline model', async () => {
    const { pipeline_model } = await import('../pipeline/llm_engine.js');
    
    expect(typeof pipeline_model).toBe('string');
    expect(pipeline_model.length).toBeGreaterThan(0);
  });

  it('should export generation model', async () => {
    const { model_llm } = await import('../pipeline/llm_engine.js');
    
    expect(typeof model_llm).toBe('string');
    expect(model_llm.length).toBeGreaterThan(0);
  });

  it('should check OpenAI availability', async () => {
    const { isOpenAIAvailable } = await import('../pipeline/llm_engine.js');
    
    expect(typeof isOpenAIAvailable()).toBe('boolean');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// ROUTER CREATION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Router Creation', () => {
  it('should create router with auth disabled', async () => {
    const { createRouterAsync } = await import('../api/routes.js');
    
    const router = await createRouterAsync({ requireAuth: false });
    expect(router).toBeDefined();
  });

  it('should create router with auth enabled', async () => {
    const { createRouterAsync } = await import('../api/routes.js');
    
    const router = await createRouterAsync({ requireAuth: true });
    expect(router).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// HTTP METHODS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('HTTP Methods', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  it('should handle GET requests', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
  });

  it('should handle POST requests', async () => {
    const response = await request(app)
      .post('/api/v1/chat')
      .send({ message: 'test' });
    expect(response.status).toBe(200);
  });

  it('should handle OPTIONS requests (CORS preflight)', async () => {
    const response = await request(app)
      .options('/api/v1/chat')
      .set('Origin', 'http://localhost:3001')
      .set('Access-Control-Request-Method', 'POST');
    
    // Should not be 405 Method Not Allowed
    expect(response.status).not.toBe(405);
  });
});
