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
// DATABASE IMPORTS
// ─────────────────────────────────────────────────────────────────────────────────

import { initSupabase, testConnection, isSupabaseInitialized } from './db/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// SERVICE AVAILABILITY CHECKS
// ─────────────────────────────────────────────────────────────────────────────────

function isGeminiConfigured(): boolean {
  return !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 10);
}

function isYouTubeConfigured(): boolean {
  return !!(
    (process.env.YOUTUBE_API_KEY && process.env.YOUTUBE_API_KEY.length > 10) ||
    (process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY.length > 10)
  );
}

function isGoogleCSEConfigured(): boolean {
  const hasApiKey = !!(
    (process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_API_KEY.length > 10) ||
    (process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY.length > 10)
  );
  const hasSearchEngineId = !!(
    (process.env.GOOGLE_SEARCH_ENGINE_ID && process.env.GOOGLE_SEARCH_ENGINE_ID.length > 5) ||
    (process.env.GOOGLE_CSE_ID && process.env.GOOGLE_CSE_ID.length > 5)
  );
  return hasApiKey && hasSearchEngineId;
}

function isN8nConfigured(): boolean {
  return !!(process.env.N8N_WEBHOOK_BASE_URL && process.env.N8N_HMAC_SECRET);
}

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
    gemini: isGeminiConfigured(),
    youtube: isYouTubeConfigured(),
    googleCSE: isGoogleCSEConfigured(),
    n8n: isN8nConfigured(),
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
    services: {
      openai: isOpenAIAvailable(),
      gemini: isGeminiConfigured(),
      youtube: isYouTubeConfigured(),
      googleCSE: isGoogleCSEConfigured(),
      n8n: isN8nConfigured(),
    },
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
  // Initialize Supabase (optional - only if env vars are set)
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
    
    // Build service status strings
    const openaiStatus = isOpenAIAvailable() ? '✓ connected' : '✗ not configured';
    const geminiStatus = isGeminiConfigured() ? '✓ connected' : '✗ not configured';
    const youtubeStatus = isYouTubeConfigured() ? '✓ connected' : '✗ not configured';
    const googleCSEStatus = isGoogleCSEConfigured() ? '✓ connected' : '✗ not configured';
    const redisStatus = storeManager.isUsingRedis() ? '✓ connected' : '○ using memory';
    const supabaseIcon = supabaseStatus === 'connected' ? '✓' : '✗';
    const n8nStatus = isN8nConfigured() ? '✓ configured' : '○ not configured';
    
    logger.info('Server started', {
      port: PORT,
      environment: NODE_ENV,
      storage: storeManager.isUsingRedis() ? 'redis' : 'memory',
      database: supabaseStatus,
      verification: canVerify() ? 'enabled' : 'disabled',
      pipelineModel: pipeline_model,
      generationModel: model_llm,
      gemini: isGeminiConfigured(),
      youtube: isYouTubeConfigured(),
      googleCSE: isGoogleCSEConfigured(),
      n8n: isN8nConfigured(),
      startupMs: startupTime,
    });
    
    console.log(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║                           NOVAOS BACKEND v1.0.0                               ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  Environment:  ${NODE_ENV.padEnd(61)}║
║  Port:         ${String(PORT).padEnd(61)}║
║  Auth:         ${(REQUIRE_AUTH ? 'required' : 'optional').padEnd(61)}║
║  Verification: ${(canVerify() ? 'enabled' : 'disabled').padEnd(61)}║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  SERVICES                                                                     ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  OpenAI:       ${openaiStatus.padEnd(61)}║
║    Pipeline:   ${pipeline_model.padEnd(61)}║
║    Generation: ${model_llm.padEnd(61)}║
║  Gemini:       ${geminiStatus.padEnd(61)}║
║  YouTube API:  ${youtubeStatus.padEnd(61)}║
║  Google CSE:   ${googleCSEStatus.padEnd(61)}║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  STORAGE                                                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  Redis:        ${redisStatus.padEnd(61)}║
║  Supabase:     ${(supabaseIcon + ' ' + supabaseStatus).padEnd(61)}║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  INTEGRATIONS                                                                 ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  n8n:          ${n8nStatus.padEnd(61)}║
╚═══════════════════════════════════════════════════════════════════════════════╝

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ HEALTH                                                                      │
  ├─────────────────────────────────────────────────────────────────────────────┤
  │  GET  /health                              Health check                     │
  │  GET  /health/live                         Liveness probe                   │
  │  GET  /health/ready                        Readiness probe                  │
  └─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ INFO                                                                        │
  ├─────────────────────────────────────────────────────────────────────────────┤
  │  GET  /api/v1/health                       API health                       │
  │  GET  /api/v1/version                      Version info                     │
  │  GET  /api/v1/providers                    Available providers              │
  │  GET  /api/v1/config                       Current config                   │
  └─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ AUTH                                                                        │
  ├─────────────────────────────────────────────────────────────────────────────┤
  │  POST /api/v1/auth/register                Get token                        │
  │  GET  /api/v1/auth/verify                  Verify token                     │
  │  GET  /api/v1/auth/status                  Auth status                      │
  │  POST /api/v1/auth/refresh                 Refresh tokens                   │
  │  POST /api/v1/auth/logout                  Logout                           │
  └─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ SETTINGS                                                                    │
  ├─────────────────────────────────────────────────────────────────────────────┤
  │  GET   /api/v1/settings                    Get user settings                │
  │  PATCH /api/v1/settings                    Update settings                  │
  └─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ CHAT                                                                        │
  ├─────────────────────────────────────────────────────────────────────────────┤
  │  POST /api/v1/chat                         Main chat endpoint               │
  │  POST /api/v1/parse-command                Parse action command             │
  └─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ CONVERSATIONS                                                               │
  ├─────────────────────────────────────────────────────────────────────────────┤
  │  GET    /api/v1/conversations              List conversations               │
  │  GET    /api/v1/conversations/:id          Get conversation                 │
  │  GET    /api/v1/conversations/:id/messages Get messages                     │
  │  PATCH  /api/v1/conversations/:id          Update conversation              │
  │  DELETE /api/v1/conversations/:id          Delete conversation              │
  └─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ SHIELD (Protection System)                                                  │
  ├─────────────────────────────────────────────────────────────────────────────┤
  │  GET  /api/v1/shield/status                Check crisis status              │
  │  POST /api/v1/shield/confirm               Confirm warning acknowledgment   │
  │  POST /api/v1/shield/safe                  Confirm safety (end crisis)      │
  └─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ SWORDGATE - Main                                                            │
  ├─────────────────────────────────────────────────────────────────────────────┤
  │  GET  /api/v1/sword                        Full SwordGate state             │
  │  GET  /api/v1/sword/today                  Today's learning content         │
  └─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ SWORDGATE - Exploration (Orient + Clarify)                                  │
  ├─────────────────────────────────────────────────────────────────────────────┤
  │  POST  /api/v1/sword/explore/start         Start exploration                │
  │  POST  /api/v1/sword/explore/chat          Chat in Orient phase             │
  │  POST  /api/v1/sword/explore/confirm       Confirm → move to Clarify        │
  │  GET   /api/v1/sword/explore/clarify       Get Clarify data                 │
  │  PATCH /api/v1/sword/explore/field         Update field                     │
  │  PATCH /api/v1/sword/explore/constraints   Update constraints               │
  └─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ SWORDGATE - Lesson Designer                                                 │
  ├─────────────────────────────────────────────────────────────────────────────┤
  │  POST  /api/v1/sword/designer/finalize     Finalize → Generate Capstone     │
  │  POST  /api/v1/sword/designer/capstone/confirm  Confirm capstone            │
  │  POST  /api/v1/sword/designer/subskills    Generate subskills               │
  │  POST  /api/v1/sword/designer/subskills/confirm  Confirm subskills          │
  │  POST  /api/v1/sword/designer/routing      Generate routing                 │
  │  POST  /api/v1/sword/designer/routing/confirm  Confirm → Create plan        │
  │  GET   /api/v1/sword/designer/session      Get active session               │
  │  GET   /api/v1/sword/designer/sessions     List all sessions                │
  │  DELETE /api/v1/sword/designer/session/:id Delete session                   │
  └─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ SWORDGATE - Lesson Runner                                                   │
  ├─────────────────────────────────────────────────────────────────────────────┤
  │  POST /api/v1/sword/runner/start           Start learning session           │
  │  POST /api/v1/sword/runner/complete        Complete current content         │
  │  POST /api/v1/sword/runner/submit-mastery  Submit mastery check             │
  │  GET  /api/v1/sword/runner/progress/subskill/:id  Get subskill progress     │
  │  GET  /api/v1/sword/runner/progress/plan/:id  Get plan progress             │
  │  GET  /api/v1/sword/runner/history/:id     Get session history              │
  │  GET  /api/v1/sword/runner/lesson-plan/:id Get lesson plan                  │
  │  GET  /api/v1/sword/runner/refresh/:id     Check if needs refresh           │
  │  GET  /api/v1/sword/runner/refresh/:id/content  Get refresh content         │
  │  POST /api/v1/sword/runner/refresh/:id/skip  Skip refresh                   │
  └─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ SWORDGATE - Sparks                                                          │
  ├─────────────────────────────────────────────────────────────────────────────┤
  │  POST /api/v1/sword/spark                  Generate new spark               │
  │  GET  /api/v1/sword/spark/current          Get current active spark         │
  │  POST /api/v1/sword/spark/:id/complete     Complete spark                   │
  │  POST /api/v1/sword/spark/:id/skip         Skip spark                       │
  │  GET  /api/v1/sword/sparks                 List all sparks                  │
  └─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ SWORDGATE - Plans & Assessment                                              │
  ├─────────────────────────────────────────────────────────────────────────────┤
  │  GET  /api/v1/sword/plans                  List learning plans              │
  │  GET  /api/v1/sword/plans/:id              Get plan details                 │
  │  POST /api/v1/sword/plans/:id/activate     Activate plan                    │
  │  POST /api/v1/sword/plans/:id/pause        Pause plan                       │
  │  POST /api/v1/sword/plans/:id/complete     Complete plan                    │
  │  POST /api/v1/sword/subskills/:id/start    Start subskill                   │
  │  POST /api/v1/sword/assess/initial         Initial assessment               │
  │  POST /api/v1/sword/assess/submit          Submit assessment                │
  └─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ ADMIN                                                                       │
  ├─────────────────────────────────────────────────────────────────────────────┤
  │  POST /api/v1/admin/block-user             Block user                       │
  │  POST /api/v1/admin/unblock-user           Unblock user                     │
  │  GET  /api/v1/admin/audit-logs             View audit logs                  │
  └─────────────────────────────────────────────────────────────────────────────┘

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
