// ═══════════════════════════════════════════════════════════════════════════════
// NOVAOS BACKEND — Production-Hardened Server Entry Point
// ═══════════════════════════════════════════════════════════════════════════════

import express from 'express';
import { createRouterAsync, errorHandler } from './api/routes.js';
import { createHealthRouter } from './api/routes/health.js';
import { 
  requestMiddleware,
  applySecurity,
  sanitizeRequest,
  loadSecurityConfig,
} from './api/middleware/index.js';
import { storeManager } from './storage/index.js';
import { loadConfig, canVerify } from './config/index.js';
import { getLogger } from './logging/index.js';
import { pipeline_model, model_llm, isOpenAIAvailable } from './pipeline/llm_engine.js';
import {
  circuitRegistry,
  circuitBreakerStatusMiddleware,
  getLLMCircuit,
  getRedisCircuit,
} from './services/circuit-breaker.js';

// ─────────────────────────────────────────────────────────────────────────────────
// ENVIRONMENT CONFIG
// ─────────────────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const NODE_ENV = process.env.NODE_ENV ?? 'development';

// Auth configuration
const REQUIRE_AUTH = process.env.REQUIRE_AUTH === 'true';

// Redis configuration
const REDIS_URL = process.env.REDIS_URL;

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────────

const logger = getLogger({ component: 'server' });

// ─────────────────────────────────────────────────────────────────────────────────
// SERVER SETUP
// ─────────────────────────────────────────────────────────────────────────────────

const app = express();
const securityConfig = loadSecurityConfig();

// Trust proxy (for correct IP detection behind load balancer)
app.set('trust proxy', securityConfig.trustProxy ? 1 : false);

// Disable X-Powered-By
app.disable('x-powered-by');

// ─────────────────────────────────────────────────────────────────────────────────
// SECURITY MIDDLEWARE
// Order matters: security headers → HTTPS redirect → CORS → body parsing
// ─────────────────────────────────────────────────────────────────────────────────

// Apply comprehensive security middleware
app.use(applySecurity({
  headers: true,
  csp: true,
  cors: {
    origins: securityConfig.isProduction 
      ? securityConfig.allowedOrigins 
      : '*',
  },
  httpsRedirect: securityConfig.isProduction,
  requestLimits: {
    maxBodySize: '1mb',
    maxUrlLength: 2048,
    maxHeaderSize: 8192,
    maxParameterCount: 100,
  },
}));

// Body parsing with limits
app.use(express.json({ 
  limit: '1mb',
  strict: true,
}));

// URL-encoded body parsing
app.use(express.urlencoded({ 
  extended: true,
  limit: '1mb',
  parameterLimit: 100,
}));

// Input sanitization
app.use(sanitizeRequest());

// Request ID and logging middleware
app.use(requestMiddleware);

// ─────────────────────────────────────────────────────────────────────────────────
// HEALTH & MONITORING ROUTES
// ─────────────────────────────────────────────────────────────────────────────────

// Health routes at root level (before API prefix)
const healthRouter = createHealthRouter();
app.use('/', healthRouter);

// Circuit breaker status endpoint
app.get('/circuits', circuitBreakerStatusMiddleware());

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
// ERROR HANDLING
// ─────────────────────────────────────────────────────────────────────────────────

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: 'Not Found',
    code: 'NOT_FOUND',
    message: 'The requested resource was not found',
  });
});

// Global error handler
app.use(errorHandler);

// ─────────────────────────────────────────────────────────────────────────────────
// GRACEFUL SHUTDOWN
// ─────────────────────────────────────────────────────────────────────────────────

let server: ReturnType<typeof app.listen>;
let isShuttingDown = false;

function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  // Stop accepting new connections
  server.close((err) => {
    if (err) {
      logger.error('Error during server close:', err);
      process.exit(1);
    }
    
    logger.info('HTTP server closed');
    
    // Close storage connections
    storeManager.close()
      .then(() => {
        logger.info('Storage connections closed');
        
        // Reset circuit breakers
        circuitRegistry.resetAll();
        logger.info('Circuit breakers reset');
        
        process.exit(0);
      })
      .catch((error) => {
        logger.error('Error closing storage:', error);
        process.exit(1);
      });
  });
  
  // Force shutdown after timeout
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

// ─────────────────────────────────────────────────────────────────────────────────
// STARTUP
// ─────────────────────────────────────────────────────────────────────────────────

async function startup() {
  const startTime = Date.now();
  
  // Initialize storage
  try {
    await storeManager.initialize();
    logger.info(`Storage: ${storeManager.isUsingRedis() ? 'Redis' : 'In-Memory'}`);
    
    // Initialize circuit breakers
    getLLMCircuit();
    getRedisCircuit();
    logger.info('Circuit breakers initialized');
  } catch (error) {
    logger.warn('Storage initialization failed, using in-memory fallback:', { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
  
  // Create and mount API router (async)
  try {
    const apiRouter = await createRouterAsync({
      requireAuth: REQUIRE_AUTH || NODE_ENV === 'production',
    });
    app.use('/api/v1', apiRouter);
    logger.info('API router mounted');
  } catch (error) {
    logger.error('Failed to create API router:', error);
    throw error;
  }
  
  // Start server
  server = app.listen(PORT, () => {
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
║                 NOVAOS BACKEND v1.0.0 (PRODUCTION)                ║
╠═══════════════════════════════════════════════════════════════════╣
║  Environment:  ${NODE_ENV.padEnd(49)}║
║  Port:         ${String(PORT).padEnd(49)}║
║  OpenAI:       ${openaiStatus.padEnd(49)}║
║  Pipeline:     ${pipeline_model.padEnd(49)}║
║  Generation:   ${model_llm.padEnd(49)}║
║  Auth:         ${(REQUIRE_AUTH || NODE_ENV === 'production' ? 'required' : 'optional').padEnd(49)}║
║  Storage:      ${storageStatus.padEnd(49)}║
║  Verification: ${verifyStatus.padEnd(49)}║
╠═══════════════════════════════════════════════════════════════════╣
║  SECURITY                                                         ║
║  HTTPS:        ${(securityConfig.isProduction ? 'enforced' : 'disabled').padEnd(49)}║
║  HSTS:         ${(securityConfig.isProduction ? 'enabled' : 'disabled').padEnd(49)}║
║  CSP:          ${'enabled'.padEnd(49)}║
║  Sanitization: ${'enabled'.padEnd(49)}║
║  CORS:         ${(securityConfig.isProduction ? 'whitelisted' : 'open (*)').padEnd(49)}║
║  Circuits:     ${'enabled'.padEnd(49)}║
╚═══════════════════════════════════════════════════════════════════╝

Health:
  GET  /health                      Liveness check
  GET  /ready                       Readiness check
  GET  /status                      Detailed status
  GET  /circuits                    Circuit breaker status

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
  
  // Handle server errors
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${PORT} is already in use`);
      process.exit(1);
    }
    throw error;
  });
  
  // Handle graceful shutdown
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    gracefulShutdown('uncaughtException');
  });
  
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection:', reason instanceof Error ? reason : new Error(String(reason)));
  });
}

// Start the server
startup().catch((error) => {
  logger.error('Startup failed:', error);
  process.exit(1);
});

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS (for testing)
// ─────────────────────────────────────────────────────────────────────────────────

export { app };
