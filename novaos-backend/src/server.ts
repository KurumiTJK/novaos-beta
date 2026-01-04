// ═══════════════════════════════════════════════════════════════════════════════
// NOVAOS BACKEND — Server Entry Point
// ═══════════════════════════════════════════════════════════════════════════════

import express from 'express';
import cors from 'cors';
import { createRouterAsync, errorHandler } from './api/routes.js';
import { createHealthRouter } from './api/routes/health.js';
import { requestMiddleware } from './api/middleware/request.js';
import { storeManager } from './storage/index.js';
import { loadConfig, canVerify } from './config/index.js';
import { getLogger } from './logging/index.js';
import { pipeline_model, model_llm, isOpenAIAvailable } from './pipeline/llm_engine.js';
import { initializeMemoryStore } from './gates/memory_gate/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// ENVIRONMENT CONFIG
// ─────────────────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const NODE_ENV = process.env.NODE_ENV ?? 'development';
const REQUIRE_AUTH = process.env.REQUIRE_AUTH === 'true';

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────────

const logger = getLogger({ component: 'server' });

// ─────────────────────────────────────────────────────────────────────────────────
// SERVER SETUP
// ─────────────────────────────────────────────────────────────────────────────────

const app = express();

// Permissive CSP for development
app.use((_req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src * 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src * 'self';"
  );
  next();
});

// Trust proxy
app.set('trust proxy', 1);

// CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id'],
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));

// Serve frontend
app.use(express.static('public'));

// Request ID and logging middleware
app.use(requestMiddleware);

// ─────────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────────

const healthRouter = createHealthRouter();
app.use('/', healthRouter);

app.get('/', (_req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'novaos-backend',
    version: '1.0.0',
    storage: storeManager.isUsingRedis() ? 'redis' : 'memory',
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────────────────────────

async function startServer() {
  const startTime = Date.now();

  // Initialize storage
  await storeManager.initialize();

  // Initialize episodic memory gate store
  initializeMemoryStore(storeManager.getStore());
  console.log('[MEMORY_GATE] Episodic memory store initialized');

  const config = loadConfig();

  // Create router
  console.log('[SERVER] Creating API router...');
  
  const router = await createRouterAsync({
    requireAuth: REQUIRE_AUTH,
  });

  app.use('/api/v1', router);

  // Error handler (must be last)
  app.use(errorHandler);
  
  const server = app.listen(PORT, () => {
    const storageStatus = storeManager.isUsingRedis() ? 'redis' : 'memory';
    const verifyStatus = canVerify() ? 'enabled' : 'disabled';
    const openaiStatus = isOpenAIAvailable() ? 'connected' : 'unavailable';
    const startupTime = Date.now() - startTime;
    
    logger.info('Server started', {
      port: PORT,
      environment: NODE_ENV,
      storage: storageStatus,
      verification: verifyStatus,
      pipelineModel: pipeline_model,
      generationModel: model_llm,
      startupMs: startupTime,
    });
    
    console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                     NOVAOS BACKEND v1.0.0                         ║
╠═══════════════════════════════════════════════════════════════════╣
║  Environment:  ${NODE_ENV.padEnd(49)}║
║  Port:         ${String(PORT).padEnd(49)}║
║  OpenAI:       ${openaiStatus.padEnd(49)}║
║  Pipeline:     ${pipeline_model.padEnd(49)}║
║  Generation:   ${model_llm.padEnd(49)}║
║  Auth:         ${(REQUIRE_AUTH ? 'required' : 'optional').padEnd(49)}║
║  Storage:      ${storageStatus.padEnd(49)}║
║  Verification: ${verifyStatus.padEnd(49)}║
╚═══════════════════════════════════════════════════════════════════╝

Health:
  GET  /health                      Liveness check
  GET  /ready                       Readiness check
  GET  /status                      Detailed status

Core:
  POST /api/v1/chat                 Main chat endpoint
  POST /api/v1/parse-command        Parse action command

Conversations:
  GET  /api/v1/conversations        List conversations
  GET  /api/v1/conversations/:id    Get conversation + messages
  GET  /api/v1/conversations/:id/messages  Get messages only
  PATCH /api/v1/conversations/:id   Update title/tags
  DELETE /api/v1/conversations/:id  Delete conversation

Auth:
  POST /api/v1/auth/register        Get token
  GET  /api/v1/auth/verify          Verify token
  GET  /api/v1/auth/status          Auth status

Admin:
  POST /api/v1/admin/block-user     Block user
  POST /api/v1/admin/unblock-user   Unblock user
  GET  /api/v1/admin/audit-logs     Audit logs
  GET  /api/v1/config               View config

Ready to enforce the Nova Constitution. Startup: ${startupTime}ms
    `);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Shutdown initiated by ${signal}`);
    
    server.close(async () => {
      logger.info('HTTP server closed');
      
      await storeManager.disconnect();
      logger.info('Storage disconnected');
      
      logger.info('Server shutdown complete');
      process.exit(0);
    });
    
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
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
