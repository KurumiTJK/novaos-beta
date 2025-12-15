// ═══════════════════════════════════════════════════════════════════════════════
// NOVAOS SERVER — Main Entry Point
// Phase 1 Implementation
// ═══════════════════════════════════════════════════════════════════════════════

import express from 'express';
import { createPipeline } from './pipeline/execution-pipeline.js';
import { createRoutes, errorHandler } from './api/routes.js';
import { createNonceStore, getDefaultNonceStore } from './storage/nonce-store.js';
import { createAuditLogger, getDefaultAuditLogger } from './audit/audit-adapter.js';
import { InMemorySparkMetricsStore } from './helpers/spark-eligibility.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

interface ServerConfig {
  port: number;
  ackTokenSecret: string;
  enableAuditLogging: boolean;
  enableWebVerification: boolean;
}

function loadConfig(): ServerConfig {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    ackTokenSecret: process.env.ACK_TOKEN_SECRET || 'development-secret-change-in-production',
    enableAuditLogging: process.env.ENABLE_AUDIT_LOGGING !== 'false',
    enableWebVerification: process.env.ENABLE_WEB_VERIFICATION === 'true',
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// SERVER SETUP
// ─────────────────────────────────────────────────────────────────────────────────

export async function createServer(): Promise<express.Application> {
  const config = loadConfig();
  const app = express();

  // Middleware
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // CORS (configure properly in production)
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-User-Id');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
  });

  // Request logging
  app.use((req, _res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.path}`);
    next();
  });

  // Initialize stores
  const nonceStore = getDefaultNonceStore();
  const sparkMetricsStore = new InMemorySparkMetricsStore();
  const auditLogger = config.enableAuditLogging ? getDefaultAuditLogger() : undefined;

  // Web fetcher (placeholder - implement with actual HTTP client in production)
  const webFetcher = config.enableWebVerification ? {
    async search(query: string, options?: { limit?: number }) {
      console.log(`[WEB] Search: ${query} (limit: ${options?.limit})`);
      // Placeholder - return empty results
      return [];
    },
    async fetch(url: string) {
      console.log(`[WEB] Fetch: ${url}`);
      // Placeholder - return mock result
      return {
        url,
        content: '',
        title: 'Mock Page',
        fetchedAt: new Date(),
        success: false,
        error: 'Web fetcher not implemented',
      };
    },
  } : null;

  // Create pipeline
  const pipeline = createPipeline({
    nonceStore,
    sparkMetricsStore,
    auditLogger,
    ackTokenSecret: config.ackTokenSecret,
    webFetcher,
  });

  // Mount routes
  const routes = createRoutes({ pipeline });
  app.use('/api/v1', routes);

  // Health check at root
  app.get('/', (_req, res) => {
    res.json({
      name: 'NovaOS Backend',
      version: '4.0.0',
      status: 'running',
    });
  });

  // Error handler
  app.use(errorHandler);

  return app;
}

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  try {
    const config = loadConfig();
    const app = await createServer();

    app.listen(config.port, () => {
      console.log('═══════════════════════════════════════════════════════════════════');
      console.log('  NovaOS Backend v4.0.0');
      console.log('═══════════════════════════════════════════════════════════════════');
      console.log(`  Server running on port ${config.port}`);
      console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`  Audit logging: ${config.enableAuditLogging ? 'enabled' : 'disabled'}`);
      console.log(`  Web verification: ${config.enableWebVerification ? 'enabled' : 'disabled'}`);
      console.log('═══════════════════════════════════════════════════════════════════');
      console.log('');
      console.log('  Endpoints:');
      console.log('    POST /api/v1/chat          - Main chat endpoint');
      console.log('    POST /api/v1/parse-command - Command parser');
      console.log('    GET  /api/v1/health        - Health check');
      console.log('    GET  /api/v1/versions      - Policy versions');
      console.log('');
      console.log('═══════════════════════════════════════════════════════════════════');
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  main();
}

export { loadConfig };
