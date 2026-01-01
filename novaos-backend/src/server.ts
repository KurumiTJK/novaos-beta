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

// ─────────────────────────────────────────────────────────────────────────────────
// ENVIRONMENT CONFIG
// ─────────────────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const NODE_ENV = process.env.NODE_ENV ?? 'development';

// Auth configuration
const REQUIRE_AUTH = process.env.REQUIRE_AUTH === 'true';

// Redis configuration
const REDIS_URL = process.env.REDIS_URL;

// StepGenerator configuration
const ENABLE_FULL_STEP_GENERATOR = process.env.ENABLE_FULL_STEP_GENERATOR !== 'false';

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────────

const logger = getLogger({ component: 'server' });

// ─────────────────────────────────────────────────────────────────────────────────
// SERVER SETUP
// ─────────────────────────────────────────────────────────────────────────────────

const app = express();

// ═══════════════════════════════════════════════════════════════════════════════
// PERMISSIVE CSP FOR DEVELOPMENT (must be first middleware)
// ═══════════════════════════════════════════════════════════════════════════════
app.use((_req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src * 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src * 'self';"
  );
  next();
});

// Trust proxy (for correct IP detection behind load balancer)
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

// Health routes at root level (before API prefix)
const healthRouter = createHealthRouter();
app.use('/', healthRouter);

// Simple root check for load balancers
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

  // Initialize storage (Redis or memory fallback)
  await storeManager.initialize();

  const config = loadConfig();

  // ═══════════════════════════════════════════════════════════════════════════════
  // CREATE ROUTER
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log('[SERVER] Creating API router...');
  console.log('[SERVER] Full StepGenerator mode:', ENABLE_FULL_STEP_GENERATOR ? 'ENABLED' : 'DISABLED');
  
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
    
    // Structured log for startup
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
  POST /api/v1/chat/enhanced        Chat + Memory + Sword
  GET  /api/v1/context              Preview user context
  GET  /api/v1/conversations        List conversations
  GET  /api/v1/conversations/:id    Get conversation

Auth:
  POST /api/v1/auth/register        Get token
  GET  /api/v1/auth/verify          Verify token
  GET  /api/v1/auth/status          Auth status

Sword:
  POST /api/v1/goals                Create goal
  GET  /api/v1/goals                List goals
  GET  /api/v1/goals/:id            Get goal + path
  PATCH /api/v1/goals/:id           Update goal
  POST /api/v1/goals/:id/transition Transition state
  POST /api/v1/quests               Create quest
  GET  /api/v1/quests/:id           Get quest
  POST /api/v1/quests/:id/transition Transition state
  POST /api/v1/steps                Create step
  POST /api/v1/steps/:id/transition Transition state
  POST /api/v1/sparks/generate      Generate spark
  GET  /api/v1/sparks/active        Active spark
  GET  /api/v1/sparks               List sparks
  POST /api/v1/sparks/:id/transition Transition state
  GET  /api/v1/path/:goalId         Full path
  POST /api/v1/path/:goalId/next-spark Next spark

Memory:
  GET  /api/v1/profile              Get profile
  PATCH /api/v1/profile             Update profile
  GET  /api/v1/preferences          Get preferences
  PATCH /api/v1/preferences         Update preferences
  GET  /api/v1/memories             List memories
  GET  /api/v1/memories/stats       Memory stats
  POST /api/v1/memories             Create memory
  GET  /api/v1/memories/:id         Get memory
  PATCH /api/v1/memories/:id        Update memory
  DELETE /api/v1/memories/:id       Delete memory
  DELETE /api/v1/memories           Clear memories
  POST /api/v1/memories/extract     Extract from message
  POST /api/v1/memories/context     Get LLM context
  POST /api/v1/memories/decay       Run decay

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
    
    // Force exit after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  // Unhandled errors
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
