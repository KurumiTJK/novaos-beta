// ═══════════════════════════════════════════════════════════════════════════════
// NOVAOS BACKEND — Server Entry Point
// ═══════════════════════════════════════════════════════════════════════════════

import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createRouterAsync, errorHandler } from './api/routes.js';
import { requestMiddleware } from './api/middleware/request.js';
import { storeManager } from './storage/index.js';
import { loadConfig, canVerify, isProduction } from './config/index.js';
import { getLogger, createHealthRouter } from './observability/index.js';
import { pipeline_model, model_llm, isOpenAIAvailable } from './pipeline/llm_engine.js';
import { initSecurity, ipRateLimit } from './security/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// DATABASE IMPORTS (NEW)
// ─────────────────────────────────────────────────────────────────────────────────

import { initSupabase, testConnection, isSupabaseInitialized } from './db/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────────

const config = loadConfig();
const PORT = config.server.port;
const NODE_ENV = config.environment;
const REQUIRE_AUTH = config.auth.required;

const logger = getLogger({ component: 'server' });

// ─────────────────────────────────────────────────────────────────────────────────
// EXPRESS APP
// ─────────────────────────────────────────────────────────────────────────────────

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: isProduction() ? undefined : {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Trust proxy
app.set('trust proxy', config.server.trustProxy ? 1 : 0);

// CORS
app.use(cors({
  origin: isProduction() 
    ? config.cors.allowedOrigins.length > 0 ? config.cors.allowedOrigins : false
    : '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  credentials: config.cors.allowCredentials,
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));

// Static files
app.use(express.static('public'));

// Request middleware
app.use(requestMiddleware);

// ─────────────────────────────────────────────────────────────────────────────────
// HEALTH ROUTES
// ─────────────────────────────────────────────────────────────────────────────────

const healthRouter = createHealthRouter({
  version: '1.0.0',
  serviceName: 'novaos-backend',
  environment: NODE_ENV,
  getFeatures: () => ({
    verification: canVerify(),
    webFetch: config.webFetch.enabled,
    auth: REQUIRE_AUTH,
    debug: config.observability.debugMode,
    supabase: isSupabaseInitialized(),
  }),
  criticalChecks: [],
});
app.use('/', healthRouter);

app.get('/', (_req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'novaos-backend',
    version: '1.0.0',
    storage: storeManager.isUsingRedis() ? 'redis' : 'memory',
    database: isSupabaseInitialized() ? 'connected' : 'not configured',
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────────────────────────

async function startServer() {
  const startTime = Date.now();

  // Initialize storage
  await storeManager.initialize();

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

  // ═══════════════════════════════════════════════════════════════════════════════
  // NEW: Initialize Supabase (optional - only if env vars are set)
  // ═══════════════════════════════════════════════════════════════════════════════
  let supabaseStatus = 'not configured';
  
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    try {
      initSupabase({
        url: process.env.SUPABASE_URL,
        serviceKey: process.env.SUPABASE_SERVICE_KEY,
      });
      
      // Test the connection
      const connected = await testConnection();
      supabaseStatus = connected ? 'connected' : 'connection failed';
      
      if (!connected) {
        logger.warn('Supabase connection test failed - settings endpoints will be unavailable');
      }
    } catch (error) {
      logger.error('Failed to initialize Supabase', error instanceof Error ? error : new Error(String(error)));
      supabaseStatus = 'initialization failed';
    }
  } else {
    logger.info('Supabase not configured - settings endpoints will be unavailable');
  }

  // Rate limiting
  app.use(ipRateLimit());

  // API routes
  const router = await createRouterAsync({ requireAuth: REQUIRE_AUTH });
  app.use('/api/v1', router);

  // Error handler (must be last)
  app.use(errorHandler);
  
  const server = app.listen(PORT, () => {
    const startupTime = Date.now() - startTime;
    
    logger.info('Server started', {
      port: PORT,
      environment: NODE_ENV,
      storage: storeManager.isUsingRedis() ? 'redis' : 'memory',
      database: supabaseStatus,
      verification: canVerify() ? 'enabled' : 'disabled',
      pipelineModel: pipeline_model,
      generationModel: model_llm,
      startupMs: startupTime,
    });
    
    console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║                        NOVAOS BACKEND v1.0.0                          ║
╠═══════════════════════════════════════════════════════════════════════╣
║  Environment:  ${NODE_ENV.padEnd(53)}║
║  Port:         ${String(PORT).padEnd(53)}║
║  OpenAI:       ${(isOpenAIAvailable() ? 'connected' : 'unavailable').padEnd(53)}║
║  Pipeline:     ${pipeline_model.padEnd(53)}║
║  Generation:   ${model_llm.padEnd(53)}║
║  Auth:         ${(REQUIRE_AUTH ? 'required' : 'optional').padEnd(53)}║
║  Storage:      ${(storeManager.isUsingRedis() ? 'redis' : 'memory').padEnd(53)}║
║  Database:     ${supabaseStatus.padEnd(53)}║
║  Verification: ${(canVerify() ? 'enabled' : 'disabled').padEnd(53)}║
╚═══════════════════════════════════════════════════════════════════════╝

  HEALTH
    GET  /health                           Health check
    GET  /health/live                      Liveness probe
    GET  /health/ready                     Readiness probe

  INFO
    GET  /api/v1/health                    API health
    GET  /api/v1/version                   Version info
    GET  /api/v1/providers                 Available providers
    GET  /api/v1/config                    Current config

  AUTH
    POST /api/v1/auth/register             Get token
    GET  /api/v1/auth/verify               Verify token
    GET  /api/v1/auth/status               Auth status
    POST /api/v1/auth/refresh              Refresh tokens
    POST /api/v1/auth/logout               Logout

  SETTINGS
    GET  /api/v1/settings                  Get user settings
    PATCH /api/v1/settings                 Update settings

  CHAT
    POST /api/v1/chat                      Main chat endpoint
    POST /api/v1/parse-command             Parse action command

  CONVERSATIONS
    GET  /api/v1/conversations             List conversations
    GET  /api/v1/conversations/:id         Get conversation
    GET  /api/v1/conversations/:id/messages Get messages
    PATCH /api/v1/conversations/:id        Update conversation
    DELETE /api/v1/conversations/:id       Delete conversation

  ADMIN
    POST /api/v1/admin/block-user          Block user
    POST /api/v1/admin/unblock-user        Unblock user
    GET  /api/v1/admin/audit-logs          View audit logs

  Ready. Startup: ${startupTime}ms
    `);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Shutdown initiated by ${signal}`);
    
    server.close(async () => {
      logger.info('HTTP server closed');
      await storeManager.disconnect();
      logger.info('Shutdown complete');
      process.exit(0);
    });
    
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, config.server.shutdownTimeoutMs);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  process.on('uncaughtException', (error) => {
    logger.fatal('Uncaught exception', error);
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', reason instanceof Error ? reason : new Error(String(reason)));
  });
}

startServer().catch((error) => {
  logger.fatal('Failed to start server', error instanceof Error ? error : new Error(String(error)));
  process.exit(1);
});

export { app };
