// ═══════════════════════════════════════════════════════════════════════════════
// NOVAOS BACKEND — Production-Hardened Server Entry Point
// Phase 20: Production Hardening
// ═══════════════════════════════════════════════════════════════════════════════

import express from 'express';
import { createRouter, errorHandler } from './api/routes.js';
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

// Provider configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PREFERRED_PROVIDER = (process.env.PREFERRED_PROVIDER as 'openai' | 'gemini' | 'mock') ?? 'openai';
const USE_MOCK = process.env.USE_MOCK_PROVIDER === 'true';

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
// SECURITY MIDDLEWARE (Phase 20)
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

// Input sanitization (Phase 20)
app.use(sanitizeRequest());

// Request ID and logging middleware
app.use(requestMiddleware);

// ─────────────────────────────────────────────────────────────────────────────────
// HEALTH & MONITORING ROUTES
// ─────────────────────────────────────────────────────────────────────────────────

// Health routes at root level (before API prefix)
const healthRouter = createHealthRouter();
app.use('/', healthRouter);

// Circuit breaker status endpoint (Phase 20)
app.get('/circuits', circuitBreakerStatusMiddleware());

// Simple root check for load balancers
app.get('/', (_req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'novaos-backend',
    version: '10.0.0',
    phase: 20,
    storage: storeManager.isUsingRedis() ? 'redis' : 'memory',
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// API ROUTES
// ─────────────────────────────────────────────────────────────────────────────────

// Create and mount main API router
const apiRouter = createRouter({
  requireAuth: REQUIRE_AUTH || NODE_ENV === 'production',
  providerConfig: {
    preferredProvider: USE_MOCK ? 'mock' : PREFERRED_PROVIDER,
    openaiApiKey: OPENAI_API_KEY,
    geminiApiKey: GEMINI_API_KEY,
  },
});

app.use('/api/v1', apiRouter);

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
  logger.info('═══════════════════════════════════════════════════════════════════════');
  logger.info('  NovaOS Backend Starting');
  logger.info('  Phase 20: Production Hardening');
  logger.info('═══════════════════════════════════════════════════════════════════════');
  
  // Initialize storage
  try {
    await storeManager.initialize();
    logger.info(`Storage: ${storeManager.isUsingRedis() ? 'Redis' : 'In-Memory'}`);
    
    // Initialize circuit breakers
    getLLMCircuit();
    getRedisCircuit();
    logger.info('Circuit breakers initialized');
  } catch (error) {
    logger.warn('Storage initialization failed, using in-memory fallback:', error);
  }
  
  // Determine verification capability
  const verificationStatus = canVerify() ? 'enabled' : 'disabled';
  
  // Log configuration
  logger.info('─────────────────────────────────────────────────────────────────────────');
  logger.info('Configuration:');
  logger.info(`  Environment: ${NODE_ENV}`);
  logger.info(`  Port: ${PORT}`);
  logger.info(`  Auth Required: ${REQUIRE_AUTH || NODE_ENV === 'production'}`);
  logger.info(`  Provider: ${USE_MOCK ? 'mock' : PREFERRED_PROVIDER}`);
  logger.info(`  Verification: ${verificationStatus}`);
  logger.info(`  Redis: ${REDIS_URL ? 'configured' : 'not configured'}`);
  logger.info('─────────────────────────────────────────────────────────────────────────');
  logger.info('Security:');
  logger.info(`  HTTPS Redirect: ${securityConfig.isProduction}`);
  logger.info(`  HSTS: ${securityConfig.isProduction ? `max-age=${securityConfig.hstsMaxAge}` : 'disabled'}`);
  logger.info(`  CSP: enabled`);
  logger.info(`  CORS Origins: ${securityConfig.isProduction ? securityConfig.allowedOrigins.length + ' domains' : 'all (*)'}`);
  logger.info(`  Input Sanitization: enabled`);
  logger.info(`  Rate Limiting: enabled`);
  logger.info('─────────────────────────────────────────────────────────────────────────');
  
  // Start server
  server = app.listen(PORT, () => {
    logger.info(`Server listening on port ${PORT}`);
    logger.info('═══════════════════════════════════════════════════════════════════════');
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
    logger.error('Unhandled rejection:', reason);
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
